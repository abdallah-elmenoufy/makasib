// Keep or sell? Not a price guess — the driver's own numbers, laid out so
// the decision is theirs: what another year of this car earns, what it
// loses in value, the repairs already on the horizon, and whether its
// running cost per km is climbing. Pure, so the rules are testable.

export type KeepInput = {
  value: number | null;
  /** Profit before depreciation, per month, over the last three months. */
  monthlyProfit: number | null;
  /** All km per month, last three months. */
  monthlyKm: number;
  depPerKm: number;
  /** Maintenance spend per km: last 12 months and the 12 before. */
  maintPerKmRecent: number | null;
  maintPerKmBefore: number | null;
  /** In-service parts with an interval and a last cost. */
  parts: { label: string; kmRemaining: number; intervalKm: number; cost: number }[];
};

export type KeepVerdict = "keep" | "watch" | "sell";

export type KeepResult = {
  yearEarnings: number | null;
  yearValueLoss: number | null;
  valueInAYear: number | null;
  repairs: { label: string; cost: number; times: number }[];
  repairsTotal: number;
  maintRise: number | null;
  verdict: KeepVerdict;
  reasons: string[];
};

/** Maintenance up this much per km, year on year, is worth a look. */
export const MAINT_RISE_WATCH = 0.3;
/** Classic rule of thumb: a year's known repairs past half the car's value. */
export const REPAIRS_SELL_SHARE = 0.5;

export function keepOrSell(k: KeepInput): KeepResult {
  const yearKm = k.monthlyKm * 12;
  const repairs = k.parts
    .filter((p) => p.cost > 0 && p.intervalKm > 0 && p.kmRemaining < yearKm)
    .map((p) => ({ label: p.label, cost: p.cost, times: 1 + Math.floor((yearKm - Math.max(0, p.kmRemaining)) / p.intervalKm) }))
    .map((r) => ({ ...r, times: Math.max(1, r.times) }))
    .sort((a, b) => b.cost * b.times - a.cost * a.times);
  const repairsTotal = repairs.reduce((s, r) => s + r.cost * r.times, 0);
  const yearValueLoss = k.value != null ? Math.min(k.value, k.depPerKm * yearKm) : null;
  const yearEarnings = k.monthlyProfit != null ? k.monthlyProfit * 12 : null;
  const maintRise = k.maintPerKmRecent != null && k.maintPerKmBefore != null && k.maintPerKmBefore > 0 ? k.maintPerKmRecent / k.maintPerKmBefore - 1 : null;

  const reasons: string[] = [];
  let verdict: KeepVerdict = "keep";
  if (yearEarnings != null && yearValueLoss != null && yearEarnings - yearValueLoss <= 0) {
    verdict = "sell";
    reasons.push("losesMoney");
  }
  if (k.value != null && k.value > 0 && repairsTotal > k.value * REPAIRS_SELL_SHARE) {
    verdict = "sell";
    reasons.push("repairsVsValue");
  }
  if (verdict !== "sell" && maintRise != null && maintRise >= MAINT_RISE_WATCH) {
    verdict = "watch";
    reasons.push("maintRising");
  }
  if (verdict !== "sell" && yearEarnings != null && repairsTotal > yearEarnings / 4) {
    verdict = "watch";
    reasons.push("repairsHeavy");
  }
  if (verdict === "keep") reasons.push("paysItsWay");
  return { yearEarnings, yearValueLoss, valueInAYear: k.value != null && yearValueLoss != null ? k.value - yearValueLoss : null, repairs, repairsTotal, maintRise, verdict, reasons };
}
