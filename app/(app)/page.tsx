"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, CardHead, Empty, Gauge, Meter, PageTitle, Table } from "@/components/ui";
import { QuickExpense } from "@/components/QuickExpense";
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
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [weekRecap, setWeekRecap] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [plannedHours, setPlannedHours] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  // bumped after a one-tap expense so every figure it moves is refetched
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

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
      fetch(`/api/platform-breakdown?vehicleId=${vehicle.id}&period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setPlatformStats);
      fetch(`/api/leaderboard?vehicleId=${vehicle.id}&period=${period}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setLeaderboard);
    }
  }, [vehicle, period, viewAll, reloadKey]);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/streak?vehicleId=${vehicle.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStreak);
    fetch(`/api/analytics?vehicleId=${vehicle.id}&period=week`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setWeekRecap);
    fetch(`/api/expenses?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setExpenses(Array.isArray(d) ? d : []));
  }, [vehicle, reloadKey]);

  useEffect(() => {
    if (!vehicle) return;
    const hours = plannedHours != null ? `&hours=${plannedHours}` : "";
    fetch(`/api/target?vehicleId=${vehicle.id}${hours}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTarget);
  }, [vehicle, plannedHours, reloadKey]);

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

  // each per-km cost shows the rate it came from, so a driver can check the
  // arithmetic instead of taking the total on faith
  const rateNote = (perKm: number) => `${money(perKm)}/${t("c.km")} × ${fmtNum(a.kmSplit.shiftKm, locale, 0)} ${t("c.km")}`;
  const costRows = [
    { key: "db.fuelCost", v: a.costs.fuel, note: rateNote(a.rates.fuelCostPerKm) },
    { key: "db.maintCost", v: a.costs.maintenance, note: rateNote(a.rates.maintCostPerKm) },
    { key: "db.expenses", v: a.costs.workExpenses, note: null },
    { key: "db.depreciation", v: a.costs.depreciation, note: rateNote(a.rates.depPerKm) },
    { key: "db.rental", v: a.costs.ownership, note: null },
  ].filter((r) => r.v > 0.005);
  const maxCost = Math.max(...costRows.map((r) => r.v), 1);

  const km = a.kmSplit;
  const kmTotal = Math.max(km.tripKm + km.deadKm + km.personalKm, 0.001);
  // what a km costs this driver, so unpaid km can be priced in EGP rather
  // than left as an abstract share of a bar
  const costPerKm = a.rates.fuelCostPerKm + a.rates.maintCostPerKm + a.rates.depPerKm;
  const deadShare = km.shiftKm > 0 ? km.deadKm / km.shiftKm : 0;

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

      {/* the only forward-looking number in the app: what today has to earn */}
      {target && (
        <DailyTargetCard
          target={target}
          onHours={setPlannedHours}
          t={t}
          locale={locale}
        />
      )}

      {/* running costs, logged in one tap — the category with the biggest
          gap between "really happens" and "gets recorded" */}
      <Card>
        <CardHead icon="💸" title={t("qx.title")} sub={t("qx.sub")} />
        <QuickExpense vehicleId={vehicle.id} recent={expenses} onAdded={reload} />
      </Card>

      {/* streaks & goals — only shown once the driver sets a goal (edited
          from the vehicle's Cars-page form), never a hollow 0% otherwise */}
      {streak && vehicle && <StreakCard streak={streak} vehicleId={vehicle.id} t={t} locale={locale} />}

      {/* hero + stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="col-span-2">
          <div className="text-xs font-semibold text-slate-500">{t("db.trueProfit")}</div>
          <div className="text-4xl font-black mt-1" style={{ color: profitColor }}>
            {money(a.trueProfit)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{t("db.profitSub")}</div>
          {/* depreciation is a real cost but not cash leaving your pocket —
              showing both stops the accrual from hiding what you actually made */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline gap-2">
            <span className="text-xs text-slate-500">{t("db.cashProfit")}</span>
            <span className="text-lg font-bold" style={{ color: a.cashProfit >= 0 ? C.goodText : C.critical }}>
              {money(a.cashProfit)}
            </span>
            <span className="text-xs text-slate-400">{t("db.cashProfitSub")}</span>
          </div>
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
                  <div className="flex justify-between text-xs mb-0.5 gap-2">
                    <span className="text-slate-500">
                      {t(r.key)}
                      {r.note && <span className="text-slate-300 ms-1.5">{r.note}</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
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

      {/* weekly recap + platform breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {weekRecap && <WeeklyRecapCard recap={weekRecap} t={t} locale={locale} />}
        {platformStats && platformStats.length > 0 && (
          <Card>
            <div className="text-sm font-semibold mb-1">{t("db.platformTitle")}</div>
            <p className="text-xs text-slate-400 mb-3">{t("db.platformSub")}</p>
            <div className="space-y-2">
              {platformStats.map((p: any) => (
                <div key={p.platform} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 font-semibold">{t(`pf.${p.platform}`)}</span>
                  <span className="text-xs text-slate-400">{t("pl.tripsN", { n: p.trips })}</span>
                  <span className="font-bold w-24 text-end" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(p.netRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* km split + fuel economy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHead icon="🛣" title={t("db.kmSplit")} sub={t("db.kmSplitSub")} />
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
            <LegendRow
              color={C.pos}
              label={t("db.tripKm")}
              value={`${fmtNum(km.tripKm, locale)} ${t("c.km")}`}
            />
            <LegendRow
              color={C.dead}
              label={t("db.deadKm")}
              value={`${fmtNum(km.deadKm, locale)} ${t("c.km")}`}
              cost={money(km.deadKm * costPerKm)}
            />
            {km.pickupKm > 0 && (
              <>
                <SubRow
                  label={t("db.pickupSplit")}
                  value={`${fmtNum(km.pickupKm, locale)} ${t("c.km")}`}
                  cost={money(km.pickupKm * costPerKm)}
                />
                <SubRow
                  label={t("db.cruisingSplit")}
                  value={`${fmtNum(km.cruisingKm, locale)} ${t("c.km")}`}
                  cost={money(km.cruisingKm * costPerKm)}
                />
              </>
            )}
            <LegendRow
              color={C.personal}
              label={t("db.personalKm")}
              value={`${fmtNum(km.personalKm, locale)} ${t("c.km")}`}
            />
          </div>

          {/* dead km is the one cost a driver can cut tonight, so it gets a
              number in EGP rather than only a share of a bar */}
          {km.shiftKm > 0 && km.deadKm > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Meter
                ratio={km.deadKm / km.shiftKm}
                tone={deadShare <= 0.15 ? "good" : deadShare <= 0.25 ? "warn" : "bad"}
                label={t("db.deadShare")}
                value={`${fmtNum(deadShare * 100, locale, 0)}%`}
                sub={t("db.deadShareSub", {
                  km: fmtNum(km.deadKm, locale, 0),
                  cost: money(km.deadKm * costPerKm),
                  rate: money(costPerKm),
                })}
              />
              {km.cruisingKm > 0 && (
                <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mt-3">
                  💡{" "}
                  {t("db.deadKmTip", {
                    km: fmtNum(km.cruisingKm, locale, 0),
                    cost: money(km.cruisingKm * costPerKm),
                  })}
                </p>
              )}
            </div>
          )}
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
                    <div className="text-[10px] text-slate-400 mt-1">
                      {t("db.fuelMeasuredOver", {
                        km: fmtNum(f.distanceKm, locale, 0),
                        pct: fmtNum(f.workSharePct, locale, 0),
                      })}
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

      {/* community leaderboard — anonymized ranking, honest min-driver gate */}
      {leaderboard && (
        <Card>
          <div className="text-sm font-semibold mb-1">🏁 {t("db.leaderboardTitle")}</div>
          {leaderboard.entries.length === 0 ? (
            <Empty>{t("bm.notEnough")}</Empty>
          ) : (
            <>
              <div className="space-y-1.5 mt-2">
                {leaderboard.entries.map((e: any, i: number) => (
                  <div
                    key={e.vehicleId}
                    className={`flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 ${e.isYou ? "bg-emerald-50 font-bold" : ""}`}
                  >
                    <span className="w-6 text-center text-slate-400">{i + 1}</span>
                    <span className="flex-1">{e.isYou ? t("db.leaderboardYou") : e.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(e.profitPerHour)}/{t("c.hours")}</span>
                  </div>
                ))}
              </div>
              {leaderboard.yourRank && leaderboard.yourRank > leaderboard.entries.length && (
                <div className="text-xs text-slate-400 mt-2 text-center">
                  {t("db.leaderboardYourRank", { rank: leaderboard.yourRank, total: leaderboard.driverCount })}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-3 text-center">
                {t("bm.driverCount", { n: fmtNum(leaderboard.driverCount, locale, 0) })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* reminders needing attention — manual ones and the ones the app
          worked out from the service log read exactly the same here */}
      {attention.length > 0 && (
        <Card className="border-amber-200">
          <div className="text-sm font-semibold mb-2">🔔 {t("db.remindersDue")}</div>
          <div className="space-y-1">
            {attention.map((r: any) => (
              <Link
                key={r.id}
                href={r.source === "service" ? "/maintenance" : "/reminders"}
                className="flex items-center gap-2 text-sm hover:bg-slate-50 rounded px-2 py-1"
              >
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    r.state === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.state === "overdue" ? t("rm.overdue") : t("rm.dueSoon")}
                </span>
                <span className="font-semibold">
                  {r.source === "service" ? t(`mn.cat.${r.category}`) : r.title}
                </span>
                {r.source === "service" && (
                  <span className="text-[10px] text-slate-400 border border-slate-200 rounded-full px-1.5 py-0.5">
                    {t("rm.autoBadge")}
                  </span>
                )}
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

function StreakCard({
  streak,
  vehicleId,
  t,
  locale,
}: {
  streak: any;
  vehicleId: string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  const [editing, setEditing] = useState(false);
  const [hoursGoal, setHoursGoal] = useState(streak.weeklyHoursGoal ?? "");
  const [profitGoal, setProfitGoal] = useState(streak.weeklyProfitGoal ?? "");
  const [saving, setSaving] = useState(false);
  const money = (n: number) => fmtMoney(n, locale);

  const hasGoal = streak.weeklyHoursGoal != null || streak.weeklyProfitGoal != null;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weeklyHoursGoal: hoursGoal, weeklyProfitGoal: profitGoal }),
    });
    setSaving(false);
    setEditing(false);
    location.reload(); // simplest way to refresh the streak calc with the new goal
  };

  if (!hasGoal && !editing) {
    return (
      <Card className="border-emerald-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">🔥 {t("db.streakTitle")}</div>
            <p className="text-xs text-slate-400 mt-1">{t("db.streakSetHint")}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2"
          >
            {t("db.streakSetGoal")}
          </button>
        </div>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="border-emerald-300">
        <div className="text-sm font-semibold mb-3">🔥 {t("db.streakSetGoal")}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">{t("db.streakHoursGoal")}</span>
            <input
              type="number"
              value={hoursGoal}
              onChange={(e) => setHoursGoal(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={t("c.optional")}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">{t("db.streakProfitGoal")}</span>
            <input
              type="number"
              value={profitGoal}
              onChange={(e) => setProfitGoal(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={t("c.optional")}
            />
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("c.save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 text-sm"
          >
            {t("c.cancel")}
          </button>
        </div>
      </Card>
    );
  }

  const hoursPct = streak.weeklyHoursGoal ? Math.min(100, (streak.thisWeek.hours / streak.weeklyHoursGoal) * 100) : null;
  const profitPct = streak.weeklyProfitGoal ? Math.min(100, (streak.thisWeek.profit / streak.weeklyProfitGoal) * 100) : null;

  return (
    <Card className="border-emerald-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold">🔥 {t("db.streakTitle")}</div>
        <button onClick={() => setEditing(true)} className="text-xs text-slate-400 underline">
          {t("db.streakEditGoal")}
        </button>
      </div>
      <div className="flex items-end gap-4 mb-3">
        <div className="text-3xl font-black text-emerald-700">{streak.currentStreak}</div>
        <div className="text-xs text-slate-500 mb-1">
          {t("db.streakWeeks", { n: streak.currentStreak })}
          {streak.longestStreak > streak.currentStreak && (
            <div className="text-slate-400">{t("db.streakBest", { n: streak.longestStreak })}</div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {hoursPct != null && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-500">{t("db.streakHoursGoal")}</span>
              <span className="font-semibold">
                {fmtNum(streak.thisWeek.hours, locale)} / {fmtNum(streak.weeklyHoursGoal, locale)} {t("c.hours")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${hoursPct}%` }} />
            </div>
          </div>
        )}
        {profitPct != null && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-500">{t("db.streakProfitGoal")}</span>
              <span className="font-semibold">
                {money(streak.thisWeek.profit)} / {money(streak.weeklyProfitGoal)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${profitPct}%` }} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function WeeklyRecapCard({
  recap,
  t,
  locale,
}: {
  recap: any;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  const [copied, setCopied] = useState(false);
  const money = (n: number) => fmtMoney(n, locale);

  const shareText = t("db.recapShareText", {
    profit: money(recap.trueProfit),
    hours: fmtNum(recap.counts.hoursWorked, locale),
    trips: fmtNum(recap.counts.trips, locale, 0),
    perHour: recap.perHour != null ? money(recap.perHour) : "—",
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — the text is still visible to copy manually
    }
  };

  return (
    <Card>
      <div className="text-sm font-semibold mb-1">📋 {t("db.recapTitle")}</div>
      <p className="text-xs text-slate-400 mb-3">{t("db.recapSub")}</p>
      <div className="text-2xl font-black" style={{ color: recap.trueProfit >= 0 ? "#006300" : "#d03b3b" }}>
        {money(recap.trueProfit)}
      </div>
      <div className="text-xs text-slate-500 mt-1 mb-3">
        {fmtNum(recap.counts.hoursWorked, locale)} {t("c.hours")} · {t("pl.tripsN", { n: recap.counts.trips })}
      </div>
      <button
        onClick={copy}
        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2"
      >
        {copied ? `✓ ${t("db.recapCopied")}` : `📋 ${t("db.recapCopy")}`}
      </button>
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

function LegendRow({
  color,
  label,
  value,
  cost,
}: {
  color: string;
  label: string;
  value: string;
  /** What this slice of driving cost, when it is a cost worth naming. */
  cost?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-slate-500 flex-1">{label}</span>
      {cost && <span className="text-slate-400 tnum">{cost}</span>}
      <span className="font-semibold tnum">{value}</span>
    </div>
  );
}

/** An indented breakdown line under a LegendRow. */
function SubRow({ label, value, cost }: { label: string; value: string; cost?: string }) {
  return (
    <div className="ps-5 flex items-center gap-2 text-slate-400">
      <span className="flex-1">{label}</span>
      {cost && <span className="tnum">{cost}</span>}
      <span className="tnum">{value}</span>
    </div>
  );
}

/**
 * Today's target — the one screen in the app that looks forward.
 *
 * Break-even is the line that must be cleared before an hour of driving has
 * paid for itself; the bar's end is the driver's own typical day (or their
 * weekly goal split across the days they actually work). Both come from
 * lib/target.ts, which builds them from this driver's history and nothing else.
 */
function DailyTargetCard({
  target,
  onHours,
  t,
  locale,
}: {
  target: any;
  onHours: (h: number) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  const money = (n: number) => fmtMoney(n, locale);
  if (!target.hasBasis) {
    return (
      <Card>
        <CardHead icon="🎯" title={t("tg.title")} sub={t("tg.needMoreData")} />
      </Card>
    );
  }

  const { today, breakEvenRevenue } = target;
  // a zero target would divide the bar and the gauge by nothing
  const targetRevenue = Math.max(target.targetRevenue, 1);
  const scale = Math.max(targetRevenue, today.netRevenue, 1);
  const clearedBreakEven = today.netRevenue >= breakEvenRevenue;
  const hitTarget = today.netRevenue >= targetRevenue;
  const remaining = Math.max(0, targetRevenue - today.netRevenue);

  return (
    <Card>
      <CardHead
        icon="🎯"
        title={t("tg.title")}
        sub={t(`tg.sub.${target.targetSource}`)}
        actions={
          <div className="flex items-center gap-1">
            <Btn
              variant="secondary"
              className="!px-2.5 !py-1 !text-sm"
              onClick={() => onHours(Math.max(1, target.plannedHours - 1))}
            >
              −
            </Btn>
            <span className="text-xs font-bold tnum w-14 text-center">
              {fmtNum(target.plannedHours, locale)} {t("c.hours")}
            </span>
            <Btn
              variant="secondary"
              className="!px-2.5 !py-1 !text-sm"
              onClick={() => onHours(target.plannedHours + 1)}
            >
              +
            </Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black tnum" style={{ color: hitTarget ? C.goodText : undefined }}>
              {money(today.netRevenue)}
            </span>
            <span className="text-xs text-slate-400">{t("tg.soFar")}</span>
          </div>

          <Meter
            ratio={today.netRevenue / scale}
            tone={hitTarget ? "good" : clearedBreakEven ? "brand" : "warn"}
            marker={{
              ratio: breakEvenRevenue / scale,
              label: t("tg.breakEvenMark", { v: money(breakEvenRevenue) }),
            }}
            value={t("tg.ofTarget", { v: money(targetRevenue) })}
          />

          <div className="grid grid-cols-3 gap-3 mt-4">
            <TargetStat
              label={t("tg.toBreakEven")}
              value={clearedBreakEven ? t("tg.cleared") : money(breakEvenRevenue - today.netRevenue)}
              tone={clearedBreakEven ? "good" : "warn"}
            />
            <TargetStat
              label={t("tg.toTarget")}
              value={hitTarget ? t("tg.hit") : money(remaining)}
              tone={hitTarget ? "good" : "default"}
            />
            <TargetStat
              label={t("tg.perHourNeeded")}
              value={
                target.perHourNeeded != null && remaining > 0
                  ? `${money(target.perHourNeeded)}/${t("c.hours")}`
                  : "—"
              }
              tone="default"
            />
          </div>
        </div>

        <div className="flex justify-center sm:justify-end">
          <Gauge
            ratio={today.netRevenue / targetRevenue}
            tone={hitTarget ? "good" : clearedBreakEven ? "brand" : "warn"}
            value={`${fmtNum(Math.min(999, (today.netRevenue / targetRevenue) * 100), locale, 0)}%`}
            unit={t("tg.ofDay")}
            minLabel="0"
            maxLabel="100%"
            caption={t("tg.costCaption", {
              perHour: money(target.costPerHour ?? 0),
              perKm: money(target.costPerKm),
            })}
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        {t("tg.footnote", {
          hours: fmtNum(target.plannedHours, locale),
          kmh: fmtNum(target.kmPerHour ?? 0, locale, 0),
          hourly: money(target.typicalHourly ?? 0),
          fixed: money(target.fixedDailyCost),
        })}
      </p>
    </Card>
  );
}

function TargetStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "good" | "warn";
}) {
  const color = tone === "good" ? C.goodText : tone === "warn" ? C.critical : undefined;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold truncate">{label}</div>
      <div className="text-sm font-bold tnum truncate" style={{ color }}>
        {value}
      </div>
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
