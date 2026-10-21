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
  /** The gearbox compared on, when the comparison is like-for-like. */
  gearbox: string | null;
  /** True when "others" are the same model AND gearbox; false = same model, any gearbox. */
  gearboxMatched: boolean;
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
  return getCarModelBenchmarkForModel(vehicle.carModelId, vehicleId, vehicle.transmission);
}

/** Same-gearbox comparisons need this many other cars with data before they replace the all-gearbox one. */
export const MIN_GEARBOX_PEERS = 3;

/** Same aggregation, usable before a vehicle even exists (e.g. a live
 *  preview in the car-add form: "other Corolla drivers average X L/100km"). */
export async function getCarModelBenchmarkForModel(
  carModelId: string,
  excludeVehicleId?: string,
  transmission?: string | null
): Promise<CarModelBenchmark> {
  const [carModel, vehicles] = await Promise.all([
    prisma.carModel.findUnique({ where: { id: carModelId } }),
    prisma.vehicle.findMany({ where: { carModelId, isActive: true }, select: { id: true, transmission: true } }),
  ]);

  const you = excludeVehicleId && vehicles.some((v) => v.id === excludeVehicleId)
    ? await vehicleCarStats(excludeVehicleId)
    : EMPTY_STATS;

  // an automatic and a manual Optra burn fuel and wear brakes differently:
  // compare like with like once enough same-gearbox cars have data
  const otherVehicles = vehicles.filter((v) => v.id !== excludeVehicleId);
  const allStats = await Promise.all(otherVehicles.map(async (v) => ({ v, s: await vehicleCarStats(v.id) })));
  const hasData = (o: CarStats) => o.fuelPer100 != null || o.maintCostPerKm != null;
  const sameBox = transmission ? allStats.filter((x) => x.v.transmission === transmission) : [];
  const gearboxMatched = !!transmission && sameBox.filter((x) => hasData(x.s)).length >= MIN_GEARBOX_PEERS;
  const others = (gearboxMatched ? sameBox : allStats).map((x) => x.s);
  const withData = others.filter(hasData);

  return {
    carModel: carModel ? { id: carModel.id, make: carModel.make, model: carModel.model } : null,
    gearbox: transmission ?? null,
    gearboxMatched,
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
