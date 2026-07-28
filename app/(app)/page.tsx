"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { useVehicle } from "@/components/VehicleProvider";
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
  const { vehicle, activeVehicles, loading: vLoading } = useVehicle();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("week");
  const [viewAll, setViewAll] = useState(false);
  const [a, setA] = useState<any>(null);
  const [bench, setBench] = useState<any>(null);
  const [carBench, setCarBench] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (viewAll) {
      fetch(`/api/analytics/profile?period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setProfile);
      return;
    }
    if (vehicle) {
      fetch(`/api/analytics?vehicleId=${vehicle.id}&period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setA);
      fetch(`/api/benchmark?vehicleId=${vehicle.id}&period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setBench);
      fetch(`/api/car-benchmark?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setCarBench);
    }
  }, [vehicle, period, viewAll]);

  if (vLoading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-emerald-600 underline">
          {t("db.noVehicle")}
        </Link>
      </Empty>
    );
  }

  const money = (n: number) => fmtMoney(n, locale);

  if (viewAll) {
    if (!profile) return null;
    const p = profile.totals;
    const profitColor = p.trueProfit >= 0 ? C.goodText : C.critical;
    return (
      <div className="space-y-4">
        <PageTitle
          actions={
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                {PERIODS.map((pr) => (
                  <button
                    key={pr}
                    onClick={() => setPeriod(pr)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      period === pr ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {t(PERIOD_KEY[pr])}
                  </button>
                ))}
              </div>
              <ViewToggle viewAll={viewAll} setViewAll={setViewAll} t={t} />
            </div>
          }
        >
          {t("db.title")}
        </PageTitle>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="col-span-2">
            <div className="text-xs font-semibold text-slate-500">{t("db.trueProfit")}</div>
            <div className="text-4xl font-black mt-1" style={{ color: profitColor }}>
              {money(p.trueProfit)}
            </div>
            <div className="text-xs text-slate-400 mt-1">{t("cars.allCarsSub")}</div>
          </Card>
          <StatTile label={t("db.gross")} value={money(p.earnings.netRevenue)} sub={t("db.grossSub")} />
          <div className="grid grid-rows-2 gap-3">
            <MiniTile label={t("db.perHour")} value={p.perHour != null ? money(p.perHour) : "—"} />
            <MiniTile label={t("db.perKm")} value={p.perKm != null ? money(p.perKm) : "—"} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniTile label={t("db.hoursWorked")} value={fmtNum(p.counts.hoursWorked, locale)} />
          <MiniTile label={t("db.shiftCount")} value={fmtNum(p.counts.shifts, locale, 0)} />
          <MiniTile label={t("db.tripCount")} value={fmtNum(p.counts.trips, locale, 0)} />
          <MiniTile label={t("cars.carCount")} value={fmtNum(profile.perVehicle.length, locale, 0)} />
        </div>

        <Card>
          <div className="text-sm font-semibold mb-3">{t("cars.breakdown")}</div>
          <Table head={[t("veh.name"), t("db.trueProfit"), t("db.perHour"), t("db.perKm"), t("sh.trips")]}>
            {profile.perVehicle.map((v: any) => (
              <tr key={v.vehicle.id}>
                <td className="py-2 px-2 font-semibold">{v.vehicle.name}</td>
                <td
                  className="py-2 px-2"
                  style={{ color: v.trueProfit >= 0 ? C.goodText : C.critical, fontVariantNumeric: "tabular-nums" }}
                >
                  {money(v.trueProfit)}
                </td>
                <td className="py-2 px-2">{v.perHour != null ? money(v.perHour) : "—"}</td>
                <td className="py-2 px-2">{v.perKm != null ? money(v.perKm) : "—"}</td>
                <td className="py-2 px-2">{fmtNum(v.counts.shifts, locale, 0)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    );
  }

  if (!a) return null;

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
          <div className="flex items-center gap-2">
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
            {activeVehicles.length > 1 && <ViewToggle viewAll={viewAll} setViewAll={setViewAll} t={t} />}
          </div>
        }
      >
        {t("db.title")}
      </PageTitle>

      {/* quick actions: what a driver does constantly through a shift */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Link
          href="/shifts"
          className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 rounded-xl px-2 py-3 md:py-4 text-sm md:text-base font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <span className="text-lg md:text-xl">🕐</span>
          <span>{t("nav.shifts")}</span>
        </Link>
        <Link
          href="/score"
          className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 rounded-xl px-2 py-3 md:py-4 text-sm md:text-base font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <span className="text-lg md:text-xl">⚡</span>
          <span>{t("nav.score")}</span>
        </Link>
        <Link
          href="/import"
          className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 rounded-xl px-2 py-3 md:py-4 text-sm md:text-base font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          <span className="text-lg md:text-xl">📥</span>
          <span>{t("nav.import")}</span>
        </Link>
      </div>

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
        <MiniTile label={t("db.shiftCount")} value={fmtNum(a.counts.shifts, locale, 0)} />
        <MiniTile label={t("db.tripCount")} value={fmtNum(a.counts.trips, locale, 0)} />
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
          <p className="text-xs text-slate-400 mb-3">{t("db.fuelEconomyHint")}</p>
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

      {/* you vs. other drivers — a real cross-vehicle average, only shows
          once other drivers' data actually exists (see lib/benchmark.ts) */}
      {bench && (
        <Card>
          <div className="text-sm font-semibold mb-3">{t("bm.title")}</div>
          {bench.others.driverCount === 0 ? (
            <Empty>{t("bm.notEnough")}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <BenchMetric
                  label={t("db.perHour")}
                  you={bench.you.profitPerHour}
                  others={bench.others.profitPerHour}
                  fmt={money}
                  youLabel={t("bm.you")}
                  othersLabel={t("bm.others")}
                />
                <BenchMetric
                  label={t("db.perKm")}
                  you={bench.you.profitPerKm}
                  others={bench.others.profitPerKm}
                  fmt={money}
                  youLabel={t("bm.you")}
                  othersLabel={t("bm.others")}
                />
              </div>
              <div className="text-xs text-slate-400 mt-3 text-center">
                {t("bm.driverCount", { n: fmtNum(bench.others.driverCount, locale, 0) })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* your car vs. other drivers with the SAME catalog model — only for
          vehicles picked from the car-model dropdown, never a fabricated
          number (see lib/carBenchmark.ts) */}
      {carBench && carBench.carModel && (
        <Card>
          <div className="text-sm font-semibold mb-1">
            {t("cbm.title", { car: `${carBench.carModel.make} ${carBench.carModel.model}` })}
          </div>
          {carBench.others.driverCount === 0 ? (
            <Empty>{t("bm.notEnough")}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <BenchMetric
                  label={
                    carBench.others.fuelUnit === "m3"
                      ? `${t("cbm.fuelPer100")} (${t("c.m3")})`
                      : `${t("cbm.fuelPer100")} (${t("c.liters")})`
                  }
                  you={carBench.you.fuelPer100}
                  others={carBench.others.fuelPer100}
                  fmt={(n) => fmtNum(n, locale)}
                  youLabel={t("bm.you")}
                  othersLabel={t("bm.others")}
                  lowerIsBetter
                />
                <BenchMetric
                  label={t("cbm.maintPerKm")}
                  you={carBench.you.maintCostPerKm}
                  others={carBench.others.maintCostPerKm}
                  fmt={money}
                  youLabel={t("bm.you")}
                  othersLabel={t("bm.others")}
                  lowerIsBetter
                />
              </div>
              <div className="text-xs text-slate-400 mt-3 text-center">
                {t("bm.driverCount", { n: fmtNum(carBench.others.driverCount, locale, 0) })}
              </div>
              {carModelTip(carBench, t) && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mt-3">
                  💡 {carModelTip(carBench, t)}
                </div>
              )}
            </>
          )}
        </Card>
      )}

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

function ViewToggle({
  viewAll,
  setViewAll,
  t,
}: {
  viewAll: boolean;
  setViewAll: (v: boolean) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
      <button
        onClick={() => setViewAll(false)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
          !viewAll ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        {t("cars.thisCar")}
      </button>
      <button
        onClick={() => setViewAll(true)}
        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
          viewAll ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        {t("cars.allCars")}
      </button>
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

/** One actionable tip when the driver's own car is meaningfully worse than
 *  other drivers of the same model — never invented, only fires on a real
 *  gap (≥10%) against a real average. Picks the larger of the two gaps
 *  (fuel vs. maintenance) so the card shows one focused suggestion. */
function carModelTip(carBench: any, t: (k: string, vars?: Record<string, string | number>) => string): string | null {
  const { you, others } = carBench;
  const fuelGap =
    you.fuelPer100 != null && others.fuelPer100 != null && others.fuelPer100 > 0
      ? (you.fuelPer100 - others.fuelPer100) / others.fuelPer100
      : null;
  const maintGap =
    you.maintCostPerKm != null && others.maintCostPerKm != null && others.maintCostPerKm > 0
      ? (you.maintCostPerKm - others.maintCostPerKm) / others.maintCostPerKm
      : null;

  const gaps = [
    { key: "fuel" as const, gap: fuelGap },
    { key: "maint" as const, gap: maintGap },
  ].filter((g) => g.gap != null && g.gap >= 0.1);
  if (gaps.length === 0) return null;
  const worst = gaps.sort((a, b) => b.gap! - a.gap!)[0];
  const pct = Math.round(worst.gap! * 100);
  return worst.key === "fuel" ? t("cbm.tipFuel", { n: pct }) : t("cbm.tipMaint", { n: pct });
}

function BenchMetric({
  label,
  you,
  others,
  fmt,
  youLabel,
  othersLabel,
  lowerIsBetter,
}: {
  label: string;
  you: number | null;
  others: number | null;
  fmt: (n: number) => string;
  youLabel: string;
  othersLabel: string;
  lowerIsBetter?: boolean;
}) {
  const youWins =
    you != null && others != null && (lowerIsBetter ? you <= others : you >= others);
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1 text-center">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-[10px] text-slate-400">{youLabel}</div>
          <div
            className="text-lg font-bold"
            style={{ fontVariantNumeric: "tabular-nums", color: youWins ? "#006300" : undefined }}
          >
            {you != null ? fmt(you) : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-400">{othersLabel}</div>
          <div className="text-lg font-bold text-slate-600" style={{ fontVariantNumeric: "tabular-nums" }}>
            {others != null ? fmt(others) : "—"}
          </div>
        </div>
      </div>
    </div>
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
