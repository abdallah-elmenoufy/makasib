import type { Vehicle } from "@prisma/client";

// Depreciation: three methods, one master switch.
//
// The previous straight-line model (purchase price ÷ the km of life the car had
// left) produced ~1.2–1.5 EGP/km on a typical Egyptian ride-hailing car. That
// is arithmetically what "using up" the whole car costs, but it is NOT what a
// driver who already owns the car for personal use actually loses by driving
// for Uber: the car loses value with every passing year whether or not it
// moves (age, model year, the market) and the driver would carry that loss
// anyway. Only the *extra* resale loss caused by the extra kilometres belongs
// on the ride-hailing bill. Charging the full straight-line amount makes a
// profitable week look like a loss and quietly tells a driver to quit.
//
// MILEAGE (default) — the marginal cost of a km on the car's resale price:
//   a buyer knocks a share of the car's CURRENT value off for every 10,000 km
//   on the clock. That share is the "mileage sensitivity" (default 1.0% per
//   10,000 km, tunable per car). A 500k EGP car → 0.50 EGP/km; a 250k car →
//   0.25 EGP/km. Tied to today's market value (what the driver would actually
//   get), not to a historical price.
//
// LIFETIME — the previous straight-line model, kept for drivers who treat the
//   car as a pure work asset they will run into the ground and replace:
//   (purchase price − 15% residual) ÷ (service life − odometer when bought).
//
// MANUAL — a per-km figure the driver types.
//
// `depreciationEnabled = false` keeps the rate visible in the UI (as "what it
// would cost") but removes it from every profit figure in the app.

/** Typical total service life in km before a car is uneconomic to keep. */
export const DEFAULT_LIFETIME_KM = 400_000;
/** Share of the purchase price still recoverable at end of useful life. */
export const RESIDUAL_RATIO = 0.15;
/** Floor so a car already at/past its nominal life still gets a sane rate. */
const MIN_REMAINING_KM = 30_000;

/** MILEAGE method: % of current market value lost per 10,000 km. */
export const DEFAULT_MILEAGE_SENSITIVITY_PCT = 1.0;
export const MILEAGE_SENSITIVITY_BLOCK_KM = 10_000;

/** Rate used for the *market value* estimate when no estimatedValue is typed. */
export const ANNUAL_DEPRECIATION_RATE = 0.15;
export const VALUE_FLOOR_RATIO = 0.3;

export type DepreciationMethod = "MILEAGE" | "LIFETIME" | "MANUAL";
export const DEPRECIATION_METHODS: DepreciationMethod[] = ["MILEAGE", "LIFETIME", "MANUAL"];

export function estimateCurrentValue(vehicle: Vehicle, now = new Date()): number | null {
  if (vehicle.estimatedValue != null && vehicle.estimatedValue > 0) return vehicle.estimatedValue;
  if (vehicle.purchasePrice == null || vehicle.purchasePrice <= 0) return null;
  const age = vehicle.year != null ? Math.max(0, now.getFullYear() - vehicle.year) : 0;
  const aged = vehicle.purchasePrice * Math.pow(1 - ANNUAL_DEPRECIATION_RATE, age);
  return Math.max(aged, vehicle.purchasePrice * VALUE_FLOOR_RATIO);
}

export type DepreciationBasis = {
  /** EGP/km actually charged to profit — 0 when the switch is off. */
  perKm: number;
  /** What the chosen method computes, regardless of the switch. */
  rawPerKm: number;
  enabled: boolean;
  method: DepreciationMethod;
  /** Where the money figure came from. */
  source: "manual" | "purchase" | "estimated" | "none";
  basisValue: number | null;
  /** MILEAGE inputs */
  sensitivityPct: number;
  mileagePerKm: number | null;
  /** LIFETIME inputs */
  lifetimeKm: number;
  remainingKmAtAcquisition: number | null;
  lifetimePerKm: number | null;
};

function methodOf(vehicle: Vehicle): DepreciationMethod {
  const m = (vehicle as { depreciationMethod?: string }).depreciationMethod;
  if (m === "LIFETIME" || m === "MANUAL") return m;
  // a manual override typed before the method field existed still wins
  if (m !== "MILEAGE" && vehicle.depreciationPerKm != null) return "MANUAL";
  return "MILEAGE";
}

/** Every method's rate side by side, so the UI can show its working. */
export function depreciationBasis(vehicle: Vehicle): DepreciationBasis {
  const method = methodOf(vehicle);
  const enabled = (vehicle as { depreciationEnabled?: boolean }).depreciationEnabled !== false;
  const lifetimeKm = vehicle.lifetimeKm && vehicle.lifetimeKm > 0 ? vehicle.lifetimeKm : DEFAULT_LIFETIME_KM;
  const sensitivityPct =
    vehicle.mileageSensitivityPct != null && vehicle.mileageSensitivityPct > 0
      ? vehicle.mileageSensitivityPct
      : DEFAULT_MILEAGE_SENSITIVITY_PCT;

  const hasPurchase = vehicle.purchasePrice != null && vehicle.purchasePrice > 0;
  const currentValue = estimateCurrentValue(vehicle);

  // LIFETIME — what the purchase price bought, spread over the km it bought
  let lifetimePerKm: number | null = null;
  let remaining: number | null = null;
  const lifetimeBasis = hasPurchase ? vehicle.purchasePrice! : currentValue;
  if (lifetimeBasis != null) {
    remaining = Math.max(lifetimeKm - (vehicle.initialOdometer ?? 0), MIN_REMAINING_KM);
    lifetimePerKm = (lifetimeBasis * (1 - RESIDUAL_RATIO)) / remaining;
  }

  // MILEAGE — marginal resale loss per km at today's value
  const mileagePerKm =
    currentValue != null ? (currentValue * (sensitivityPct / 100)) / MILEAGE_SENSITIVITY_BLOCK_KM : null;

  let rawPerKm = 0;
  let source: DepreciationBasis["source"] = "none";
  let basisValue: number | null = null;
  if (method === "MANUAL") {
    rawPerKm = vehicle.depreciationPerKm ?? 0;
    source = vehicle.depreciationPerKm != null ? "manual" : "none";
  } else if (method === "LIFETIME") {
    rawPerKm = lifetimePerKm ?? 0;
    basisValue = lifetimeBasis;
    source = lifetimeBasis == null ? "none" : hasPurchase ? "purchase" : "estimated";
  } else {
    rawPerKm = mileagePerKm ?? 0;
    basisValue = currentValue;
    source =
      currentValue == null
        ? "none"
        : vehicle.estimatedValue != null && vehicle.estimatedValue > 0
          ? "estimated"
          : "purchase";
  }

  return {
    perKm: enabled ? rawPerKm : 0,
    rawPerKm,
    enabled,
    method,
    source,
    basisValue,
    sensitivityPct,
    mileagePerKm,
    lifetimeKm,
    remainingKmAtAcquisition: remaining,
    lifetimePerKm,
  };
}

/** EGP per km charged to profit (0 when depreciation is switched off). */
export function estimateDepPerKm(vehicle: Vehicle): number {
  return depreciationBasis(vehicle).perKm;
}

/** Annualized km from the vehicle's odometer history; null while too little data. */
export function annualizedKm(totalKm: number, sinceDate: Date, now = new Date()): number | null {
  const days = (now.getTime() - new Date(sinceDate).getTime()) / 86_400_000;
  if (days < 14 || totalKm <= 0) return null;
  return (totalKm / days) * 365;
}
