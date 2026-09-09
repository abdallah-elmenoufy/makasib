import "server-only";
import { prisma } from "./db";
import { getAnalytics, Period } from "./analytics";

// Community leaderboard — same honesty rule as lib/benchmark.ts: a REAL
// ranking across every other active vehicle in this database, never a
// fabricated one. Entries are labeled "Driver N" (not the vehicle's own
// name) since that name is the driver's own private label for their car,
// not something they've chosen to share publicly.
//
// Note on scope: there's no referral/invite system here — Phase 1 is a
// single-passphrase local install with no multi-user account signup, so
// there's nothing to invite a friend "into" yet. This ranks whatever
// vehicles already share the database, exactly like the existing
// "you vs. other drivers" benchmark, and will read as a true multi-driver
// leaderboard the moment Phase 2 hosts real separate accounts.

const MIN_DRIVERS = 3;

export type LeaderboardEntry = {
  vehicleId: string;
  label: string;
  profitPerHour: number;
  profitPerKm: number | null;
  isYou: boolean;
};

export type Leaderboard = {
  driverCount: number;
  entries: LeaderboardEntry[];
  yourRank: number | null;
};

export async function getLeaderboard(period: Period, vehicleId?: string, limit = 5): Promise<Leaderboard> {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
  const all = await Promise.all(
    vehicles.map(async (v) => {
      const a = await getAnalytics(v.id, period).catch(() => null);
      return { vehicleId: v.id, profitPerHour: a?.perHour ?? null, profitPerKm: a?.perKm ?? null };
    })
  );
  const ranked = (all.filter((x) => x.profitPerHour != null) as { vehicleId: string; profitPerHour: number; profitPerKm: number | null }[]).sort(
    (a, b) => b.profitPerHour - a.profitPerHour
  );

  if (ranked.length < MIN_DRIVERS) {
    return { driverCount: ranked.length, entries: [], yourRank: null };
  }

  const yourIndex = vehicleId ? ranked.findIndex((x) => x.vehicleId === vehicleId) : -1;
  const yourRank = yourIndex >= 0 ? yourIndex + 1 : null;

  const entries = ranked.slice(0, limit).map((x, i) => ({
    vehicleId: x.vehicleId,
    label: `Driver ${i + 1}`,
    profitPerHour: x.profitPerHour,
    profitPerKm: x.profitPerKm,
    isYou: x.vehicleId === vehicleId,
  }));

  return { driverCount: ranked.length, entries, yourRank };
}
