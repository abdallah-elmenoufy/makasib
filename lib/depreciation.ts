import type { Vehicle } from "@prisma/client";

// Automatic depreciation, so drivers never have to invent a number.
//
// Method: declining balance — the industry standard for vehicles (used by
// AAA cost-of-ownership tables and most fleet calculators). A car loses a
// roughly constant *percentage* of its current value each year, not a
// constant amount; the curve flattens as the car ages, which matches used
// markets (incl. Egypt) far better than straight-line.
//
//   annual depreciation = current value × rate
//   per-km depreciation = annual depreciation / annual km driven
//
// Current value: the driver's estimate if provided, else derived from the
// purchase price aged from the model year, floored at 30% of purchase
// (working cars never depreciate to zero). Manual depreciationPerKm always
// overrides everything.

export const ANNUAL_DEPRECIATION_RATE = 0.15;
export const VALUE_FLOOR_RATIO = 0.3;
export const FALLBACK_ANNUAL_KM = 30_000; // typical full-time ride-hailing floor

export function estimateCurrentValue(vehicle: Vehicle, now = new Date()): number | null {
  if (vehicle.estimatedValue != null && vehicle.estimatedValue > 0) return vehicle.estimatedValue;
  if (vehicle.purchasePrice == null || vehicle.purchasePrice <= 0) return null;
  const age = vehicle.year != null ? Math.max(0, now.getFullYear() - vehicle.year) : 0;
  const aged = vehicle.purchasePrice * Math.pow(1 - ANNUAL_DEPRECIATION_RATE, age);
  return Math.max(aged, vehicle.purchasePrice * VALUE_FLOOR_RATIO);
}

/**
 * EGP per km. `observedAnnualKm` comes from the vehicle's own logged data
 * (annualized odometer span) and self-corrects as more data arrives.
 */
export function estimateDepPerKm(vehicle: Vehicle, observedAnnualKm: number | null): number {
  if (vehicle.depreciationPerKm != null) return vehicle.depreciationPerKm; // manual override
  const value = estimateCurrentValue(vehicle);
  if (value == null) return 0; // nothing to base it on — nudge the driver in UI
  const annualKm = Math.min(Math.max(observedAnnualKm ?? FALLBACK_ANNUAL_KM, 5_000), 120_000);
  return (value * ANNUAL_DEPRECIATION_RATE) / annualKm;
}

/** Annualized km from the vehicle's odometer history; null while too little data. */
export function annualizedKm(totalKm: number, sinceDate: Date, now = new Date()): number | null {
  const days = (now.getTime() - new Date(sinceDate).getTime()) / 86_400_000;
  if (days < 14 || totalKm <= 0) return null;
  return (totalKm / days) * 365;
}
