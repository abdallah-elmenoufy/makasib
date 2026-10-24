"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Btn, Card, CardHead, Delta, Empty, Hero, IconChip, Meter, PageTitle, Segmented, StackedMeter, Table, Tile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { QuickExpense } from "@/components/QuickExpense";
import { useVehicle } from "@/components/VehicleProvider";
import { BarChart, CHART, Ring } from "@/components/charts";
import { DriveCard } from "@/components/Drive";
import { ServiceAlertsCard } from "@/components/ServiceAlerts";
import { QuestCard } from "@/components/Quests";
import { PushPrompt } from "@/components/PushSettings";
import { Detailed, MoreDetailsButton, useViewMode, ViewModeToggle } from "@/components/ViewMode";
import { useOnChanged } from "@/components/dataBus";
import { fmtDate, fmtInt, fmtMoney, fmtMoneyShort, fmtNum, localizeDigits, sep } from "@/lib/format";

// semantic text colours; every series colour comes from components/charts (CSS tokens)
const C = {
  goodText: "var(--money)",
  critical: "var(--loss)",
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

function fmtDuration(min: number, t: (k: string) => string, locale = "en"): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${fmtInt(m, locale)}${t("c.minShort")}`;
  return `${fmtInt(h, locale)}${t("c.hours")} ${localizeDigits(m.toString().padStart(2, "0"), locale)}${t("c.minShort")}`;
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
  const { mode } = useViewMode();
  const simple = mode === "simple";
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
  const [nowHint, setNowHint] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [plannedHours, setPlannedHours] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  // a trip or shift saved from the drive sheet refreshes every figure here
  useOnChanged(reload);
  // the simple view only offers today and this week
  useEffect(() => {
    if (simple && period !== "today" && period !== "week") setPeriod("week");
  }, [simple, period]);

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
    fetch(`/api/now?vehicleId=${vehicle.id}`).then((r) => (r.ok ? r.json() : null)).then(setNowHint);
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
        <Link href="/cars" className="text-action underline font-bold">
          {t("db.noVehicle")}
        </Link>
      </Empty>
    );
  }

  const money = (n: number) => fmtMoney(n, locale);
  const moneyShort = (n: number) => fmtMoneyShort(n, locale);
  const periodPicker = (
    <Segmented
      value={period}
      onChange={setPeriod}
      size="sm"
      options={PERIODS.filter((p) => !simple || p === "today" || p === "week").map((p) => ({ value: p, label: t(PERIOD_KEY[p]) }))}
    />
  );
  const titleActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <ViewModeToggle />
      {!simple && activeVehicles.length > 1 && <ViewToggle viewAll={viewAll} setViewAll={setViewAll} t={t} />}
    </div>
  );

  if (viewAll) {
    if (!profile) return null;
    const p = profile.totals;
    return (
      <div className="space-y-4">
        <PageTitle actions={titleActions}>{t("db.title")}</PageTitle>
        {periodPicker}
        <Card tone="ink">
          <Hero label={t("db.trueProfit")} value={money(p.trueProfit)} tone={p.trueProfit >= 0 ? "ink" : "loss"} sub={<span className="text-hero-fg/60">{t("cars.allCarsSub")}</span>} />
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-hero-fg/15">
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
  const showWeekClose = weeks?.lastClosed && cur && cur.progress < 2 / 7; // first two days of the new week

  return (
    <div className="space-y-4">
      <PageTitle sub={fmtDate(new Date(), locale)} actions={titleActions}>
        {t("db.title")}
      </PageTitle>

      {/* start / live shift / end — the one card a driver taps all day */}
      <DriveCard />

      {/* parts at 80%+ of their life (red from 90%) stay here until changed */}
      <ServiceAlertsCard reminders={a.reminders} vehicleId={vehicle.id} currentOdo={a.currentOdo ?? null} />

      {periodPicker}

      {/* hero: Uber earnings-screen style */}
      <Card tone="ink">
        <Hero
          label={t("db.trueProfit")}
          value={money(a.trueProfit)}
          tone={a.trueProfit >= 0 ? "ink" : "loss"}
          size="xl"
          sub={
            <span className="text-hero-fg/70">
              {simple ? t("db.profitSubSimple") : dep.enabled ? t("db.profitSub") : t("db.profitSubNoDep")}
              {period === "week" && cur && weeks.previousAtSamePoint && weeks.previousAtSamePoint.netRevenue > 0 && (
                <span className="block mt-1 text-hero-fg/80">
                  {t("wk.vsSamePoint")} <Delta value={a.earnings.netRevenue - weeks.previousAtSamePoint.netRevenue} fmt={money} />
                </span>
              )}
            </span>
          }
        />
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-hero-fg/15">
          <InkStat label={t("db.gross")} value={moneyShort(a.earnings.netRevenue)} />
          {simple ? <InkStat label={t("db.tripCount")} value={fmtInt(a.counts.trips, locale)} /> : <InkStat label={t("db.cashProfit")} value={moneyShort(a.cashProfit)} />}
          <InkStat label={t("db.perHour")} value={a.perHour != null ? moneyShort(a.perHour) : "—"} />
        </div>
        {period === "week" && cur && (
          <div className="mt-4 pt-4 border-t border-hero-fg/15">
            <div className="flex items-center justify-between text-xs text-hero-fg/70 mb-1.5">
              <span>
                {t("wk.uberWeek")}{sep(locale)}{fmtDate(cur.start, locale)} – {fmtDate(new Date(new Date(cur.end).getTime() - 1), locale)}
              </span>
              <span className="tnum">{fmtCountdown(weeks.msUntilClose, t)}</span>
            </div>
            <div className="h-2 rounded-full bg-hero-fg/15 overflow-hidden">
              <div className="h-full bg-[var(--hero-accent)] rounded-full" style={{ width: `${Math.round(cur.progress * 100)}%` }} />
            </div>
            {weeks.projection && (
              <div className="text-xs text-hero-fg/70 mt-2">
                {t("wk.onPace", { v: money(weeks.projection.trueProfit), n: weeks.projection.trips })}
                {weeks.previous && weeks.previous.trueProfit !== 0 && (
                  <>
                    {sep(locale)}
                    {t("wk.vsLastWeek")} <Delta value={weeks.projection.trueProfit - weeks.previous.trueProfit} fmt={money} />
                  </>
                )}
              </div>
            )}
            <Link href="/weeks" className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-hero-fg">
              {t("wk.seeWeekly")} <Icon name="chevron" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
        )}
      </Card>

      <Detailed>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon="clock" label={t("db.hoursWorked")} value={fmtNum(a.counts.hoursWorked, locale)} sub={`${t("db.shiftCount")} ${fmtNum(a.counts.shifts, locale, 0)}`} />
        <Tile icon="car" label={t("db.tripCount")} value={fmtNum(a.counts.trips, locale, 0)} sub={a.counts.trips > 0 ? `${money(a.earnings.netRevenue / a.counts.trips)} ${t("wk.perTrip")}` : undefined} />
        <Tile icon="road" label={t("db.perKm")} value={a.perKm != null ? money(a.perKm) : "—"} sub={`${fmtNum(km.shiftKm, locale, 0)} ${t("c.km")}`} />
        <Tile icon="timer" label={t("tm.utilization")} value={time.utilizationPct != null ? `${fmtNum(time.utilizationPct, locale, 0)}%` : "—"} sub={t("tm.utilizationSub")} />
      </div>
      </Detailed>

      {/* today's target */}
      {target && <DailyTargetCard target={target} onHours={setPlannedHours} t={t} locale={locale} simple={simple} />}

      {/* a platform quest: entered once, progress counted from logged trips */}
      <QuestCard />
      <PushPrompt />

      {/* where to go right now — this hour, this kind of day, from the driver's own trips */}
      {nowHint && <WhereNowCard hint={nowHint} t={t} locale={locale} />}

      {/* week closed recap — the first days after Monday 04:00 */}
      {showWeekClose && <WeekClosedCard week={weeks.lastClosed} previous={weeks.weeks[weeks.weeks.length - 3] ?? null} t={t} locale={locale} />}


      {/* time split */}
      <Detailed>
      <Card>
        <CardHead icon="timer" title={t("tm.title")} sub={t("tm.sub")} />
        {time.onlineMin <= 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <>
            <StackedMeter
              height={14}
              segments={[
                { key: "trip", value: time.tripMin, color: CHART.s1, label: t("tm.withRider") },
                { key: "pickup", value: time.pickupMin, color: CHART.s2, label: t("tm.toPickup") },
                { key: "idle", value: time.idleMin, color: CHART.neutral, label: t("tm.idle") },
              ]}
            />
            <div className="mt-3 space-y-1 text-xs">
              <LegendRow color={CHART.s1} label={t("tm.withRider")} value={fmtDuration(time.tripMin, t, locale)} cost={time.onlineMin > 0 ? `${fmtNum((time.tripMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <LegendRow color={CHART.s2} label={t("tm.toPickup")} value={fmtDuration(time.pickupMin, t, locale)} cost={time.onlineMin > 0 ? `${fmtNum((time.pickupMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <LegendRow color={CHART.neutral} label={t("tm.idle")} value={fmtDuration(time.idleMin, t, locale)} cost={time.onlineMin > 0 ? `${fmtNum((time.idleMin / time.onlineMin) * 100, locale, 0)}%` : undefined} />
              <div className="flex justify-between pt-2 mt-1 border-t border-line font-bold">
                <span>{t("tm.online")}</span>
                <span className="tnum">{fmtDuration(time.onlineMin, t, locale)}</span>
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
      </Detailed>

      {/* running costs in one tap */}
      <Card>
        <CardHead icon="receipt" title={t("qx.title")} sub={t("qx.sub")} />
        <QuickExpense vehicleId={vehicle.id} recent={expenses} onAdded={reload} />
      </Card>

      {streak && vehicle && <StreakCard streak={streak} vehicleId={vehicle.id} t={t} locale={locale} />}

      {/* daily profit + costs */}
      <div className={`grid grid-cols-1 ${simple ? "" : "md:grid-cols-2"} gap-3`}>
        <Card>
          <CardHead icon="chart" title={t("db.profitTrend14", { n: 14 })} />
          <ProfitBars data={a.trend} locale={locale} />
        </Card>

        <Detailed>
        <Card>
          <CardHead
            icon="receipt"
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
                  <div className="flex justify-between text-[13px] mb-1.5 gap-2">
                    <span className="text-ink-500 min-w-0 truncate">
                      {t(r.key)}
                      {r.note && <span className="text-muted-2 ms-1.5">{r.note}</span>}
                    </span>
                    <span className="font-bold whitespace-nowrap tnum">{money(r.v)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.v / maxCost) * 100}%`, background: `linear-gradient(90deg, ${CHART.s1}, ${CHART.top})` }} />
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
        </Detailed>
      </div>

      <Detailed>
      {/* platform */}
      {platformStats && platformStats.length > 1 && (
        <Card>
          <CardHead icon="car" title={t("db.platformTitle")} sub={t("db.platformSub")} />
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
              { key: "trip", value: km.tripKm, color: CHART.s1, label: t("db.tripKm") },
              { key: "dead", value: km.deadKm, color: CHART.s2, label: t("db.deadKm") },
              { key: "personal", value: km.personalKm, color: CHART.neutral, label: t("db.personalKm") },
            ]}
          />
          <div className="mt-3 space-y-1 text-xs">
            <LegendRow color={CHART.s1} label={t("db.tripKm")} value={`${fmtNum(km.tripKm, locale)} ${t("c.km")}`} />
            <LegendRow color={CHART.s2} label={t("db.deadKm")} value={`${fmtNum(km.deadKm, locale)} ${t("c.km")}`} cost={money(km.deadKm * costPerKm)} />
            {km.pickupKm > 0 && (
              <>
                <SubRow label={t("db.pickupSplit")} value={`${fmtNum(km.pickupKm, locale)} ${t("c.km")}`} cost={money(km.pickupKm * costPerKm)} />
                <SubRow label={t("db.cruisingSplit")} value={`${fmtNum(km.cruisingKm, locale)} ${t("c.km")}`} cost={money(km.cruisingKm * costPerKm)} />
              </>
            )}
            <LegendRow color={CHART.neutral} label={t("db.personalKm")} value={`${fmtNum(km.personalKm, locale)} ${t("c.km")}`} />
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
                  <div key={f.fuelGroup} className="bg-paper rounded-xl p-3">
                    <div className="text-xs font-bold text-ink-500 mb-2">{f.fuelGroup === "CNG" ? t("fu.CNG") : t("veh.fuel.PETROL").split(" ")[0]}</div>
                    <div className="text-[30px] font-bold display leading-none">
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
          <CardHead icon="bolt" title={t("bm.title")} />
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
          <CardHead
            icon="wrench"
            title={t("cbm.title", { car: `${carBench.carModel.make} ${carBench.carModel.model}${carBench.gearboxMatched ? ` (${t(`veh.trans.${carBench.gearbox}`)})` : ""}` })}
            sub={carBench.gearbox && !carBench.gearboxMatched ? t("cbm.anyGearbox", { gearbox: t(`veh.trans.${carBench.gearbox}`) }) : undefined}
          />
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
              <div key={e.vehicleId} className={`flex items-center gap-3 text-[15px] rounded-xl px-3 py-2 ${e.isYou ? "bg-action-soft font-bold" : ""}`}>
                <span className="w-6 text-center text-muted tnum">{fmtInt(i + 1, locale)}</span>
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

      </Detailed>

      <MoreDetailsButton />
    </div>
  );
}

function WhereNowCard({ hint, t, locale }: { hint: any; t: (k: string, v?: Record<string, string | number>) => string; locale: string }) {
  const money = (n: number) => fmtMoney(n, locale);
  const slot = `${String(hint.hour).padStart(2, "0")}:00–${String((hint.hour + 1) % 24).padStart(2, "0")}:00`;
  return (
    <Card>
      <CardHead
        icon="pin"
        title={t("now.title")}
        sub={hint.enoughData ? t("now.sub", { slot, kind: t(hint.isWeekend ? "now.weekend" : "now.weekday") }) : t("now.learning", { n: hint.sampleTrips, min: 5 })}
        actions={
          <Link href="/plan" className="inline-flex items-center gap-0.5 text-xs font-bold text-action">
            {t("nav.plan")} <Icon name="chevron" size={14} className="rtl:rotate-180" />
          </Link>
        }
      />
      {hint.enoughData && (
        <>
          <div className="flex items-baseline gap-3 flex-wrap mb-3">
            {hint.netPerTripHour != null && (
              <span className="text-sm">
                <b className="text-[28px] display">{money(hint.netPerTripHour)}</b> <span className="text-muted">{t("now.perRiderHour")}</span>
              </span>
            )}
            {hint.avgNetPerTrip != null && (
              <span className="text-sm">
                <b className="text-[28px] display">{money(hint.avgNetPerTrip)}</b> <span className="text-muted">{t("wk.perTrip")}</span>
              </span>
            )}
          </div>
          {hint.zones.length === 0 ? (
            <p className="text-xs text-muted">{t("now.noZones")}</p>
          ) : (
            <div className="rows">
              {hint.zones.map((z: any, i: number) => (
                <div key={z.key} className="flex items-center gap-3 py-2.5">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${i === 0 ? "brand-gradient text-white" : "bg-paper text-muted"} tnum`}>{fmtInt(i + 1, locale)}</span>
                  <span className="flex-1 min-w-0">
                    <span dir="auto" className="block text-[15px] font-bold truncate">{z.label}</span>
                    <span className="block text-xs text-muted">{t("pl.tripsN", { n: z.trips })}</span>
                  </span>
                  <span className="text-end">
                    <span className="block text-base font-bold tnum text-money">{money(z.avgNet)}</span>
                    <span className="block text-xs text-muted">{z.perMin != null ? `${money(z.perMin)}/${t("c.minShort")}` : t("wk.perTrip")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {hint.nextBest && (
            <p className="text-xs text-muted mt-3">
              {t("now.nextBest", { h: `${String(hint.nextBest.hour).padStart(2, "0")}:00`, v: money(hint.nextBest.avgNet) })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function InkStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-bold text-hero-fg/70 truncate">{label}</div>
      <div className="text-[19px] sm:text-2xl md:text-[28px] font-bold display text-hero-fg mt-1 truncate">{value}</div>
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
          <div className="text-[44px] font-bold display leading-none" style={{ color: week.trueProfit >= 0 ? C.goodText : C.critical }}>
            {money(week.trueProfit)}
          </div>
          <div className="text-xs text-muted mt-1.5">
            {fmtNum(week.time.onlineMin / 60, locale)} {t("c.hours")}{sep(locale)}{t("pl.tripsN", { n: week.counts.trips })}{sep(locale)}{week.rates.profitPerHour != null ? `${money(week.rates.profitPerHour)}/${t("c.hours")}` : ""}
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
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <IconChip icon="🔥" tint="tint-amber" size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold">{t("db.streakTitle")}</div>
            <p className="text-xs text-muted mt-0.5">{t("db.streakSetHint")}</p>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t("db.streakSetGoal")}
          </Btn>
        </div>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <CardHead icon="🔥" title={t("db.streakSetGoal")} />
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
            className="rounded-lg font-semibold bg-action hover:bg-action-700 text-action-fg px-4 py-2 text-sm disabled:opacity-50"
          >
            {t("c.save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg font-semibold bg-paper hover:bg-surface-2 text-ink-700 border border-line px-4 py-2 text-sm"
          >
            {t("c.cancel")}
          </button>
        </div>
      </Card>
    );
  }

  const hoursRatio = streak.weeklyHoursGoal ? streak.thisWeek.hours / streak.weeklyHoursGoal : null;
  const profitRatio = streak.weeklyProfitGoal ? streak.thisWeek.profit / streak.weeklyProfitGoal : null;

  return (
    <Card>
      <CardHead
        icon="🔥"
        title={t("db.goalsTitle")}
        actions={
          <button onClick={() => setEditing(true)} className="text-xs font-bold text-ink-500 underline underline-offset-4">
            {t("db.streakEditGoal")}
          </button>
        }
      />
      <div className="flex items-center justify-around gap-4 flex-wrap">
        {profitRatio != null && (
          <div className="flex flex-col items-center">
            <Ring ratio={profitRatio} size={124} label={t("db.streakProfitGoal")}>
              <span className="text-[26px] font-bold display leading-none">{fmtNum(Math.min(999, profitRatio * 100), locale, 0)}%</span>
            </Ring>
            <div className="text-[13px] font-bold mt-2">{t("db.streakProfitGoal")}</div>
            <div className="text-xs text-muted tnum">
              {money(streak.thisWeek.profit)} / {money(streak.weeklyProfitGoal)}
            </div>
          </div>
        )}
        {hoursRatio != null && (
          <div className="flex flex-col items-center">
            <Ring ratio={hoursRatio} size={124} label={t("db.streakHoursGoal")}>
              <span className="text-[26px] font-bold display leading-none">{fmtNum(Math.min(999, hoursRatio * 100), locale, 0)}%</span>
            </Ring>
            <div className="text-[13px] font-bold mt-2">{t("db.streakHoursGoal")}</div>
            <div className="text-xs text-muted tnum">
              {fmtNum(streak.thisWeek.hours, locale)} / {fmtNum(streak.weeklyHoursGoal, locale)} {t("c.hours")}
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center min-w-[7rem]">
          <div className="w-[88px] h-[88px] rounded-full tint-amber flex flex-col items-center justify-center">
            <span className="text-[34px] font-bold display leading-none">{fmtInt(streak.currentStreak, locale)}</span>
          </div>
          <div className="text-[13px] font-bold mt-2 text-center">{t("db.streakWeeks", { n: streak.currentStreak })}</div>
          {streak.longestStreak > streak.currentStreak && <div className="text-xs text-muted">{t("db.streakBest", { n: streak.longestStreak })}</div>}
        </div>
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
      <div className="text-[13px] font-bold text-ink-500 mb-2 text-center">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-[11px] font-bold text-muted">{youLabel}</div>
          <div
            className="text-2xl font-bold display"
            style={{ fontVariantNumeric: "tabular-nums", color: youWins ? "var(--money)" : undefined }}
          >
            {you != null ? fmt(you) : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[11px] font-bold text-muted">{othersLabel}</div>
          <div className="text-2xl font-bold display text-ink-500">
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
    <div className="flex items-center gap-2 text-[13px] py-0.5">
      <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-ink-500 flex-1">{label}</span>
      {cost && <span className="text-muted tnum">{cost}</span>}
      <span className="font-bold tnum">{value}</span>
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
  simple = false,
}: {
  target: any;
  onHours: (h: number) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: string;
  simple?: boolean;
}) {
  const money = (n: number) => fmtMoney(n, locale);
  if (!target.hasBasis) {
    return (
      <Card>
        <CardHead icon="flag" title={t("tg.title")} sub={t("tg.needMoreData")} />
      </Card>
    );
  }

  const { today, breakEvenRevenue } = target;
  // a zero target would divide the bar and the ring by nothing
  const targetRevenue = Math.max(target.targetRevenue, 1);
  const scale = Math.max(targetRevenue, today.netRevenue, 1);
  const clearedBreakEven = today.netRevenue >= breakEvenRevenue;
  const hitTarget = today.netRevenue >= targetRevenue;
  const remaining = Math.max(0, targetRevenue - today.netRevenue);
  const pct = Math.min(999, (today.netRevenue / targetRevenue) * 100);

  const hoursStepper = (
    <div className="flex items-center gap-1 rounded-full bg-paper p-1">
      <button type="button" aria-label="−" onClick={() => onHours(Math.max(1, target.plannedHours - 1))} className="w-8 h-8 rounded-full bg-sheet shadow-[var(--shadow-sm)] font-bold text-lg leading-none">
        −
      </button>
      <span className="text-sm font-bold tnum w-14 text-center">
        {fmtNum(target.plannedHours, locale)} {t("c.hours")}
      </span>
      <button type="button" aria-label="+" onClick={() => onHours(target.plannedHours + 1)} className="w-8 h-8 rounded-full bg-sheet shadow-[var(--shadow-sm)] font-bold text-lg leading-none">
        +
      </button>
    </div>
  );

  return (
    <Card>
      <CardHead icon="flag" title={t("tg.title")} sub={simple ? undefined : t(`tg.sub.${target.targetSource}`)} actions={hoursStepper} />

      <div className="flex items-center gap-5">
        <Ring ratio={today.netRevenue / targetRevenue} size={simple ? 120 : 136} label={t("tg.title")}>
          <span className="text-[28px] font-bold display leading-none">{fmtNum(pct, locale, 0)}%</span>
          <span className="text-[11px] font-bold text-muted mt-1">{t("tg.ofDay")}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{t("tg.soFar")}</div>
          <div className={`text-[34px] font-bold display leading-none mt-1 ${hitTarget ? "text-money" : ""}`}>{money(today.netRevenue)}</div>
          <div className="text-sm font-bold mt-2">
            {hitTarget ? (
              <span className="text-money">🎉 {t("tg.hit")}</span>
            ) : (
              <span>
                <span className="tnum">{money(remaining)}</span> <span className="text-muted font-semibold">{t("tg.toGo", { v: money(targetRevenue) })}</span>
              </span>
            )}
          </div>
          {!clearedBreakEven && !simple && <div className="text-xs text-warn-ink mt-1">{t("tg.breakEvenLeft", { v: money(breakEvenRevenue - today.netRevenue) })}</div>}
        </div>
      </div>

      {!simple && (
        <>
          <div className="mt-5">
            <Meter
              ratio={today.netRevenue / scale}
              tone={hitTarget ? "good" : clearedBreakEven ? "brand" : "warn"}
              marker={{
                ratio: breakEvenRevenue / scale,
                label: t("tg.breakEvenMark", { v: money(breakEvenRevenue) }),
              }}
              value={t("tg.ofTarget", { v: money(targetRevenue) })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <TargetStat label={t("tg.toBreakEven")} value={clearedBreakEven ? t("tg.cleared") : money(breakEvenRevenue - today.netRevenue)} tone={clearedBreakEven ? "good" : "warn"} />
            <TargetStat label={t("tg.toTarget")} value={hitTarget ? t("tg.hit") : money(remaining)} tone={hitTarget ? "good" : "default"} />
            <TargetStat
              label={t("tg.perHourNeeded")}
              value={target.perHourNeeded != null && remaining > 0 ? `${money(target.perHourNeeded)}/${t("c.hours")}` : "—"}
              tone="default"
            />
          </div>
          <p className="text-[11px] text-muted mt-3">
            {t("tg.costCaption", { perHour: money(target.costPerHour ?? 0), perKm: money(target.costPerKm) })}
            {sep(locale)}
            {t("tg.footnote", {
              hours: fmtNum(target.plannedHours, locale),
              kmh: fmtNum(target.kmPerHour ?? 0, locale, 0),
              hourly: money(target.typicalHourly ?? 0),
              fixed: money(target.fixedDailyCost),
            })}
          </p>
        </>
      )}
    </Card>
  );
}

function TargetStat({ label, value, tone }: { label: string; value: string; tone: "default" | "good" | "warn" }) {
  const color = tone === "good" ? C.goodText : tone === "warn" ? C.critical : undefined;
  return (
    <div className="min-w-0 rounded-2xl bg-paper px-3.5 py-2.5 flex sm:block items-center justify-between gap-3">
      <div className="text-[13px] sm:text-[11px] text-ink-500 sm:text-muted font-bold truncate">{label}</div>
      <div className="text-base font-bold tnum truncate sm:mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/** 14-day profit bars on the shared chart kit; the best day is labelled. */
function ProfitBars({ data, locale }: { data: { date: string; profit: number; gross: number }[]; locale: string }) {
  return (
    <BarChart
      height={160}
      locale={locale}
      fmt={(v) => fmtMoney(v, locale)}
      labelEvery={2}
      bars={data.map((d) => ({ key: d.date, label: d.date.slice(5).replace("-", "/"), value: d.profit, sub: fmtDate(d.date, locale) }))}
    />
  );
}
