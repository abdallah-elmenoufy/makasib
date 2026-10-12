import "server-only";
import { prisma } from "./db";
import { matchTripToShift } from "./analytics";
import { locateTrips } from "./tripLocation";

// One normalized incoming trip, from any source (statement PDF, OCR, CSV).
export type IncomingTrip = {
  startTime: Date;
  earnings: number; // driver net
  cashCollected: number | null; // rider-paid cash, when known (cash trips)
  isCash: boolean;
  distanceKm: number | null;
  durationMin?: number | null; // minutes with the rider, when the source shows it
  product: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  source: "STATEMENT" | "OCR" | "CSV";
  platform: string;
};

export type ApplyResult = {
  created: number;
  merged: number;
  skipped: number;
  matchedToShift: number;
};

const MATCH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Create trips with dedupe/merge:
 * - an existing trip within ±5 min with a similar amount → merge (fill in
 *   missing distance/notes) instead of duplicating, so statement + OCR
 *   imports of the same week enrich one another;
 * - otherwise create, auto-matched to the covering shift.
 *
 * Money mapping (fare = rider-side, commission = platform share):
 * cash trip:  fare = cashCollected, commission = cashCollected − earnings
 *             (negative commission = Uber owes the driver the difference);
 * card trip:  fare = earnings, commission = 0 — earnings are already net.
 * Both give netRevenue = earnings and correct cash reconciliation.
 */
export async function applyTrips(vehicleId: string, trips: IncomingTrip[]): Promise<ApplyResult> {
  const res: ApplyResult = { created: 0, merged: 0, skipped: 0, matchedToShift: 0 };

  for (const t of trips) {
    const near = await prisma.trip.findFirst({
      where: {
        vehicleId,
        startTime: {
          gte: new Date(t.startTime.getTime() - MATCH_WINDOW_MS),
          lte: new Date(t.startTime.getTime() + MATCH_WINDOW_MS),
        },
      },
    });

    const fare = t.isCash && t.cashCollected != null ? t.cashCollected : t.earnings;
    const commission = t.isCash && t.cashCollected != null ? t.cashCollected - t.earnings : 0;

    if (near) {
      const nearNet = near.fare - (near.commission ?? 0);
      const sameAmount =
        Math.abs(nearNet - t.earnings) < 1 || Math.abs(near.fare - fare) < 1;
      if (sameAmount) {
        const data: Record<string, unknown> = {};
        if (near.distanceKm == null && t.distanceKm != null) data.distanceKm = t.distanceKm;
        if (near.durationMin == null && t.durationMin != null && t.durationMin > 0) {
          data.durationMin = t.durationMin;
          if (near.endTime == null) data.endTime = new Date(near.startTime.getTime() + t.durationMin * 60_000);
        }
        if (!near.notes && t.product) data.notes = t.product;
        if (!near.pickupAddress && t.pickupAddress) data.pickupAddress = t.pickupAddress;
        if (!near.dropoffAddress && t.dropoffAddress) data.dropoffAddress = t.dropoffAddress;
        if (Object.keys(data).length > 0) {
          await prisma.trip.update({ where: { id: near.id }, data });
          res.merged++;
        } else {
          res.skipped++;
        }
        continue;
      }
    }

    const shiftId = await matchTripToShift(vehicleId, t.startTime);
    if (shiftId) res.matchedToShift++;
    const created = await prisma.trip.create({
      data: {
        vehicleId,
        shiftId,
        platform: t.platform,
        startTime: t.startTime,
        fare,
        commission,
        distanceKm: t.distanceKm,
        durationMin: t.durationMin ?? null,
        endTime: t.durationMin != null && t.durationMin > 0 ? new Date(t.startTime.getTime() + t.durationMin * 60_000) : null,
        paymentType: t.isCash ? "CASH" : "CARD",
        pickupAddress: t.pickupAddress ?? null,
        dropoffAddress: t.dropoffAddress ?? null,
        source: t.source,
        notes: t.product,
      },
    });
    res.created++;
    await locateTrips([created]);
  }

  return res;
}

/** Attach an in-app tip to the trip that has the same event time, else save standalone. */
export async function applyTip(
  vehicleId: string,
  eventAt: Date,
  amount: number,
  label: string
): Promise<"attached" | "standalone" | "skipped"> {
  const trip = await prisma.trip.findFirst({
    where: {
      vehicleId,
      startTime: {
        gte: new Date(eventAt.getTime() - MATCH_WINDOW_MS),
        lte: new Date(eventAt.getTime() + MATCH_WINDOW_MS),
      },
    },
  });
  if (trip) {
    if (trip.tip > 0) return "skipped"; // already recorded (re-import)
    await prisma.trip.update({ where: { id: trip.id }, data: { tip: amount } });
    return "attached";
  }
  const dupe = await prisma.cashTip.findFirst({ where: { vehicleId, date: eventAt, amount } });
  if (dupe) return "skipped";
  await prisma.cashTip.create({
    data: { vehicleId, date: eventAt, amount, notes: label },
  });
  return "standalone";
}

/** Platform fee (e.g. Flex Pay Fee) → work expense, deduped by date+amount. */
export async function applyFee(
  vehicleId: string,
  date: Date,
  amount: number,
  label: string
): Promise<boolean> {
  const abs = Math.abs(amount);
  const dupe = await prisma.expense.findFirst({
    where: { vehicleId, date, amount: abs, category: "OTHER" },
  });
  if (dupe) return false;
  await prisma.expense.create({
    data: { vehicleId, date, amount: abs, category: "OTHER", isWork: true, notes: label },
  });
  return true;
}
