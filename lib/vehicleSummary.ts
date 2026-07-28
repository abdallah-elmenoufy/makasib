import { prisma } from "./db";
import { getAnalytics, getLatestOdometer } from "./analytics";
import { estimateCurrentValue } from "./depreciation";

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
};

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
        hasRecords: recordCounts.some((c) => c > 0),
      };
    })
  );
}
