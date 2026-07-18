import "server-only";
import { prisma } from "./db";
import { getAnalytics, Period } from "./analytics";

// "You vs. other drivers" — a REAL aggregation across every other active
// vehicle in this database, never fabricated numbers. In a single-install
// (phase 1) deployment there IS no other driver, so this honestly reports
// driverCount: 0 rather than inventing a comparison. It generalizes for free
// once phase 2 hosts multiple drivers' vehicles in the same database — no
// code change needed, just real rows to aggregate.

export type DriverRate = { profitPerHour: number | null; profitPerKm: number | null };
export type Benchmark = {
  you: DriverRate;
  others: DriverRate & { driverCount: number };
};

export async function getBenchmark(vehicleId: string, period: Period): Promise<Benchmark> {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
  const otherIds = vehicles.map((v) => v.id).filter((id) => id !== vehicleId);

  const you = await getAnalytics(vehicleId, period);
  const others = await Promise.all(
    otherIds.map((id) => getAnalytics(id, period).catch(() => null))
  );
  const valid = others.filter(
    (o): o is NonNullable<typeof o> => o != null && o.perHour != null && o.perKm != null
  );

  const avg = (xs: number[]): number | null =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  return {
    you: { profitPerHour: you.perHour, profitPerKm: you.perKm },
    others: {
      profitPerHour: avg(valid.map((o) => o.perHour!)),
      profitPerKm: avg(valid.map((o) => o.perKm!)),
      driverCount: valid.length,
    },
  };
}
