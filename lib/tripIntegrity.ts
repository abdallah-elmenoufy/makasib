import "server-only";
import { prisma } from "./db";
import { matchTripToShift } from "./analytics";

/**
 * Always-on data integrity for the shift↔trip relationship.
 *
 * The rule that matters to a driver: **a trip on a real ride-hailing
 * platform can only have happened while working**, so it must sit inside a
 * logged shift. If it doesn't, either the shift is missing or its time
 * window is wrong — and the km-based costs (fuel, maintenance, depreciation)
 * silently under-count, because those are charged per shift km.
 *
 * A trip logged as OTHER is exempt: that's the escape hatch for a private
 * job, a favour, an off-platform ride — it may legitimately sit outside any
 * shift and must not be nagged about.
 *
 * This module replaces a passive 2-hour sweep that left orphans sitting
 * unlinked between runs. Reconciliation now happens on every mutation that
 * could possibly change the answer, and is awaited so the response the
 * driver sees already reflects the corrected state.
 */

/** Platforms that imply paid working time — an "OTHER" trip does not. */
const PLATFORMS_REQUIRING_SHIFT = new Set(["UBER", "CAREEM", "INDRIVE", "BOLT"]);

export function requiresShift(platform: string): boolean {
  return PLATFORMS_REQUIRING_SHIFT.has(platform);
}

/**
 * Re-home every unlinked trip on this vehicle into a shift whose window now
 * covers it. Safe to call as often as you like — it only ever touches trips
 * with no shift, and only when a real match exists.
 */
export async function reconcileVehicle(vehicleId: string): Promise<number> {
  const orphans = await prisma.trip.findMany({ where: { vehicleId, shiftId: null } });
  let fixed = 0;
  for (const trip of orphans) {
    const shiftId = await matchTripToShift(vehicleId, trip.startTime);
    if (shiftId) {
      await prisma.trip.update({ where: { id: trip.id }, data: { shiftId } });
      fixed++;
    }
  }
  return fixed;
}

/** Same sweep across every vehicle. */
export async function reconcileAll(): Promise<number> {
  const vehicles = await prisma.vehicle.findMany({ select: { id: true } });
  let total = 0;
  for (const v of vehicles) total += await reconcileVehicle(v.id);
  return total;
}

export type IntegrityReport = {
  /** Platform trips still outside any shift after reconciling — needs the driver. */
  orphanTrips: {
    id: string;
    platform: string;
    startTime: string;
    net: number;
    nearestShiftId: string | null;
    nearestShiftLabel: string | null;
  }[];
  /** Completed shifts that recorded zero trips — usually a forgotten import. */
  emptyShifts: { id: string; startTime: string; endTime: string | null; km: number }[];
  /** Shifts left open (never ended) — the odometer span is unusable until closed. */
  openShifts: { id: string; startTime: string }[];
  reconciled: number;
};

/**
 * Reconcile first, then report only what a human still has to resolve.
 * Reconciling before reporting is deliberate: it means the banner never
 * nags about something the app could have fixed by itself.
 */
export async function checkIntegrity(vehicleId: string): Promise<IntegrityReport> {
  const reconciled = await reconcileVehicle(vehicleId);

  const [unlinked, shifts, tripCounts] = await Promise.all([
    prisma.trip.findMany({ where: { vehicleId, shiftId: null }, orderBy: { startTime: "desc" } }),
    prisma.shift.findMany({ where: { vehicleId }, orderBy: { startTime: "desc" } }),
    prisma.trip.groupBy({ by: ["shiftId"], where: { vehicleId, shiftId: { not: null } }, _count: true }),
  ]);

  const counted = new Set(tripCounts.map((c) => c.shiftId));

  // for each orphan, offer the closest shift so the fix is one tap, not a hunt
  const nearestFor = (t: Date) => {
    let best: (typeof shifts)[number] | null = null;
    let bestGap = Infinity;
    for (const s of shifts) {
      const start = s.startTime.getTime();
      const end = s.endTime ? s.endTime.getTime() : start;
      const gap = t.getTime() < start ? start - t.getTime() : t.getTime() > end ? t.getTime() - end : 0;
      if (gap < bestGap) {
        bestGap = gap;
        best = s;
      }
    }
    // only suggest something plausibly the same working session
    return best && bestGap <= 6 * 3_600_000 ? best : null;
  };

  return {
    reconciled,
    orphanTrips: unlinked
      .filter((t) => requiresShift(t.platform))
      .map((t) => {
        const near = nearestFor(t.startTime);
        return {
          id: t.id,
          platform: t.platform,
          startTime: t.startTime.toISOString(),
          net: t.fare - (t.commission ?? 0) + t.tip,
          nearestShiftId: near?.id ?? null,
          nearestShiftLabel: near ? near.startTime.toISOString() : null,
        };
      }),
    emptyShifts: shifts
      .filter((s) => s.endOdometer != null && !counted.has(s.id))
      .map((s) => ({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime?.toISOString() ?? null,
        km: (s.endOdometer ?? 0) - s.startOdometer,
      })),
    openShifts: shifts
      .filter((s) => s.endOdometer == null)
      .map((s) => ({ id: s.id, startTime: s.startTime.toISOString() })),
  };
}

/**
 * Cheap safety net for read paths. Short cooldown (not the old 2 hours) —
 * mutations already reconcile synchronously, so this only has to catch data
 * that arrived by some other route.
 */
let lastSweep = 0;
export function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  reconcileAll().catch((e) => console.error("integrity sweep failed:", e));
}
