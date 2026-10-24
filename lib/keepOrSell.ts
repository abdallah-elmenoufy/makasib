import "server-only";
import { prisma } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { depreciationBasis, estimateCurrentValue } from "@/lib/depreciation";
import { keepOrSell, type KeepResult } from "@/lib/keepOrSellRules";

export type KeepOrSell = KeepResult & { value: number | null; valueIsEstimate: boolean; monthlyProfit: number | null; monthlyKm: number; months: number };

const DAY = 86_400_000;

/** Gather the driver's own numbers for the keep-or-sell card (lib/keepOrSellRules). */
export async function getKeepOrSell(vehicleId: string, now = new Date()): Promise<KeepOrSell> {
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  const recent = await getAnalytics(vehicleId, { from: new Date(now.getTime() - 91 * DAY), to: now });
  const value = estimateCurrentValue(vehicle, now);
  const dep = depreciationBasis(vehicle);

  // months actually worked in the window, so a new car isn't averaged over empty months
  const activeDays = recent.counts.daysActive ?? 0;
  const months = Math.min(3, Math.max(activeDays / 30.4, activeDays > 0 ? 0.5 : 0));
  const depCharged = recent.costs.depreciation;
  const monthlyProfit = months > 0 ? (recent.trueProfit + depCharged) / months : null;
  const monthlyKm = months > 0 ? recent.kmSplit.periodTotalKm / months : 0;

  const maint = await prisma.maintenance.findMany({ where: { vehicleId, date: { gte: new Date(now.getTime() - 730 * DAY) } }, select: { date: true, cost: true, odometer: true } });
  const perKm = (from: number, to: number) => {
    const rows = maint.filter((m) => m.date.getTime() >= now.getTime() - from * DAY && m.date.getTime() < now.getTime() - to * DAY);
    const odos = rows.map((m) => m.odometer).filter((o): o is number => o != null && o > 0);
    const km = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0;
    return km > 1000 ? rows.reduce((s, m) => s + m.cost, 0) / km : null;
  };

  const res = keepOrSell({
    value,
    monthlyProfit,
    monthlyKm,
    depPerKm: dep.rawPerKm,
    maintPerKmRecent: perKm(365, 0),
    maintPerKmBefore: perKm(730, 365),
    parts: recent.reminders
      .filter((r) => r.source === "service" && r.kmRemaining != null && r.intervalKm && r.lastCost)
      .map((r) => ({ label: r.category ?? "", kmRemaining: r.kmRemaining!, intervalKm: r.intervalKm!, cost: r.lastCost! })),
  });
  return { ...res, value, valueIsEstimate: !(vehicle.estimatedValue && vehicle.estimatedValue > 0), monthlyProfit, monthlyKm, months };
}
