import "server-only";
import { prisma } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";

export type IncomeMonth = {
  key: string; // yyyy-mm
  income: number;
  tips: number;
  bonuses: number;
  fuel: number;
  maintenance: number;
  expenses: number;
  ownership: number;
  depreciation: number;
  cashProfit: number;
  trueProfit: number;
  trips: number;
  hours: number;
  km: number;
  days: number;
};

export type IncomeStatement = {
  from: string;
  to: string;
  vehicles: { id: string; name: string; make: string | null; model: string | null; plate: string | null }[];
  months: IncomeMonth[];
  total: IncomeMonth;
  platforms: { platform: string; trips: number; net: number }[];
  /** First and last day anything was logged in the window. */
  firstActivity: string | null;
  lastActivity: string | null;
  generatedAt: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Calendar months covering [from, to). */
function monthsBetween(from: Date, to: Date): { key: string; from: Date; to: Date }[] {
  const out: { key: string; from: Date; to: Date }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  while (new Date(y, m, 1) < to) {
    const start = new Date(Math.max(new Date(y, m, 1).getTime(), from.getTime()));
    const end = new Date(Math.min(new Date(y, m + 1, 1).getTime(), to.getTime()));
    out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, from: start, to: end });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/**
 * A proof-of-income statement: calendar months in the window, every active
 * car (or one), the same profit engine as the rest of the app. Drivers have
 * no payslip; banks, landlords and embassies ask for one.
 */
export async function getIncomeStatement(from: Date, to: Date, vehicleId?: string | null): Promise<IncomeStatement> {
  const vehicles = await prisma.vehicle.findMany({
    where: vehicleId ? { id: vehicleId } : { isActive: true },
    select: { id: true, name: true, make: true, model: true, plate: true },
    orderBy: { createdAt: "asc" },
  });
  const ids = vehicles.map((v) => v.id);
  const months: IncomeMonth[] = [];
  for (const mo of monthsBetween(from, to)) {
    const per = await Promise.all(ids.map((id) => getAnalytics(id, { from: mo.from, to: mo.to })));
    const sum = (f: (a: (typeof per)[number]) => number) => r2(per.reduce((s, a) => s + f(a), 0));
    months.push({
      key: mo.key,
      income: sum((a) => a.earnings.netRevenue),
      tips: sum((a) => a.earnings.tips),
      bonuses: sum((a) => a.earnings.bonuses),
      fuel: sum((a) => a.costs.fuel),
      maintenance: sum((a) => a.costs.maintenance),
      expenses: sum((a) => a.costs.workExpenses),
      ownership: sum((a) => a.costs.ownership),
      depreciation: sum((a) => a.costs.depreciation),
      cashProfit: sum((a) => a.cashProfit),
      trueProfit: sum((a) => a.trueProfit),
      trips: sum((a) => a.counts.trips),
      hours: sum((a) => a.counts.hoursWorked),
      km: sum((a) => a.kmSplit.shiftKm),
      days: sum((a) => a.counts.shiftDays),
    });
  }
  // a bank wants the months the driver actually worked: drop the empty run
  // before the first active month (car added mid-window), keep gaps after it
  let start = from;
  const lead = months.findIndex((m) => m.trips > 0 || m.income > 0);
  if (lead > 0) {
    months.splice(0, lead);
    const [y, m] = months[0].key.split("-").map(Number);
    start = new Date(y, m - 1, 1);
  }
  const keys = Object.keys(months[0] ?? {}).filter((k) => k !== "key") as (keyof Omit<IncomeMonth, "key">)[];
  const total = { key: "total" } as IncomeMonth;
  for (const k of keys) (total as any)[k] = r2(months.reduce((s, m) => s + m[k], 0));

  const trips = await prisma.trip.findMany({ where: { vehicleId: { in: ids }, startTime: { gte: from, lt: to } }, select: { platform: true, fare: true, commission: true, tip: true, startTime: true } });
  const byPlatform = new Map<string, { trips: number; net: number }>();
  for (const t of trips) {
    const p = byPlatform.get(t.platform) ?? { trips: 0, net: 0 };
    p.trips++;
    p.net += t.fare - (t.commission ?? 0) + (t.tip ?? 0);
    byPlatform.set(t.platform, p);
  }
  const times = trips.map((t) => t.startTime.getTime()).sort((a, b) => a - b);
  return {
    from: start.toISOString(),
    to: to.toISOString(),
    vehicles,
    months,
    total,
    platforms: [...byPlatform.entries()].map(([platform, v]) => ({ platform, trips: v.trips, net: r2(v.net) })).sort((a, b) => b.net - a.net),
    firstActivity: times.length ? new Date(times[0]).toISOString() : null,
    lastActivity: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    generatedAt: new Date().toISOString(),
  };
}
