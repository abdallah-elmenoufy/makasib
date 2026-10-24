"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Card, CardHead, Delta, Empty, PageTitle, Segmented, Table } from "@/components/ui";
import { Icon } from "@/components/icons";
import { BarChart } from "@/components/charts";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtInt, fmtMoney, fmtMoneyShort, sep } from "@/lib/format";

// Months and years: the long view the weekly page can't give — which months
// pay, how this year compares with last. Same engine as the income statement.

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function useYear(vehicleId: string | undefined, year: number) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!vehicleId) return;
    setData(null);
    const now = new Date();
    const to = year === now.getFullYear() ? now : new Date(year, 11, 31);
    fetch(`/api/income?from=${year}-01-01&to=${ymd(to)}&vehicleId=${vehicleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [vehicleId, year]);
  return data;
}

export default function MonthsPage() {
  const { t, locale } = useI18n();
  const { vehicle } = useVehicle();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const data = useYear(vehicle?.id, year);
  const prev = useYear(vehicle?.id, year - 1);
  const money = (n: number) => fmtMoney(Math.round(n), locale);
  const intl = locale === "ar" ? "ar-EG" : "en-GB";
  const monthName = (key: string, style: "long" | "short" = "long") => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(intl, { month: style }).format(new Date(y, m - 1, 1));
  };

  const view = useMemo(() => {
    if (!data) return null;
    const months: any[] = data.months.filter((m: any) => m.trips > 0 || m.income > 0);
    const prevBy = new Map<string, any>((prev?.months ?? []).filter((m: any) => m.trips > 0 || m.income > 0).map((m: any) => [m.key.slice(5), m]));
    // last year over the same months, so a half-finished year compares fairly
    const same = months.map((m) => prevBy.get(m.key.slice(5))).filter(Boolean);
    const lastYearSame = same.length ? same.reduce((s: number, m: any) => s + m.trueProfit, 0) : null;
    const best = months.reduce((b: any, m: any) => (!b || m.trueProfit > b.trueProfit ? m : b), null);
    const worst = months.length > 1 ? months.reduce((b: any, m: any) => (!b || m.trueProfit < b.trueProfit ? m : b), null) : null;
    return { months, lastYearSame, best, worst, prevBy };
  }, [data, prev]);

  return (
    <div className="space-y-4">
      <PageTitle sub={t("mo.subtitle")} actions={<Link href="/weeks" className="text-sm font-bold text-action inline-flex items-center gap-1">{t("nav.weeks")} <Icon name="chevron" size={16} className="rtl:rotate-180" /></Link>}>
        {t("mo.title")}
      </PageTitle>
      <Segmented value={String(year)} onChange={(v) => setYear(Number(v))} options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({ value: String(y), label: new Intl.NumberFormat(intl, { useGrouping: false }).format(y) }))} />

      {!view ? (
        <Card><Empty>{t("inc.loading")}</Empty></Card>
      ) : view.months.length === 0 ? (
        <Card><Empty>{t("mo.empty")}</Empty></Card>
      ) : (
        <>
          <Card tone="ink" className="text-hero-fg">
            <div className="text-sm font-bold opacity-80">{t("mo.yearProfit", { year: new Intl.NumberFormat(intl, { useGrouping: false }).format(year) })}</div>
            <div className="text-[44px] md:text-[56px] font-bold display leading-[1.02] mt-2">{money(data.total.trueProfit)}</div>
            <div className="text-sm opacity-80 mt-2">
              {fmtInt(data.total.trips, locale)} {t("inc.tripsWord")}{sep(locale)}
              {fmtInt(Math.round(data.total.hours), locale)} {t("inc.hoursWord")}
              {data.total.hours > 0 && <>{sep(locale)}{t("mo.perHour", { v: money(data.total.trueProfit / data.total.hours) })}</>}
            </div>
            {view.lastYearSame != null && (
              <div className="text-sm mt-3">
                {t("mo.vsLastYear")} <Delta value={data.total.trueProfit - view.lastYearSame} fmt={money} />
              </div>
            )}
          </Card>

          <Card>
            <CardHead icon="chart" title={t("mo.byMonth")} sub={t("mo.byMonthSub")} />
            <BarChart
              locale={locale}
              fmt={(v) => fmtMoneyShort(v, locale)}
              bars={view.months.map((m: any) => {
                const p = view.prevBy.get(m.key.slice(5));
                return { key: m.key, label: monthName(m.key, "short"), value: m.trueProfit, sub: p ? t("mo.lastYearSub", { v: money(p.trueProfit) }) : undefined };
              })}
            />
            {view.best && view.worst && view.best.key !== view.worst.key && (
              <p className="text-sm mt-3 leading-relaxed">
                {t("mo.bestWorst", { best: monthName(view.best.key), bv: money(view.best.trueProfit), worst: monthName(view.worst.key), wv: money(view.worst.trueProfit) })}
              </p>
            )}
          </Card>

          <Card>
            <CardHead icon="grid" title={t("mo.table")} />
            <Table head={[t("inc.month"), t("mo.profit"), t("inc.income"), t("mo.costs"), t("inc.trips"), t("mo.perHourCol")]}>
              {view.months.map((m: any) => (
                <tr key={m.key}>
                  <td className="py-2 px-2 font-bold">{monthName(m.key)}</td>
                  <td className={`py-2 px-2 tnum font-bold ${m.trueProfit < 0 ? "text-loss" : "text-money"}`}>{money(m.trueProfit)}</td>
                  <td className="py-2 px-2 tnum">{money(m.income)}</td>
                  <td className="py-2 px-2 tnum">{money(m.income - m.trueProfit)}</td>
                  <td className="py-2 px-2 tnum">{fmtInt(m.trips, locale)}</td>
                  <td className="py-2 px-2 tnum">{m.hours > 0 ? money(m.trueProfit / m.hours) : "—"}</td>
                </tr>
              ))}
            </Table>
            <p className="text-xs text-muted mt-3">{t("mo.note")}</p>
          </Card>
          <Link href="/income" className="flex items-center justify-between rounded-2xl bg-sheet border border-line px-4 h-14 font-bold text-sm">
            <span className="inline-flex items-center gap-2"><Icon name="wallet" size={18} /> {t("mo.toIncome")}</span>
            <Icon name="chevron" size={16} className="rtl:rotate-180" />
          </Link>
        </>
      )}
    </div>
  );
}
