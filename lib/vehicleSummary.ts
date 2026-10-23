import { prisma } from "./db";
import { getAnalytics, getLatestOdometer } from "./analytics";
import { estimateCurrentValue } from "./depreciation";
import { getCarModelBenchmark } from "./carBenchmark";

export type VehicleSummary = {
  vehicle: Awaited<ReturnType<typeof prisma.vehicle.findFirstOrThrow>>;
  currentOdo: number;
  kmSinceRecord: number;
  currentValue: number | null;
  depreciationSoFar: number | null;
  trueProfit: number;
  perHour: number | null;
  perKm: number | null;
  shiftCount: number;
  hasRecords: boolean;
  healthScore: number | null;
};

/**
 * A single 0-100 rollup so a driver can glance at a car and know "is this
 * one okay?" without reading five separate cards. Never invented — every
 * component is either a real overdue/due-soon count (lib/analytics.ts's
 * reminderStatuses) or a real cross-driver gap (lib/carBenchmark.ts).
 * null when the car has no records at all — nothing to score yet.
 */
async function computeHealthScore(
  vehicleId: string,
  reminders: { state: "overdue" | "changeNow" | "dueSoon" | "ok" }[],
  hasRecords: boolean
): Promise<number | null> {
  if (!hasRecords) return null;
  let score = 100;

  const overdue = reminders.filter((r) => r.state === "overdue").length;
  const changeNow = reminders.filter((r) => r.state === "changeNow").length;
  const dueSoon = reminders.filter((r) => r.state === "dueSoon").length;
  score -= Math.min(60, overdue * 20 + changeNow * 14);
  score -= Math.min(24, dueSoon * 8);

  const lastMaint = await prisma.maintenance.findFirst({ where: { vehicleId }, orderBy: { date: "desc" } });
  const monthsSinceMaint = lastMaint ? (Date.now() - new Date(lastMaint.date).getTime()) / (30 * 86_400_000) : null;
  if (lastMaint == null) score -= 10; // no maintenance history at all yet
  else if (monthsSinceMaint != null && monthsSinceMaint > 8) score -= 10;

  const bench = await getCarModelBenchmark(vehicleId).catch(() => null);
  if (bench && bench.others.driverCount > 0) {
    const fuelGap =
      bench.you.fuelPer100 != null && bench.others.fuelPer100 != null && bench.others.fuelPer100 > 0
        ? (bench.you.fuelPer100 - bench.others.fuelPer100) / bench.others.fuelPer100
        : null;
    const maintGap =
      bench.you.maintCostPerKm != null && bench.others.maintCostPerKm != null && bench.others.maintCostPerKm > 0
        ? (bench.you.maintCostPerKm - bench.others.maintCostPerKm) / bench.others.maintCostPerKm
        : null;
    for (const gap of [fuelGap, maintGap]) {
      if (gap == null) continue;
      if (gap > 0) score -= Math.min(15, Math.round(gap * 50));
      else score += Math.min(5, Math.round(-gap * 20));
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** One row per car (active + archived) for the /cars table: live odometer,
 * depreciation, and all-time profit — everything a driver needs to see a
 * car as a standalone asset. */
export async function getVehicleSummaries(): Promise<VehicleSummary[]> {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "asc" } });

  return Promise.all(
    vehicles.map(async (vehicle) => {
      const [currentOdo, analytics, recordCounts] = await Promise.all([
        getLatestOdometer(vehicle.id),
        getAnalytics(vehicle.id, "all"),
        Promise.all([
          prisma.shift.count({ where: { vehicleId: vehicle.id } }),
          prisma.trip.count({ where: { vehicleId: vehicle.id } }),
          prisma.fuelUp.count({ where: { vehicleId: vehicle.id } }),
          prisma.maintenance.count({ where: { vehicleId: vehicle.id } }),
          prisma.expense.count({ where: { vehicleId: vehicle.id } }),
        ]),
      ]);

      const currentValue = estimateCurrentValue(vehicle);
      const depreciationSoFar =
        vehicle.purchasePrice != null && currentValue != null
          ? Math.max(0, vehicle.purchasePrice - currentValue)
          : null;
      const hasRecords = recordCounts.some((c) => c > 0);
      const healthScore = await computeHealthScore(vehicle.id, analytics.reminders, hasRecords);

      return {
        vehicle,
        currentOdo,
        kmSinceRecord: Math.max(0, currentOdo - vehicle.initialOdometer),
        currentValue,
        depreciationSoFar,
        trueProfit: analytics.trueProfit,
        perHour: analytics.perHour,
        perKm: analytics.perKm,
        shiftCount: analytics.counts.shifts,
        hasRecords,
        healthScore,
      };
    })
  );
}
