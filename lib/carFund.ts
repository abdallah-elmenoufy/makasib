// The car set-aside fund: every km wears the car a little, and the bill
// arrives all at once (tyres, clutch, a big service). Putting the wear aside
// weekly turns a 6,000 EGP shock into a line item. Pure — the numbers come
// from the per-km rates the rest of the app already uses.

export type FundInput = {
  maintPerKm: number;
  depPerKm: number;
  depreciationOn: boolean;
  /** Business km this week so far, and in the last closed week. */
  weekKm: number;
  lastWeekKm: number | null;
  /** All km (work and personal) per week, recent average — parts wear on every km. */
  avgWeeklyKm: number | null;
  /** In-service parts with an interval and a known last cost. */
  upcoming: { label: string; kmRemaining: number; cost: number }[];
};

export type FundPlan = {
  /** Maintenance wear to put aside. */
  thisWeek: number;
  lastWeek: number | null;
  /** The car losing value — only when depreciation is switched on. */
  replacementThisWeek: number | null;
  nextBill: { label: string; cost: number; kmRemaining: number; weeks: number | null } | null;
  /** Everything expected in the next eight weeks, so the driver sees the lump. */
  dueIn8Weeks: number;
};

export function carFund(f: FundInput): FundPlan {
  const weeksTo = (km: number) => (f.avgWeeklyKm && f.avgWeeklyKm > 0 ? Math.max(0, km) / f.avgWeeklyKm : null);
  const ahead = f.upcoming.filter((u) => u.cost > 0).sort((a, b) => a.kmRemaining - b.kmRemaining);
  const next = ahead[0] ?? null;
  return {
    thisWeek: f.maintPerKm * f.weekKm,
    lastWeek: f.lastWeekKm != null ? f.maintPerKm * f.lastWeekKm : null,
    replacementThisWeek: f.depreciationOn ? f.depPerKm * f.weekKm : null,
    nextBill: next ? { label: next.label, cost: next.cost, kmRemaining: next.kmRemaining, weeks: weeksTo(next.kmRemaining) } : null,
    dueIn8Weeks: ahead.filter((u) => (weeksTo(u.kmRemaining) ?? Infinity) <= 8).reduce((s, u) => s + u.cost, 0),
  };
}
