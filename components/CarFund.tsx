"use client";
import { useMemo } from "react";
import { Card, CardHead } from "./ui";
import { carFund } from "@/lib/carFund";
import { fmtInt, fmtMoney } from "@/lib/format";

type T = (k: string, vars?: Record<string, string | number>) => string;

/** "Put this aside for the car" — the week's wear, and the next bill it pays for. */
export function CarFundCard({ weeks, reminders, t, locale }: { weeks: any; reminders: any[]; t: T; locale: string }) {
  const plan = useMemo(() => {
    if (!weeks?.current) return null;
    const closed = (weeks.weeks as any[]).filter((w) => !w.isCurrent && w.km.totalKm > 0).slice(-8);
    return carFund({
      maintPerKm: weeks.rates.maintCostPerKm,
      depPerKm: weeks.rates.depPerKm,
      depreciationOn: weeks.rates.depreciationEnabled,
      weekKm: weeks.current.km.shiftKm,
      lastWeekKm: weeks.lastClosed ? weeks.lastClosed.km.shiftKm : null,
      avgWeeklyKm: closed.length ? closed.reduce((s, w) => s + w.km.totalKm, 0) / closed.length : null,
      upcoming: reminders
        .filter((r) => r.source === "service" && r.kmRemaining != null && r.lastCost)
        .map((r) => ({ label: t(`mn.cat.${r.category}`), kmRemaining: r.kmRemaining, cost: r.lastCost })),
    });
  }, [weeks, reminders, t]);

  // no wear rate yet (no service with a cost and an interval) — nothing honest to say
  if (!plan || weeks.rates.maintCostPerKm <= 0) return null;
  const money = (n: number) => fmtMoney(Math.round(n), locale);
  const showLast = plan.lastWeek != null && plan.lastWeek > 0 && (weeks.current.progress < 3 / 7 || plan.thisWeek === 0);

  return (
    <Card>
      <CardHead icon="wallet" tint="tint-violet" title={t("fund.title")} sub={t("fund.sub")} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted">{showLast ? t("fund.lastWeek") : t("fund.thisWeek")}</div>
          <div className="text-[34px] font-bold tnum leading-tight">{money(showLast ? plan.lastWeek! : plan.thisWeek)}</div>
          <div className="text-xs text-muted mt-0.5">
            {t("fund.perKm", { rate: fmtMoney(weeks.rates.maintCostPerKm, locale), km: fmtInt(showLast ? weeks.lastClosed.km.shiftKm : weeks.current.km.shiftKm, locale) })}
          </div>
        </div>
        {plan.replacementThisWeek != null && plan.replacementThisWeek > 0 && (
          <div className="text-end">
            <div className="text-xs text-muted">{t("fund.replacement")}</div>
            <div className="text-xl font-bold tnum">{money(plan.replacementThisWeek)}</div>
          </div>
        )}
      </div>
      {plan.nextBill && (
        <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-relaxed">
          <b>{t("fund.nextBill", { item: plan.nextBill.label, cost: money(plan.nextBill.cost) })}</b>{" "}
          <span className="text-muted">
            {plan.nextBill.kmRemaining <= 0
              ? t("fund.dueNow")
              : plan.nextBill.weeks != null
                ? t("fund.inWeeks", { km: fmtInt(plan.nextBill.kmRemaining, locale), w: fmtInt(Math.max(1, Math.round(plan.nextBill.weeks)), locale) })
                : t("fund.inKm", { km: fmtInt(plan.nextBill.kmRemaining, locale) })}
          </span>
          {plan.dueIn8Weeks > plan.nextBill.cost && (
            <div className="text-xs text-muted mt-1">{t("fund.eightWeeks", { total: money(plan.dueIn8Weeks) })}</div>
          )}
        </div>
      )}
    </Card>
  );
}
