"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Card, Empty, PageTitle } from "@/components/ui";
import { useVehicle } from "@/components/useCrud";
import { fmtMoney, fmtNum } from "@/lib/format";

// chart chrome + series colors from the validated reference palette (light mode)
const C = {
  pos: "#2a78d6", // series-1 blue
  neg: "#e34948", // diverging red pole
  dead: "#eda100", // series-3 yellow (labeled — relief rule)
  personal: "#c3c2b7", // neutral
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  goodText: "#006300",
  critical: "#d03b3b",
};

const PERIODS = ["today", "week", "month", "all"] as const;
const PERIOD_KEY: Record<string, string> = {
  today: "c.today",
  week: "c.thisWeek",
  month: "c.thisMonth",
  all: "c.allTime",
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("week");
  const [a, setA] = useState<any>(null);

  useEffect(() => {
    if (vehicle) {
      fetch(`/api/analytics?vehicleId=${vehicle.id}&period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setA);
    }
  }, [vehicle, period]);

  if (vLoading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/vehicle" className="text-emerald-600 underline">
          {t("db.noVehicle")}
        </Link>
      </Empty>
    );
  }
  if (!a) return null;

  const money = (n: number) => fmtMoney(n, locale);
  const profitColor = a.trueProfit >= 0 ? C.goodText : C.critical;
  const attention = a.reminders.filter((r: any) => r.state !== "ok");

  const costRows = [
    { key: "db.fuelCost", v: a.costs.fuel },
    { key: "db.maintCost", v: a.costs.maintenance },
    { key: "db.expenses", v: a.costs.workExpenses },
    { key: "db.depreciation", v: a.costs.depreciation },
    { key: "db.rental", v: a.costs.ownership },
  ].filter((r) => r.v > 0.005);
  const maxCost = Math.max(...costRows.map((r) => r.v), 1);

  const km = a.kmSplit;
  const kmTotal = Math.max(km.tripKm + km.deadKm + km.personalKm, 0.001);

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  period === p ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t(PERIOD_KEY[p])}
              </button>
            ))}
          </div>
        }
      >
        {t("db.title")}
      </PageTitle>

      {/* hero + stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="col-span-2">
          <div className="text-xs font-semibold text-slate-500">{t("db.trueProfit")}</div>
          <div className="text-4xl font-black mt-1" style={{ color: profitColor }}>
            {money(a.trueProfit)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{t("db.profitSub")}</div>
        </Card>
        <StatTile label={t("db.gross")} value={money(a.earnings.netRevenue)} sub={t("db.grossSub")} />
        <div className="grid grid-rows-2 gap-3">
          <MiniTile label={t("db.perHour")} value={a.perHour != null ? money(a.perHour) : "—"} />
          <MiniTile label={t("db.perKm")} value={a.perKm != null ? money(a.perKm) : "—"} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniTile label={t("db.hoursWorked")} value={fmtNum(a.counts.hoursWorked, locale)} />
        <MiniTile label={t("db.shiftCount")} value={String(a.counts.shifts)} />
        <MiniTile label={t("db.tripCount")} value={String(a.counts.trips)} />
        <MiniTile label={t("veh.currentOdo")} value={`${fmtNum(a.currentOdo, locale)} ${t("c.km")}`} />
      </div>

      {/* daily profit + costs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <div className="text-sm font-semibold mb-3">{t("db.profitTrend")} (14d)</div>
          <ProfitBars data={a.trend} locale={locale} />
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-3">{t("db.costs")}</div>
          {costRows.length === 0 ? (
            <Empty>{t("c.noData")}</Empty>
          ) : (
            <div className="space-y-2">
              {costRows.map((r) => (
                <div key={r.key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-500">{t(r.key)}</span>
                    <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(r.v)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(r.v / maxCost) * 100}%`, background: C.pos }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs pt-2 border-t border-slate-100 font-bold">
                <span>Σ</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(a.costs.total)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* km split + fuel economy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <div className="text-sm font-semibold mb-3">{t("db.kmSplit")}</div>
          <div className="flex h-6 rounded-lg overflow-hidden" style={{ gap: 2 }}>
            {[
              { v: km.tripKm, c: C.pos },
              { v: km.deadKm, c: C.dead },
              { v: km.personalKm, c: C.personal },
            ].map(
              (s, i) =>
                s.v > 0 && (
                  <div key={i} style={{ width: `${(s.v / kmTotal) * 100}%`, background: s.c }} />
                )
            )}
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <LegendRow color={C.pos} label={t("db.tripKm")} value={`${fmtNum(km.tripKm, locale)} ${t("c.km")}`} />
            <LegendRow color={C.dead} label={t("db.deadKm")} value={`${fmtNum(km.deadKm, locale)} ${t("c.km")}`} />
            {km.pickupKm > 0 && (
              <>
                <div className="ps-5 flex items-center gap-2 text-slate-400">
                  <span className="flex-1">{t("db.pickupSplit")}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(km.pickupKm, locale)} {t("c.km")}
                  </span>
                </div>
                <div className="ps-5 flex items-center gap-2 text-slate-400">
                  <span className="flex-1">{t("db.cruisingSplit")}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(km.cruisingKm, locale)} {t("c.km")}
                  </span>
                </div>
              </>
            )}
            <LegendRow
              color={C.personal}
              label={t("db.personalKm")}
              value={`${fmtNum(km.personalKm, locale)} ${t("c.km")}`}
            />
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold mb-3">{t("db.fuelEconomy")}</div>
          {a.fuelEconomy.length === 0 ? (
            <Empty>{t("fu.fullTankHint")}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {a.fuelEconomy.map((f: any) => {
                const unit = f.unit === "m3" ? t("c.m3") : t("c.liters");
                return (
                  <div key={f.fuelGroup} className="border border-slate-100 rounded-lg p-3">
                    <div className="text-xs font-bold text-slate-600 mb-2">
                      {f.fuelGroup === "CNG" ? t("fu.CNG") : t("veh.fuel.PETROL").split(" ")[0]}
                    </div>
                    <div className="text-2xl font-black">
                      {fmtNum(f.per100, locale)}
                      <span className="text-xs font-semibold text-slate-400"> {unit} {t("db.l100")}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {fmtNum(f.kmPerUnit, locale)} {t("c.km")} / {unit}
                    </div>
                    <div className="text-xs text-slate-500">
                      {money(f.costPerKm)} / {t("c.km")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* cash reconciliation */}
      <Card>
        <div className="text-sm font-semibold mb-3">{t("db.cash")}</div>
        {a.cash.byPlatform.length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-200">
                  <th className="text-start py-1.5 px-2 font-semibold">{t("tr.platform")}</th>
                  <th className="text-start py-1.5 px-2 font-semibold">{t("db.youOwe")}</th>
                  <th className="text-start py-1.5 px-2 font-semibold">{t("db.owesYou")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.cash.byPlatform.map((p: any) => (
                  <tr key={p.platform}>
                    <td className="py-1.5 px-2 font-semibold">{t(`pf.${p.platform}`)}</td>
                    <td className="py-1.5 px-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(p.oweToPlatform)}
                    </td>
                    <td className="py-1.5 px-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(p.platformOwes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center py-2">
              <div className="text-xs font-semibold text-slate-500">{t("db.cashNet")}</div>
              <div
                className="text-3xl font-black mt-1"
                style={{ color: a.cash.totals.net >= 0 ? C.goodText : C.critical }}
              >
                {money(a.cash.totals.net)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {a.cash.totals.net >= 0 ? t("db.cashNetHintGet") : t("db.cashNetHintOwe")}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* reminders needing attention */}
      {attention.length > 0 && (
        <Card className="border-amber-200">
          <div className="text-sm font-semibold mb-2">🔔 {t("db.remindersDue")}</div>
          <div className="space-y-1">
            {attention.map((r: any) => (
              <Link
                key={r.reminder.id}
                href="/reminders"
                className="flex items-center gap-2 text-sm hover:bg-slate-50 rounded px-2 py-1"
              >
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    r.state === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.state === "overdue" ? t("rm.overdue") : t("rm.dueSoon")}
                </span>
                <span className="font-semibold">{r.reminder.title}</span>
                {r.kmRemaining != null && (
                  <span className="text-xs text-slate-400">
                    {r.kmRemaining >= 0
                      ? t("rm.inKm", { n: fmtNum(r.kmRemaining, locale) })
                      : t("rm.kmOverdue", { n: fmtNum(-r.kmRemaining, locale) })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </Card>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-slate-500 flex-1">{label}</span>
      <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

/** 14-day profit bar chart: blue above zero, red below, hover tooltip per bar. */
function ProfitBars({ data, locale }: { data: { date: string; profit: number; gross: number }[]; locale: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; d: (typeof data)[number] } | null>(null);
  const W = 440;
  const H = 160;
  const PAD = { top: 8, bottom: 18, left: 6, right: 6 };
  const max = Math.max(...data.map((d) => d.profit), 1);
  const min = Math.min(...data.map((d) => d.profit), 0);
  const span = max - min || 1;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / span) * plotH;
  const zeroY = y(0);
  const bw = (W - PAD.left - PAD.right) / data.length;
  const barW = Math.min(bw * 0.55, 18);

  // rounded end away from the baseline, square end anchored at zero
  const barPath = (cx: number, v: number) => {
    const x0 = cx - barW / 2;
    const r = Math.min(4, barW / 2);
    const yv = y(v);
    const h = Math.abs(zeroY - yv);
    if (h < 0.5) return "";
    if (v >= 0)
      return `M${x0},${zeroY} L${x0},${yv + r} Q${x0},${yv} ${x0 + r},${yv} L${x0 + barW - r},${yv} Q${x0 + barW},${yv} ${x0 + barW},${yv + r} L${x0 + barW},${zeroY} Z`;
    return `M${x0},${zeroY} L${x0},${yv - r} Q${x0},${yv} ${x0 + r},${yv} L${x0 + barW - r},${yv} Q${x0 + barW},${yv} ${x0 + barW},${yv - r} L${x0 + barW},${zeroY} Z`;
  };

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[max, max / 2].map(
          (g, i) =>
            g > 0 && (
              <line key={i} x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke={C.grid} strokeWidth="1" />
            )
        )}
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke={C.axis} strokeWidth="1" />
        {data.map((d, i) => {
          const cx = PAD.left + bw * i + bw / 2;
          return (
            <g key={d.date}>
              <path d={barPath(cx, d.profit)} fill={d.profit >= 0 ? C.pos : C.neg} />
              {/* hover hit target wider than the mark */}
              <rect
                x={PAD.left + bw * i}
                y={PAD.top}
                width={bw}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setTip({ x: (cx / W) * 100, y: 0, d })}
                onMouseLeave={() => setTip(null)}
              />
              {i % 2 === 0 && (
                <text
                  x={cx}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill={C.muted}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {d.date.slice(5).replace("-", "/")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tip && (
        <div
          className="absolute top-0 -translate-x-1/2 bg-white border border-slate-200 shadow-md rounded-lg px-2.5 py-1.5 text-xs pointer-events-none z-10"
          style={{ left: `${tip.x}%` }}
        >
          <div className="text-slate-400" style={{ fontVariantNumeric: "tabular-nums" }}>
            {tip.d.date}
          </div>
          <div className="font-bold" style={{ color: tip.d.profit >= 0 ? C.goodText : C.critical }}>
            {fmtMoney(tip.d.profit, locale)}
          </div>
        </div>
      )}
    </div>
  );
}
