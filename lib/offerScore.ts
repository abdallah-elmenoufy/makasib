// Live offer scoring: score an incoming trip-request card against the
// driver's OWN historical true-profit baseline (never a generic/invented
// number — see DOCS.md §5, the whole app is built to avoid guessed figures).
// Pure — no DB, safe to run client-side for speed.

export type OfferInput = {
  fare: number;
  pickupKm: number;
  pickupMin: number;
  tripKm: number;
  tripMin: number;
};

export type OfferBaseline = {
  costPerKm: number; // fuel + maintenance + depreciation per km (a.rates.*)
  profitPerKm: number | null; // driver's own all-time true profit/km
  profitPerHour: number | null; // driver's own all-time true profit/hour
};

export type OfferScore = {
  totalKm: number;
  totalHours: number;
  revenuePerKm: number;
  profitPerKm: number;
  profitPerHour: number;
  verdict: "good" | "ok" | "bad" | "unknown";
  ratioHour: number | null;
};

const GOOD_RATIO = 1.0;
const OK_RATIO = 0.75;

/** Null when the offer has no usable distance/time (can't score honestly). */
export function scoreOffer(offer: OfferInput, baseline: OfferBaseline): OfferScore | null {
  const totalKm = offer.pickupKm + offer.tripKm;
  const totalHours = (offer.pickupMin + offer.tripMin) / 60;
  if (totalKm <= 0 || totalHours <= 0) return null;

  const revenuePerKm = offer.fare / totalKm;
  const profitPerKm = revenuePerKm - baseline.costPerKm;
  const profitPerHour = (profitPerKm * totalKm) / totalHours;

  let verdict: OfferScore["verdict"] = "unknown";
  let ratioHour: number | null = null;
  // profit/hour drives the verdict — time is the driver's scarcer resource
  if (baseline.profitPerHour != null && baseline.profitPerHour > 0) {
    ratioHour = profitPerHour / baseline.profitPerHour;
    verdict = ratioHour >= GOOD_RATIO ? "good" : ratioHour >= OK_RATIO ? "ok" : "bad";
  }

  return { totalKm, totalHours, revenuePerKm, profitPerKm, profitPerHour, verdict, ratioHour };
}
