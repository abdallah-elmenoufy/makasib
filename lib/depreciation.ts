import type { Vehicle } from "@prisma/client";

// Depreciation as a per-km cost of USING the car, not a per-year revaluation.
//
// The previous model charged `current market value × 15% per year ÷ annual km`
// and produced absurd numbers (3–4+ EGP/km, swallowing most of a shift's
// profit). Two separate errors compounded:
//
//  1. It used the car's CURRENT market value as the base. In Egypt nominal
//     used-car prices have risen sharply, so a car bought for 250k EGP may
//     be "worth" 600k today. Charging 15% of 600k bills the driver for value
//     they never lost — they're nominally up, not down.
//  2. It divided by an *annualized* km estimate extrapolated from a short
//     history, so the rate swung wildly with a few weeks of data.
//
// This model instead answers the question a driver actually cares about:
// "how much of the car I paid for do I use up per km?" — historical cost,
// spread straight-line over the km of useful life the car had when acquired.
// Stable, explainable, and it never moves because the used-car market moved.
//
//   consumable value = purchase price − residual at end of life
//   life bought      = lifetimeKm − odometer when acquired
//   depreciation/km  = consumable value ÷ life bought
//
// `Vehicle.depreciationPerKm` (manual override) still wins over all of it,
// and `Vehicle.lifetimeKm` lets a driver tune the expected life for their
// own car instead of accepting the default.

/** Typical total service life in km before a car is uneconomic to keep. */
export const DEFAULT_LIFETIME_KM = 400_000;
/** Share of the purchase price still recoverable at end of useful life. */
export const RESIDUAL_RATIO = 0.15;
/** Floor so a car already at/past its nominal life still gets a sane rate. */
const MIN_REMAINING_KM = 30_000;

/** Rate still used for the *market value* estimate shown on the Cars page —
 *  that's a valuation display, deliberately separate from the cost model. */
export const ANNUAL_DEPRECIATION_RATE = 0.15;
export const VALUE_FLOOR_RATIO = 0.3;

export function estimateCurrentValue(vehicle: Vehicle, now = new Date()): number | null {
  if (vehicle.estimatedValue != null && vehicle.estimatedValue > 0) return vehicle.estimatedValue;
  if (vehicle.purchasePrice == null || vehicle.purchasePrice <= 0) return null;
  const age = vehicle.year != null ? Math.max(0, now.getFullYear() - vehicle.year) : 0;
  const aged = vehicle.purchasePrice * Math.pow(1 - ANNUAL_DEPRECIATION_RATE, age);
  return Math.max(aged, vehicle.purchasePrice * VALUE_FLOOR_RATIO);
}

export type DepreciationBasis = {
  perKm: number;
  /** How the number was reached, so the UI can show its working. */
  source: "manual" | "purchase" | "estimated" | "none";
  basisValue: number | null;
  lifetimeKm: number;
  remainingKmAtAcquisition: number | null;
};

/**
 * Per-km depreciation with the reasoning attached. Prefers what the driver
 * actually paid; falls back to their current-value estimate only when no
 * purchase price exists (better than nothing, still use-based).
 */
export function depreciationBasis(vehicle: Vehicle): DepreciationBasis {
  const lifetimeKm = vehicle.lifetimeKm && vehicle.lifetimeKm > 0 ? vehicle.lifetimeKm : DEFAULT_LIFETIME_KM;

  if (vehicle.depreciationPerKm != null) {
    return { perKm: vehicle.depreciationPerKm, source: "manual", basisValue: null, lifetimeKm, remainingKmAtAcquisition: null };
  }

  const basisValue =
    vehicle.purchasePrice != null && vehicle.purchasePrice > 0
      ? vehicle.purchasePrice
      : estimateCurrentValue(vehicle);
  const source: DepreciationBasis["source"] =
    vehicle.purchasePrice != null && vehicle.purchasePrice > 0 ? "purchase" : basisValue != null ? "estimated" : "none";

  if (basisValue == null) {
    return { perKm: 0, source: "none", basisValue: null, lifetimeKm, remainingKmAtAcquisition: null };
  }

  // km of life the car still had when this driver got it — that's what the
  // purchase price actually bought
  const remaining = Math.max(lifetimeKm - (vehicle.initialOdometer ?? 0), MIN_REMAINING_KM);
  const consumable = basisValue * (1 - RESIDUAL_RATIO);

  return {
    perKm: consumable / remaining,
    source,
    basisValue,
    lifetimeKm,
    remainingKmAtAcquisition: remaining,
  };
}

/** EGP per km driven. */
export function estimateDepPerKm(vehicle: Vehicle): number {
  return depreciationBasis(vehicle).perKm;
}

/** Annualized km from the vehicle's odometer history; null while too little data.
 *  No longer feeds the depreciation rate (that's odometer-based now) — kept for
 *  the Cars-page valuation display and usage stats. */
export function annualizedKm(totalKm: number, sinceDate: Date, now = new Date()): number | null {
  const days = (now.getTime() - new Date(sinceDate).getTime()) / 86_400_000;
  if (days < 14 || totalKm <= 0) return null;
  return (totalKm / days) * 365;
}
