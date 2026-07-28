import "server-only";
import { prisma } from "./db";
import { getAnalytics } from "./analytics";

// "Your car vs other drivers' same car" — mirrors lib/benchmark.ts's honesty
// rule: a REAL aggregation across every other active vehicle sharing the
// same catalog model, never a fabricated number. driverCount is always
// reported so the UI can say "not enough data yet" instead of pretending.

export type CarStats = {
  fuelPer100: number | null; // primary fuel group only (PETROL preferred; CNG for CNG-only cars)
  fuelUnit: "L" | "m3" | null;
  fuelDistanceKm: number;
  maintCostPerKm: number | null;
  totalKm: number;
};

export type CarModelBenchmark = {
  carModel: { id: string; make: string; model: string } | null;
  you: CarStats;
  others: CarStats & { driverCount: number };
};

async function vehicleCarStats(vehicleId: string): Promise<CarStats> {
  const a = await getAnalytics(vehicleId, "all");
  const primary = a.fuelEconomy.find((e) => e.fuelGroup === "PETROL") ?? a.fuelEconomy[0] ?? null;
  return {
    fuelPer100: primary?.per100 ?? null,
    fuelUnit: primary?.unit ?? null,
    fuelDistanceKm: primary?.distanceKm ?? 0,
    maintCostPerKm: a.totalKmAllTime > 0 ? a.rates.maintCostPerKm : null,
    totalKm: a.totalKmAllTime,
  };
}

const EMPTY_STATS: CarStats = { fuelPer100: null, fuelUnit: null, fuelDistanceKm: 0, maintCostPerKm: null, totalKm: 0 };

function weightedAvg(rows: { value: number | null; weight: number }[]): number | null {
  const valid = rows.filter((r) => r.value != null && r.weight > 0);
  const totalWeight = valid.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return null;
  return valid.reduce((s, r) => s + r.value! * r.weight, 0) / totalWeight;
}

/** Benchmark for one specific vehicle against other active vehicles of the
 *  same catalog model. Returns null if the vehicle has no catalog model set
 *  (custom/"Other" entries can't be grouped — nothing honest to compare). */
export async function getCarModelBenchmark(vehicleId: string): Promise<CarModelBenchmark | null> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle?.carModelId) return null;
  return getCarModelBenchmarkForModel(vehicle.carModelId, vehicleId);
}

/** Same aggregation, usable before a vehicle even exists (e.g. a live
 *  preview in the car-add form: "other Corolla drivers average X L/100km"). */
export async function getCarModelBenchmarkForModel(
  carModelId: string,
  excludeVehicleId?: string
): Promise<CarModelBenchmark> {
  const [carModel, vehicles] = await Promise.all([
    prisma.carModel.findUnique({ where: { id: carModelId } }),
    prisma.vehicle.findMany({ where: { carModelId, isActive: true }, select: { id: true } }),
  ]);

  const you = excludeVehicleId && vehicles.some((v) => v.id === excludeVehicleId)
    ? await vehicleCarStats(excludeVehicleId)
    : EMPTY_STATS;

  const otherIds = vehicles.map((v) => v.id).filter((id) => id !== excludeVehicleId);
  const others = await Promise.all(otherIds.map(vehicleCarStats));
  const withData = others.filter((o) => o.fuelPer100 != null || o.maintCostPerKm != null);

  return {
    carModel: carModel ? { id: carModel.id, make: carModel.make, model: carModel.model } : null,
    you,
    others: {
      fuelPer100: weightedAvg(others.map((o) => ({ value: o.fuelPer100, weight: o.fuelDistanceKm }))),
      fuelUnit: others.find((o) => o.fuelUnit)?.fuelUnit ?? null,
      fuelDistanceKm: others.reduce((s, o) => s + o.fuelDistanceKm, 0),
      maintCostPerKm: weightedAvg(others.map((o) => ({ value: o.maintCostPerKm, weight: o.totalKm }))),
      totalKm: others.reduce((s, o) => s + o.totalKm, 0),
      driverCount: withData.length,
    },
  };
}
