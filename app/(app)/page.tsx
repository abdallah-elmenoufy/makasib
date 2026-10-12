"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Btn, Card, CardHead, Delta, Empty, Gauge, Hero, Meter, PageTitle, Segmented, StackedMeter, Table, Tile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { QuickExpense } from "@/components/QuickExpense";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";

// chart chrome + series colours from the validated reference palette
const C = {
  pos: "#2a78d6", // series-1 blue
  neg: "#e34948", // diverging red pole
  dead: "#eda100", // series-4 yellow (labelled — relief rule)
  pickup: "#eb6834", // series-2 orange
  personal: "#c3c2b7", // neutral
  idle: "#c3c2b7",
  trip: "#2a78d6",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  goodText: "#05a357",
  critical: "#e11900",
};

const PERIODS = ["today", "week", "lastWeek", "month", "all"] as const;
type PeriodKey = (typeof PERIODS)[number];
const PERIOD_KEY: Record<PeriodKey, string> = {
  today: "c.today",
  week: "c.thisWeek",
  lastWeek: "c.lastWeek",
  month: "c.thisMonth",
  all: "c.allTime",
};

function fmtDuration(min: number, t: (k: string) => string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}${t("c.minShort")}`;
  return `${h}${t("c.hours")} ${m.toString().padStart(2, "0")}${t("c.minShort")}`;
}

function fmtCountdown(ms: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return t("wk.closesInDays", { d: days, h: hours });
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return t("wk.closesInHours", { h: hours, m: mins });
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { vehicle, activeVehicles, loading: vLoading } = useVehicle();
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [viewAll, setViewAll] = useState(false);
  const [a, setA] = useState<any>(null);
  const [bench, setBench] = useState<any>(null);
  const [carBench, setCarBench] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [weeks, setWeeks] = useState<any>(null);
  const [integrity, setIntegrity] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [plannedHours, setPlannedHours] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (viewAll) {
      fetch(`/api/analytics/profile?period=${period}`).then((r) => (r.ok ? r.json() : null)).then(setProfile);
      return;
    }
    if (vehicle) {
      fetch(`/api/analytics?vehicleId=${vehicle.id}&period=${period}`).then((r) => (r.ok ? r.json() : null)).then(setA);
      fetch(`/api/benchmark?vehicleId=${vehicle.id}&period=${period}`).then((r) => (r.ok ? r.json() : null)).then(setBench);
      fetch(`/api/car-benchmark?vehicleId=${vehicle.id}`).then((r) => (r.ok ? r.json() : null)).then(setCarBench);
      fetch(`/api/platform-breakdown?vehicleId=${vehicle.id}&period=${period}`).then((r) => (r.ok ? r.json() : null)).then(setPlatformStats);
      fetch(`/api/leaderboard?vehicleId=${vehicle.id}&period=${period}`).then((r) => (r.ok ? r.json() : null)).then(setLeaderboard);
    }
  }, [vehicle, period, viewAll, reloadKey]);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/streak?vehicleId=${vehicle.id}`).then((r) => (r.ok ? r.json() : null)).then(setStreak);
    fetch(`/api/weeks?vehicleId=${vehicle.id}&weeks=3`).then((r) => (r.ok ? r.json() : null)).then(setWeeks);
    fetch(`/api/integrity?vehicleId=${vehicle.id}`).then((r) => (r.ok ? r.json() : null)).then(setIntegrity);
    fetch(`/api/expenses?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setExpenses(Array.isArray(d) ? d : []));
  }, [vehicle, reloadKey]);

  useEffect(() => {
    if (!vehicle) return;
    const hours = plannedHours != null ? `&hours=${plannedHours}` : "";
    fetch(`/api/target?vehicleId=${vehicle.id}${hours}`).then((r) => (r.ok ? r.json() : null)).then(setTarget);
  }, [vehicle, plannedHours, reloadKey]);

  if (vLoading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-ink underline font-bold">
          {t("db.noVehicle")}
        </Link>
      </Empty>
    );
  }

  const money = (n: number) => fmtMoney(n, locale);
  const periodPicker = (
    <Segmented value={period} onChange={setPeriod} size="sm" options={PERIODS.map((p) => ({ value: p, label: t(PERIOD_KEY[p]) }))} />
  );

  if (viewAll) {
    if (!profile) return null;
    const p = profile.totals;
    return (
      <div className="space-y-4">
        <PageTitle actions={activeVehicles.length > 1 && <ViewToggle viewAll={viewAll} setViewAll={setViewAll} t={t} />}>{t("db.title")}</PageTitle>
        {periodPicker}
        <Card tone="ink">
          <Hero label={t("db.trueProfit")} value={money(p.trueProfit)} tone={p.trueProfit >= 0 ? "ink" : "loss"} sub={<span className="text-white/60">{t("cars.allCarsSub")}</span>} />
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/15">
            <InkStat label={t("db.gross")} value={money(p.earnings.netRevenue)} />
            <InkStat label={t("db.perHour")} value={p.perHour != null ? money(p.perHour) : "—"} />
            <InkStat label={t("db.perKm")} value={p.perKm != null ? money(p.perKm) : "—"} />
          </div>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label={t("db.hoursWorked")} value={fmtNum(p.counts.hoursWorked, locale)} />
          <Tile label={t("db.shiftCount")} value={fmtNum(p.counts.shifts, locale, 0)} />
          <Tile label={t("db.tripCount")} value={fmtNum(p.counts.trips, locale, 0)} />
          <Tile label={t("cars.carCount")} value={fmtNum(profile.perVehicle.length, locale, 0)} />
        </div>
        <Card>
          <CardHead title={t("cars.breakdown")} />
          <Table head={[t("veh.name"), t("db.trueProfit"), t("db.perHour"), t("db.perKm"), t("sh.trips")]}>
            {profile.perVehicle.map((v: any) => (
              <tr key={v.vehicle.id}>
                <td className="py-2 px-2 font-bold">{v.vehicle.name}</td>
                <td className="py-2 px-2 tnum font-bold" style={{ color: v.trueProfit >= 0 ? C.goodText : C.critical }}>
                  {money(v.trueProfit)}
                </td>
                <td className="py-2 px-2 tnum">{v.perHour != null ? money(v.perHour) : "—"}</td>
                <td className="py-2 px-2 tnum">{v.perKm != null ? money(v.perKm) : "—"}</td>
                <td className="py-2 px-2 tnum">{fmtNum(v.counts.shifts, locale, 0)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    );
  }

  if (!a) return null;

  const attention = a.reminders.filter((r: any) => r.state !== "ok");
  const dep = a.depreciationBasis;
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
  const costPerKm = a.rates.fuelCostPerKm + a.rates.maintCostPerKm + a.rates.depPerKm;
  const deadShare = km.shiftKm > 0 ? km.deadKm / km.shiftKm : 0;
  const time = a.time;

  const cur = weeks?.current;
  const openShift = integrity?.openShifts?.[0] ?? null;
  const showWeekClose = weeks?.lastClosed && cur && cur.progress < 2 / 7; // first two days of the new week

  return (
    <div className="space-y-4">
      <PageTitle sub={fmtDate(new Date(), locale)} actions={activeVehicles.length > 1 && <ViewToggle viewAll={viewAll} setViewAll={setViewAll} t={t} />}>
        {t("db.title")}
      </PageTitle>

      {/* quick actions — what a driver does constantly through a shift */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <QuickAction href="/shifts" icon={openShift ? "stop" : "play"} label={openShift ? t("sh.end") : t("sh.start")} tone={openShift ? "warn" : "ink"} />
        <QuickAction href="/trips?add=1" icon="plus" label={t("tr.add")} />
        <QuickAction href="/import?tab=ocr" icon="camera" label={t("nav.import")} />
      </div>

      {/* week closed recap — the first days after Monday 04:00 */}
      {showWeekClose && <WeekClosedCard week={weeks.lastClosed} previous={weeks.weeks[weeks.weeks.length - 3] ?? null} t={t} locale={locale} />}

      {periodPicker}

      {/* hero: Uber earnings-screen style */}
      <Card tone="ink">
        <Hero
          label={t("db.trueProfit")}
          value={money(a.trueProfit)}
          tone={a.trueProfit >= 0 ? "ink" : "loss"}
          size="xl"
          sub={
            <span className="text-white/60">
              {dep.enabled ? t("db.profitSub") : t("db.profitSubNoDep")}
              {period === "week" && cur && weeks.previousAtSamePoint && weeks.previousAtSamePoint.netRevenue > 0 && (
                <span className="block mt-1 text-white/80">
                  {t("wk.vsSamePoint")} <Delta value={a.earnings.netRevenue - weeks.previousAtSamePoint.netRevenue} fmt={money} />
                </span>
              )}
            </span>
          }
        />
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/15">
          <InkStat label={t("db.gross")} value={money(a.earnings.netRevenue)} />
          <InkStat label={t("db.cashProfit")} value={money(a.cashProfit)} />
          <InkStat label={t("db.perHour")} value={a.perHour != null ? money(a.perHour) : "—"} />
        </div>
        {period === "week" && cur && (
          <div className="mt-4 pt-4 border-t border-white/15">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
              <span>
                {t("wk.uberWeek")} · {fmtDate(cur.start, locale)} – {fmtDate(new Date(new Date(cur.end).getTime() - 1), locale)}
              </span>
              <span className="tnum">{fmtCountdown(weeks.msUntilClose, t)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${Math.round(cur.progress * 100)}%` }} />
            </div>
            {weeks.projection && (
              <div className="text-xs text-white/70 mt-2">
                {t("wk.onPace", { v: money(weeks.projection.trueProfit), n: weeks.projection.trips })}
                {weeks.previous && weeks.previous.trueProfit !== 0 && (
                  <>
                    {" · "}
                    {t("wk.vsLastWeek")} <Delta value={weeks.projection.trueProfit - weeks.previous.trueProfit} fmt={money} />
                  </>
                )}
              </div>
            )}
            <Link href="/weeks" className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-white">
              {t("wk.seeWeekly")} <Icon name="chevron" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t("db.hoursWorked")} value={fmtNum(a.counts.hoursWorked, locale)} sub={`${t("db.shiftCount")} ${fmtNum(a.counts.shifts, locale, 0)}`} />
        <Tile label={t("db.tripCount")} value={fmtNum(a.counts.trips, locale, 0)} sub={a.counts.trips > 0 ? `${money(a.earnings.netRevenue / a.counts.trips)} ${t("wk.perTrip")}` : undefined} />
        <Tile label={t("db.perKm")} value={a.perKm != null ? money(a.perKm) : "—"} sub={`${fmtNum(km.shiftKm, locale, 0)} ${t("c.km")}`} />
        <Tile label={t("tm.utilization")} value={time.utilizationPct != null ? `${fmtNum(time.utilizationPct, locale, 0)}%` : "—"} sub={t("tm.utilizationSub")} />
      </div>

      {/* today's target */}
      {target && <DailyTargetCard target={target} onHours={setPlannedHours} t={t} locale={locale} />}

      {/* time split */}
      <Card>
        <CardHead icon="timer" title={t("tm.title")} sub={t("tm.sub")} />
        {time.onlineMin <= 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <>
            <StackedMeter
              height={14}
              segments={[
                { key: "trip", value: time.tripMin, color: C.trip, label: t("tm.withRider") },
                { key: "pickup", value: time.pickupMin, color: C.pickup, label: t("tm.toPickup") },
                { key: "idle", value: time.idleMin, color: C.idle, label: t("tm.idle") },
              ]}
            />
            <div className="mt-3 space-y-1 text-xs">
              <LegendRow color={C.trip} label={t("tm.withRider")} value={fmtDuration(time.tripMin, t)} cost={time.onlineMin > 0 ? `${fmtNum((time.tripMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <LegendRow color={C.pickup} label={t("tm.toPickup")} value={fmtDuration(time.pickupMin, t)} cost={time.onlineMin > 0 ? `${fmtNum((time.pickupMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <LegendRow color={C.idle} label={t("tm.idle")} value={fmtDuration(time.idleMin, t)} cost={time.onlineMin > 0 ? `${fmtNum((time.idleMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <div className="flex justify-between pt-2 mt-1 border-t border-line font-bold">
                <span>{t("tm.online")}</span>
                <span className="tnum">{fmtDuration(time.onlineMin, t)}</span>
              </div>
            </div>
            {time.tripMin > 0 && (
              <p className="text-xs text-muted mt-3 leading-relaxed">
                {t("tm.perTripHour", { v: money((a.earnings.netRevenue / time.tripMin) * 60), online: money((a.earnings.netRevenue / time.onlineMin) * 60) })}
              </p>
            )}
            {time.tripMin === 0 && <p className="text-xs text-warn-ink bg-warn-soft rounded-lg px-3 py-2 mt-3">{t("tm.needMinutes")}</p>}
          </>
        )}
      </Card>

      {/* running costs in one tap */}
      <Card>
        <CardHead icon="receipt" title={t("qx.title")} sub={t("qx.sub")} />
        <QuickExpense vehicleId={vehicle.id} recent={expenses} onAdded={reload} />
      </Card>

      {streak && vehicle && <StreakCard streak={streak} vehicleId={vehicle.id} t={t} locale={locale} />}

      {/* daily profit + costs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHead title={`${t("db.profitTrend")} (14d)`} />
          <ProfitBars data={a.trend} locale={locale} />
        </Card>

        <Card>
          <CardHead
            title={t("db.costs")}
            actions={
              !dep.enabled && (
                <Badge tone="neutral" title={t("dep.offHint")}>
                  {t("dep.off")}
                </Badge>
              )
            }
          />
          {costRows.length === 0 ? (
            <Empty>{t("c.noData")}</Empty>
          ) : (
            <div className="space-y-2.5">
              {costRows.map((r) => (
                <div key={r.key}>
                  <div className="flex justify-between text-xs mb-1 gap-2">
                    <span className="text-ink-500 min-w-0 truncate">
                      {t(r.key)}
                      {r.note && <span className="text-muted-2 ms-1.5">{r.note}</span>}
                    </span>
                    <span className="font-bold whitespace-nowrap tnum">{money(r.v)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.v / maxCost) * 100}%`, background: C.pos }} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-line font-bold">
                <span>{t("db.costsTotal")}</span>
                <span className="tnum">{money(a.costs.total)}</span>
              </div>
              {dep.enabled && dep.rawPerKm > 0 && (
                <p className="text-[11px] text-muted leading-relaxed">
                  {t("dep.explain." + dep.method, { v: money(dep.rawPerKm), pct: fmtNum(dep.sensitivityPct, locale), value: money(dep.basisValue ?? 0) })}{" "}
                  <Link href="/cars" className="underline">
                    {t("dep.change")}
                  </Link>
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* platform */}
      {platformStats && platformStats.length > 1 && (
        <Card>
          <CardHead title={t("db.platformTitle")} sub={t("db.platformSub")} />
          <div className="space-y-2">
            {platformStats.map((p: any) => (
              <div key={p.platform} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-bold">{t(`pf.${p.platform}`)}</span>
                <span className="text-xs text-muted">{t("pl.tripsN", { n: p.trips })}</span>
                <span className="font-bold w-24 text-end tnum">{money(p.netRevenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* km split + fuel economy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHead icon="road" title={t("db.kmSplit")} sub={t("db.kmSplitSub")} />
          <StackedMeter
            height={14}
            segments={[
              { key: "trip", value: km.tripKm, color: C.pos, label: t("db.tripKm") },
              { key: "dead", value: km.deadKm, color: C.dead, label: t("db.deadKm") },
              { key: "personal", value: km.personalKm, color: C.personal, label: t("db.personalKm") },
            ]}
          />
          <div className="mt-3 space-y-1 text-xs">
            <LegendRow color={C.pos} label={t("db.tripKm")} value={`${fmtNum(km.tripKm, locale)} ${t("c.km")}`} />
            <LegendRow color={C.dead} label={t("db.deadKm")} value={`${fmtNum(km.deadKm, locale)} ${t("c.km")}`} cost={money(km.deadKm * costPerKm)} />
            {km.pickupKm > 0 && (
              <>
                <SubRow label={t("db.pickupSplit")} value={`${fmtNum(km.pickupKm, locale)} ${t("c.km")}`} cost={money(km.pickupKm * costPerKm)} />
                <SubRow label={t("db.cruisingSplit")} value={`${fmtNum(km.cruisingKm, locale)} ${t("c.km")}`} cost={money(km.cruisingKm * costPerKm)} />
              </>
            )}
            <LegendRow color={C.personal} label={t("db.personalKm")} value={`${fmtNum(km.personalKm, locale)} ${t("c.km")}`} />
          </div>
          {km.shiftKm > 0 && km.deadKm > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <Meter
                ratio={km.deadKm / km.shiftKm}
                tone={deadShare <= 0.15 ? "good" : deadShare <= 0.25 ? "warn" : "bad"}
                label={t("db.deadShare")}
                value={`${fmtNum(deadShare * 100, locale, 0)}%`}
                sub={t("db.deadShareSub", { km: fmtNum(km.deadKm, locale, 0), cost: money(km.deadKm * costPerKm), rate: money(costPerKm) })}
              />
              {km.cruisingKm > 0 && (
                <p className="text-xs bg-warn-soft text-warn-ink rounded-lg px-3 py-2 mt-3">
                  💡 {t("db.deadKmTip", { km: fmtNum(km.cruisingKm, locale, 0), cost: money(km.cruisingKm * costPerKm) })}
                </p>
              )}
            </div>
          )}
          {kmTotal <= 0.001 && <Empty>{t("c.noData")}</Empty>}
        </Card>

        <Card>
          <CardHead icon="fuel" title={t("db.fuelEconomy")} sub={t("db.fuelEconomyHint")} />
          {a.fuelEconomy.length === 0 ? (
            <Empty>{t("fu.fullTankHint")}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {a.fuelEconomy.map((f: any) => {
                const unit = f.unit === "m3" ? t("c.m3") : t("c.liters");
                return (
                  <div key={f.fuelGroup} className="bg-white rounded-xl p-3">
                    <div className="text-xs font-bold text-ink-500 mb-2">{f.fuelGroup === "CNG" ? t("fu.CNG") : t("veh.fuel.PETROL").split(" ")[0]}</div>
                    <div className="text-2xl font-bold display">
                      {fmtNum(f.per100, locale)}
                      <span className="text-xs font-bold text-muted">
                        {" "}
                        {unit} {t("db.l100")}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {fmtNum(f.kmPerUnit, locale)} {t("c.km")} / {unit}
                    </div>
                    <div className="text-xs text-muted">
                      {money(f.costPerKm)} / {t("c.km")}
                    </div>
                    <div className="text-[10px] text-muted-2 mt-1">{t("db.fuelMeasuredOver", { km: fmtNum(f.distanceKm, locale, 0), pct: fmtNum(f.workSharePct, locale, 0) })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {bench && (
        <Card>
          <CardHead title={t("bm.title")} />
          {bench.others.driverCount === 0 ? (
            <Empty>{t("bm.notEnough")}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <BenchMetric label={t("db.perHour")} you={bench.you.profitPerHour} others={bench.others.profitPerHour} fmt={money} youLabel={t("bm.you")} othersLabel={t("bm.others")} />
                <BenchMetric label={t("db.perKm")} you={bench.you.profitPerKm} others={bench.others.profitPerKm} fmt={money} youLabel={t("bm.you")} othersLabel={t("bm.others")} />
              </div>
              <div className="text-xs text-muted mt-3 text-center">{t("bm.driverCount", { n: fmtNum(bench.others.driverCount, locale, 0) })}</div>
            </>
          )}
        </Card>
      )}

      {carBench && carBench.carModel && carBench.others.driverCount > 0 && (
        <Card>
          <CardHead title={t("cbm.title", { car: `${carBench.carModel.make} ${carBench.carModel.model}` })} />
          <div className="grid grid-cols-2 gap-4 mt-2">
            <BenchMetric
              label={carBench.others.fuelUnit === "m3" ? `${t("cbm.fuelPer100")} (${t("c.m3")})` : `${t("cbm.fuelPer100")} (${t("c.liters")})`}
              you={carBench.you.fuelPer100}
              others={carBench.others.fuelPer100}
              fmt={(n) => fmtNum(n, locale)}
              youLabel={t("bm.you")}
              othersLabel={t("bm.others")}
              lowerIsBetter
            />
            <BenchMetric label={t("cbm.maintPerKm")} you={carBench.you.maintCostPerKm} others={carBench.others.maintCostPerKm} fmt={money} youLabel={t("bm.you")} othersLabel={t("bm.others")} lowerIsBetter />
          </div>
          <div className="text-xs text-muted mt-3 text-center">{t("bm.driverCount", { n: fmtNum(carBench.others.driverCount, locale, 0) })}</div>
          {carModelTip(carBench, t) && <div className="text-xs bg-warn-soft text-warn-ink rounded-lg px-3 py-2 mt-3">💡 {carModelTip(carBench, t)}</div>}
        </Card>
      )}

      {leaderboard && leaderboard.entries.length > 0 && (
        <Card>
          <CardHead icon="trophy" title={t("db.leaderboardTitle")} />
          <div className="space-y-1.5 mt-2">
            {leaderboard.entries.map((e: any, i: number) => (
              <div key={e.vehicleId} className={`flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 ${e.isYou ? "bg-white font-bold" : ""}`}>
                <span className="w-6 text-center text-muted">{i + 1}</span>
                <span className="flex-1">{e.isYou ? t("db.leaderboardYou") : e.label}</span>
                <span className="tnum">
                  {money(e.profitPerHour)}/{t("c.hours")}
                </span>
              </div>
            ))}
          </div>
          {leaderboard.yourRank && leaderboard.yourRank > leaderboard.entries.length && (
            <div className="text-xs text-muted mt-2 text-center">{t("db.leaderboardYourRank", { rank: leaderboard.yourRank, total: leaderboard.driverCount })}</div>
          )}
          <div className="text-xs text-muted mt-3 text-center">{t("bm.driverCount", { n: fmtNum(leaderboard.driverCount, locale, 0) })}</div>
        </Card>
      )}

      {attention.length > 0 && (
        <Card tone="warn">
          <CardHead icon="bell" title={t("db.remindersDue")} />
          <div className="space-y-1">
            {attention.map((r: any) => (
              <Link key={r.id} href={r.source === "service" ? "/maintenance" : "/reminders"} className="flex items-center gap-2 text-sm hover:bg-white/60 rounded-lg px-2 py-1.5">
                <Badge tone={r.state === "overdue" ? "bad" : "warn"}>{r.state === "overdue" ? t("rm.overdue") : t("rm.dueSoon")}</Badge>
                <span className="font-bold">{r.source === "service" ? t(`mn.cat.${r.category}`) : r.title}</span>
                {r.kmRemaining != null && (
                  <span className="text-xs text-muted">{r.kmRemaining >= 0 ? t("rm.inKm", { n: fmtNum(r.kmRemaining, locale) }) : t("rm.kmOverdue", { n: fmtNum(-r.kmRemaining, locale) })}</span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickAction({ href, icon, label, tone = "ink" }: { href: string; icon: any; label: string; tone?: "ink" | "warn" }) {
  return (
    <Link
      href={href}
      className={`flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2 rounded-2xl px-2 py-3 md:py-4 text-[13px] md:text-sm font-bold transition-colors active:scale-[0.98] ${
        tone === "warn" ? "bg-warn text-ink hover:brightness-95" : "bg-surface text-ink hover:bg-surface-2"
      }`}
    >
      <Icon name={icon} size={22} strokeWidth={2} />
      <span className="truncate max-w-full">{label}</span>
    </Link>
  );
}

function InkStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-white/60 uppercase tracking-wide truncate">{label}</div>
      <div className="text-lg md:text-xl font-bold display text-white mt-0.5 truncate">{value}</div>
    </div>
  );
}

function WeekClosedCard({ week, previous, t, locale }: { week: any; previous: any | null; t: (k: string, v?: Record<string, string | number>) => string; locale: string }) {
  const money = (n: number) => fmtMoney(n, locale);
  const [copied, setCopied] = useState(false);
  const shareText = t("db.recapShareText", {
    profit: money(week.trueProfit),
    hours: fmtNum(week.time.onlineMin / 60, locale),
    trips: fmtNum(week.counts.trips, locale, 0),
    perHour: week.rates.profitPerHour != null ? money(week.rates.profitPerHour) : "—",
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <Card tone="money">
      <CardHead
        icon="flag"
        title={t("wk.closedTitle")}
        sub={`${fmtDate(week.start, locale)} – ${fmtDate(new Date(new Date(week.end).getTime() - 1), locale)}`}
        actions={
          <Link href={`/weeks?week=${week.key}`} className="text-sm font-bold underline">
            {t("wk.details")}
          </Link>
        }
      />
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[34px] font-bold display leading-none" style={{ color: week.trueProfit >= 0 ? C.goodText : C.critical }}>
            {money(week.trueProfit)}
          </div>
          <div className="text-xs text-muted mt-1.5">
            {fmtNum(week.time.onlineMin / 60, locale)} {t("c.hours")} · {t("pl.tripsN", { n: week.counts.trips })} · {week.rates.profitPerHour != null ? `${money(week.rates.profitPerHour)}/${t("c.hours")}` : ""}
            {previous && previous.counts.trips > 0 && (
              <span className="ms-2">
                {t("wk.vsLastWeek")} <Delta value={week.trueProfit - previous.trueProfit} fmt={money} />
              </span>
            )}
          </div>
        </div>
        <Btn variant="secondary" size="sm" onClick={copy}>
          {copied ? `✓ ${t("db.recapCopied")}` : t("db.recapCopy")}
        </Btn>
      </div>
    </Card>
  );
}

function ViewToggle({ viewAll, setViewAll, t }: { viewAll: boolean; setViewAll: (v: boolean) => void; t: (k: string) => string }) {
  return (
    <Segmented
      size="sm"
      value={viewAll ? "all" : "one"}
      onChange={(v) => setViewAll(v === "all")}
      options={[
        { value: "one", label: t("cars.thisCar") },
        { value: "all", label: t("cars.allCars") },
      ]}
    />
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
      <Card className="border-line">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">🔥 {t("db.streakTitle")}</div>
            <p className="text-xs text-muted mt-1">{t("db.streakSetHint")}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-ink bg-surface-2 hover:bg-line border border-line rounded-lg px-3 py-2"
          >
            {t("db.streakSetGoal")}
          </button>
        </div>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="border-line">
        <div className="text-sm font-semibold mb-3">🔥 {t("db.streakSetGoal")}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-ink-500 mb-1">{t("db.streakHoursGoal")}</span>
            <input
              type="number"
              value={hoursGoal}
              onChange={(e) => setHoursGoal(e.target.value)}
              className="w-full rounded-xl border border-line px-3 h-11 text-sm"
              placeholder={t("c.optional")}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-500 mb-1">{t("db.streakProfitGoal")}</span>
            <input
              type="number"
              value={profitGoal}
              onChange={(e) => setProfitGoal(e.target.value)}
              className="w-full rounded-xl border border-line px-3 h-11 text-sm"
              placeholder={t("c.optional")}
            />
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg font-semibold bg-ink hover:bg-ink-700 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("c.save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg font-semibold bg-white hover:bg-surface-2 text-ink-700 border border-line px-4 py-2 text-sm"
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
    <Card className="border-line">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold">🔥 {t("db.streakTitle")}</div>
        <button onClick={() => setEditing(true)} className="text-xs text-muted underline">
          {t("db.streakEditGoal")}
        </button>
      </div>
      <div className="flex items-end gap-4 mb-3">
        <div className="text-3xl font-black text-ink">{streak.currentStreak}</div>
        <div className="text-xs text-muted mb-1">
          {t("db.streakWeeks", { n: streak.currentStreak })}
          {streak.longestStreak > streak.currentStreak && (
            <div className="text-muted">{t("db.streakBest", { n: streak.longestStreak })}</div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {hoursPct != null && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted">{t("db.streakHoursGoal")}</span>
              <span className="font-semibold">
                {fmtNum(streak.thisWeek.hours, locale)} / {fmtNum(streak.weeklyHoursGoal, locale)} {t("c.hours")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-money" style={{ width: `${hoursPct}%` }} />
            </div>
          </div>
        )}
        {profitPct != null && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted">{t("db.streakProfitGoal")}</span>
              <span className="font-semibold">
                {money(streak.thisWeek.profit)} / {money(streak.weeklyProfitGoal)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-money" style={{ width: `${profitPct}%` }} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

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
      <div className="text-xs text-muted mb-1 text-center">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-[10px] text-muted">{youLabel}</div>
          <div
            className="text-lg font-bold"
            style={{ fontVariantNumeric: "tabular-nums", color: youWins ? "#05a357" : undefined }}
          >
            {you != null ? fmt(you) : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted">{othersLabel}</div>
          <div className="text-lg font-bold text-ink-500" style={{ fontVariantNumeric: "tabular-nums" }}>
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
      <span className="text-muted flex-1">{label}</span>
      {cost && <span className="text-muted tnum">{cost}</span>}
      <span className="font-semibold tnum">{value}</span>
    </div>
  );
}

/** An indented breakdown line under a LegendRow. */
function SubRow({ label, value, cost }: { label: string; value: string; cost?: string }) {
  return (
    <div className="ps-5 flex items-center gap-2 text-muted">
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
            <span className="text-xs text-muted">{t("tg.soFar")}</span>
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

      <p className="text-[11px] text-muted mt-3">
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
      <div className="text-[10px] uppercase tracking-wide text-muted font-semibold truncate">{label}</div>
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
          className="absolute top-0 -translate-x-1/2 bg-white border border-line shadow-md rounded-lg px-2.5 py-1.5 text-xs pointer-events-none z-10"
          style={{ left: `${tip.x}%` }}
        >
          <div className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
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
