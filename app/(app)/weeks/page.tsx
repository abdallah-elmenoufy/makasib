"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Btn, Card, CardHead, Delta, Empty, Hero, ListRow, PageTitle, Segmented, StackedMeter, Table, Tile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";

// validated reference palette (light): series + sequential ramp
const C = {
  s1: "#2a78d6",
  s2: "#eb6834",
  s4: "#eda100",
  neutral: "#c3c2b7",
  neg: "#e34948",
  ink: "#000000",
  grid: "#e1e0d9",
  muted: "#898781",
};
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#0d366b"];

type T = (k: string, vars?: Record<string, string | number>) => string;

function fmtDuration(min: number, t: T): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}${t("c.minShort")}`;
  return `${h}${t("c.hours")} ${String(m).padStart(2, "0")}${t("c.minShort")}`;
}

function dayName(index: number, locale: string, style: "short" | "long" = "short"): string {
  // 2026-10-12 is a Monday; index 0 = Monday in the pay week
  const d = new Date(2026, 9, 12 + index);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: style }).format(d);
}

function weekLabel(w: any, locale: string): string {
  const end = new Date(new Date(w.end).getTime() - 1);
  return `${fmtDate(w.start, locale)} – ${fmtDate(end, locale)}`;
}

export default function WeeksPage() {
  return (
    <Suspense>
      <WeeksInner />
    </Suspense>
  );
}

function WeeksInner() {
  const { t, locale } = useI18n();
  const { vehicle, loading } = useVehicle();
  const params = useSearchParams();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [span, setSpan] = useState<12 | 26 | 52>(12);
  const [metric, setMetric] = useState<"profit" | "net" | "hours" | "perHour">("profit");
  const [zoneScope, setZoneScope] = useState<"week" | "all">("week");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/weeks?vehicleId=${vehicle.id}&weeks=${span}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport);
  }, [vehicle, span]);

  const selectedKey = params.get("week");
  const week = useMemo(() => {
    if (!report) return null;
    return report.weeks.find((w: any) => w.key === selectedKey) ?? report.current;
  }, [report, selectedKey]);
  const select = (key: string) => router.replace(`/weeks?week=${key}`);

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-ink underline font-bold">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }
  if (!report || !week) return null;

  const money = (n: number) => fmtMoney(n, locale);
  const weeks: any[] = report.weeks;
  const idx = weeks.findIndex((w) => w.key === week.key);
  const prev = idx > 0 ? weeks[idx - 1] : null;
  const bestKey = report.best.byProfit;
  const bestWeek = bestKey ? weeks.find((w) => w.key === bestKey) : null;
  const isBest = bestKey === week.key;
  const d = (f: (w: any) => number | null) => (prev ? (f(week) != null && f(prev) != null ? f(week)! - f(prev)! : null) : null);
  const hasData = week.counts.trips > 0 || week.counts.shifts > 0;
  const costPerKm = report.rates.fuelCostPerKm + report.rates.maintCostPerKm + report.rates.depPerKm;

  const share = async () => {
    const text = t("wk.shareText", {
      range: weekLabel(week, locale),
      profit: money(week.trueProfit),
      net: money(week.earnings.netRevenue),
      trips: week.counts.trips,
      hours: fmtNum(week.time.onlineMin / 60, locale),
      perHour: week.rates.profitPerHour != null ? money(week.rates.profitPerHour) : "—",
      km: fmtNum(week.km.shiftKm, locale, 0),
    });
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const metricOf = (w: any): number | null =>
    metric === "profit" ? w.trueProfit : metric === "net" ? w.earnings.netRevenue : metric === "hours" ? w.time.onlineMin / 60 : w.rates.profitPerHour;
  const metricFmt = (v: number) => (metric === "hours" ? `${fmtNum(v, locale)} ${t("c.hours")}` : money(v));

  return (
    <div className="space-y-4">
      <PageTitle sub={t("wk.subtitle")}>{t("wk.title")}</PageTitle>

      {/* week picker — newest first, scrolls sideways on a phone */}
      <div className="flex gap-2 overflow-x-auto scroll-x [scrollbar-width:none] -mx-4 px-4 md:mx-0 md:px-0 pb-1">
        {[...weeks].reverse().map((w) => {
          const active = w.key === week.key;
          return (
            <button
              key={w.key}
              onClick={() => select(w.key)}
              className={`shrink-0 rounded-2xl px-3.5 py-2 text-start transition-colors ${active ? "bg-ink text-white" : "bg-surface hover:bg-surface-2"}`}
            >
              <span className={`block text-[11px] font-bold ${active ? "text-white/60" : "text-muted"}`}>
                {w.isCurrent ? t("wk.current") : w.key === report.best.byProfit ? `🏆 ${t("wk.best")}` : fmtDate(w.start, locale)}
              </span>
              <span className={`block text-sm font-bold tnum ${!active && w.trueProfit < 0 ? "text-loss" : ""}`}>{w.counts.trips > 0 || w.counts.shifts > 0 ? money(w.trueProfit) : "—"}</span>
            </button>
          );
        })}
        <Segmented
          size="sm"
          value={String(span) as "12" | "26" | "52"}
          onChange={(v) => setSpan(Number(v) as 12 | 26 | 52)}
          className="shrink-0 self-center ms-1"
          options={[
            { value: "12", label: "12" },
            { value: "26", label: "26" },
            { value: "52", label: "52" },
          ]}
        />
      </div>

      {/* hero */}
      <Card tone="ink">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-bold">{weekLabel(week, locale)}</span>
          {week.isCurrent ? (
            <Badge tone="neutral">
              {t("wk.inProgress")} · {fmtNum(week.progress * 100, locale, 0)}%
            </Badge>
          ) : (
            <Badge tone="neutral">{t("wk.closed")}</Badge>
          )}
          {isBest && <Badge tone="good">🏆 {t("wk.bestWeek")}</Badge>}
          {week.goals.metProfit === true && <Badge tone="good">{t("wk.goalMet")}</Badge>}
          <button onClick={share} className="ms-auto inline-flex items-center gap-1 text-xs font-bold text-white/80 hover:text-white">
            <Icon name="download" size={14} /> {copied ? t("db.recapCopied") : t("wk.share")}
          </button>
        </div>
        {!hasData ? (
          <Empty>
            <span className="text-white/60">{t("wk.noData")}</span>
          </Empty>
        ) : (
          <>
            <Hero
              label={t("db.trueProfit")}
              value={money(week.trueProfit)}
              tone={week.trueProfit >= 0 ? "ink" : "loss"}
              size="xl"
              sub={
                <span className="text-white/70 flex items-center gap-2 flex-wrap">
                  {prev && prev.counts.trips > 0 && (
                    <>
                      {t("wk.vsLastWeek")} <Delta value={d((w) => w.trueProfit)} fmt={money} />
                    </>
                  )}
                  {bestWeek && !isBest && (
                    <>
                      · {t("wk.vsBest")} <Delta value={week.trueProfit - bestWeek.trueProfit} fmt={money} />
                    </>
                  )}
                </span>
              }
            />
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/15">
              <InkStat label={t("db.gross")} value={money(week.earnings.netRevenue)} delta={<Delta value={d((w) => w.earnings.netRevenue)} fmt={money} />} />
              <InkStat label={t("db.cashProfit")} value={money(week.cashProfit)} />
              <InkStat label={t("db.perHour")} value={week.rates.profitPerHour != null ? money(week.rates.profitPerHour) : "—"} delta={<Delta value={d((w) => w.rates.profitPerHour)} fmt={money} />} />
            </div>
            {week.isCurrent && report.projection && (
              <p className="text-xs text-white/70 mt-4">
                {t("wk.onPace", { v: money(report.projection.trueProfit), n: report.projection.trips })}
                {report.previousAtSamePoint && report.previousAtSamePoint.netRevenue > 0 && (
                  <>
                    {" · "}
                    {t("wk.vsSamePoint")} <Delta value={week.earnings.netRevenue - report.previousAtSamePoint.netRevenue} fmt={money} />
                  </>
                )}
              </p>
            )}
          </>
        )}
      </Card>

      {hasData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label={t("db.tripCount")} value={fmtNum(week.counts.trips, locale, 0)} delta={<Delta value={d((w) => w.counts.trips)} />} sub={week.rates.netPerTrip != null ? `${money(week.rates.netPerTrip)} ${t("wk.perTrip")}` : undefined} />
            <Tile label={t("tm.online")} value={fmtDuration(week.time.onlineMin, t)} delta={<Delta value={d((w) => w.time.onlineMin / 60)} fmt={(n) => fmtNum(n, locale)} suffix={t("c.hours")} />} sub={t("sh.shiftCount", { n: week.counts.shifts })} />
            <Tile label={t("sh.km")} value={`${fmtNum(week.km.shiftKm, locale, 0)} ${t("c.km")}`} delta={<Delta value={d((w) => w.km.shiftKm)} fmt={(n) => fmtNum(n, locale, 0)} />} sub={week.rates.profitPerKm != null ? `${money(week.rates.profitPerKm)}/${t("c.km")}` : undefined} />
            <Tile label={t("tm.utilization")} value={week.time.utilizationPct != null ? `${fmtNum(week.time.utilizationPct, locale, 0)}%` : "—"} delta={<Delta value={d((w) => w.time.utilizationPct)} fmt={(n) => fmtNum(n, locale, 0)} suffix="%" />} sub={t("tm.utilizationSub")} />
          </div>

          {/* week-over-week chart */}
          <Card>
            <CardHead title={t("wk.trendTitle")} sub={t("wk.trendSub")} />
            <Segmented
              size="sm"
              className="mb-3"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "profit", label: t("db.trueProfit") },
                { value: "net", label: t("db.gross") },
                { value: "hours", label: t("c.hours") },
                { value: "perHour", label: t("db.perHour") },
              ]}
            />
            <WeekBars weeks={weeks} selected={week.key} onSelect={select} valueOf={metricOf} fmt={metricFmt} locale={locale} />
          </Card>

          {/* day by day */}
          <Card>
            <CardHead icon="calendar" title={t("wk.daysTitle")} sub={t("wk.daysSub")} />
            <DayRows days={week.days} bestIndex={week.bestDay?.index ?? null} locale={locale} t={t} />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* time */}
            <Card>
              <CardHead icon="timer" title={t("tm.title")} sub={t("wk.timeSub")} />
              <StackedMeter
                height={14}
                segments={[
                  { key: "trip", value: week.time.tripMin, color: C.s1, label: t("tm.withRider") },
                  { key: "pickup", value: week.time.pickupMin, color: C.s2, label: t("tm.toPickup") },
                  { key: "idle", value: week.time.idleMin, color: C.neutral, label: t("tm.idle") },
                ]}
              />
              <div className="mt-3 space-y-1 text-xs">
                <Legend color={C.s1} label={t("tm.withRider")} value={fmtDuration(week.time.tripMin, t)} pct={week.time.onlineMin > 0 ? (week.time.tripMin / week.time.onlineMin) * 100 : null} locale={locale} />
                <Legend color={C.s2} label={t("tm.toPickup")} value={fmtDuration(week.time.pickupMin, t)} pct={week.time.onlineMin > 0 ? (week.time.pickupMin / week.time.onlineMin) * 100 : null} locale={locale} />
                <Legend color={C.neutral} label={t("tm.idle")} value={fmtDuration(week.time.idleMin, t)} pct={week.time.onlineMin > 0 ? (week.time.idleMin / week.time.onlineMin) * 100 : null} locale={locale} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Mini label={t("wk.avgTripMin")} value={week.time.avgTripMin != null ? `${fmtNum(week.time.avgTripMin, locale, 0)} ${t("c.minShort")}` : "—"} />
                <Mini label={t("wk.avgPickupMin")} value={week.time.avgPickupMin != null ? `${fmtNum(week.time.avgPickupMin, locale, 0)} ${t("c.minShort")}` : "—"} />
                <Mini label={t("wk.netPerOnlineHour")} value={week.rates.netPerHour != null ? money(week.rates.netPerHour) : "—"} />
                <Mini label={t("wk.netPerTripHour")} value={week.rates.netPerTripHour != null ? money(week.rates.netPerTripHour) : "—"} />
              </div>
              {week.time.tripMin === 0 && <p className="text-xs text-warn-ink bg-warn-soft rounded-lg px-3 py-2 mt-3">{t("tm.needMinutes")}</p>}
            </Card>

            {/* km */}
            <Card>
              <CardHead icon="road" title={t("db.kmSplit")} sub={t("wk.kmSub")} />
              <StackedMeter
                height={14}
                segments={[
                  { key: "trip", value: week.km.tripKm, color: C.s1, label: t("db.tripKm") },
                  { key: "pickup", value: week.km.pickupKm, color: C.s2, label: t("db.pickupSplit") },
                  { key: "cruise", value: week.km.cruisingKm, color: C.s4, label: t("db.cruisingSplit") },
                  { key: "personal", value: week.km.personalKm, color: C.neutral, label: t("db.personalKm") },
                ]}
              />
              <div className="mt-3 space-y-1 text-xs">
                <Legend color={C.s1} label={t("db.tripKm")} value={`${fmtNum(week.km.tripKm, locale, 0)} ${t("c.km")}`} locale={locale} />
                <Legend color={C.s2} label={t("tm.toPickup")} value={`${fmtNum(week.km.pickupKm, locale, 0)} ${t("c.km")}`} cost={money(week.km.pickupKm * costPerKm)} locale={locale} />
                <Legend color={C.s4} label={t("db.cruisingSplit").replace("↳ ", "")} value={`${fmtNum(week.km.cruisingKm, locale, 0)} ${t("c.km")}`} cost={money(week.km.cruisingKm * costPerKm)} locale={locale} />
                <Legend color={C.neutral} label={t("db.personalKm")} value={`${fmtNum(week.km.personalKm, locale, 0)} ${t("c.km")}`} locale={locale} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Mini label={t("wk.avgTripKm")} value={week.km.avgTripKm != null ? `${fmtNum(week.km.avgTripKm, locale, 1)} ${t("c.km")}` : "—"} />
                <Mini label={t("wk.pickupRatio")} value={week.km.pickupRatio != null ? `${fmtNum(week.km.pickupRatio * 100, locale, 0)}%` : "—"} />
                <Mini label={t("db.deadShare")} value={week.km.deadSharePct != null ? `${fmtNum(week.km.deadSharePct, locale, 0)}%` : "—"} />
                <Mini label={t("wk.kmPerHour")} value={week.rates.kmPerHour != null ? `${fmtNum(week.rates.kmPerHour, locale, 0)} ${t("c.km")}/${t("c.hours")}` : "—"} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* money */}
            <Card>
              <CardHead icon="wallet" title={t("wk.moneyTitle")} />
              <div className="rows text-sm">
                <Row label={t("wk.cardNet")} value={money(week.earnings.cardNet)} sub={t("tr.tripCount", { n: week.counts.cardTrips })} />
                <Row label={t("wk.cashNet")} value={money(week.earnings.cashNet)} sub={t("tr.tripCount", { n: week.counts.cashTrips })} />
                <Row label={t("tr.tip")} value={money(week.earnings.tips)} />
                <Row label={t("wk.cashCollected")} value={money(week.earnings.cashCollected)} sub={t("wk.cashOwed", { v: money(week.earnings.cashOwed) })} />
                <Row label={t("db.gross")} value={money(week.earnings.netRevenue)} bold />
                <Row label={t("db.fuelCost")} value={`− ${money(week.costs.fuel)}`} muted />
                <Row label={t("db.maintCost")} value={`− ${money(week.costs.maintenance)}`} muted />
                <Row label={t("db.expenses")} value={`− ${money(week.costs.workExpenses)}`} muted sub={week.expensesByCategory.map((e: any) => `${t(`ex.cat.${e.category}`)} ${money(e.amount)}`).join(" · ") || undefined} />
                {week.costs.ownership > 0 && <Row label={t("db.rental")} value={`− ${money(week.costs.ownership)}`} muted />}
                <Row label={t("db.depreciation")} value={report.rates.depreciationEnabled ? `− ${money(week.costs.depreciation)}` : t("dep.off")} muted />
                <Row label={t("db.trueProfit")} value={money(week.trueProfit)} bold tone={week.trueProfit >= 0 ? "good" : "bad"} />
              </div>
              {week.fuel.fillUps > 0 && (
                <p className="text-xs text-muted mt-3">{t("wk.fuelThisWeek", { n: week.fuel.fillUps, q: fmtNum(week.fuel.quantity, locale), v: money(week.fuel.spend) })}</p>
              )}
            </Card>

            {/* best of */}
            <div className="space-y-3">
              <Card tone="money">
                <CardHead icon="trophy" title={t("wk.bestTrip")} sub={t("wk.bestTripSub")} />
                {week.bestTrip ? <TripLine trip={week.bestTrip} locale={locale} t={t} /> : <Empty>{t("c.noData")}</Empty>}
              </Card>
              <Card>
                <CardHead icon="clock" title={t("wk.hoursTitle")} sub={t("wk.hoursSub")} />
                <HourStrip hours={week.hours} locale={locale} t={t} />
                {week.bestHour && (
                  <p className="text-xs text-muted mt-2">
                    {t("wk.bestHour", { h: `${week.bestHour.hour}:00–${week.bestHour.hour + 1}:00`, v: money(week.bestHour.net), n: week.bestHour.trips })}
                  </p>
                )}
              </Card>
              <Card>
                <CardHead title={t("wk.lengthTitle")} sub={t("wk.lengthSub")} />
                <div className="grid grid-cols-3 gap-2">
                  {week.lengthBuckets.map((b: any) => (
                    <div key={b.bucket} className="bg-white rounded-xl p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t(`wk.len.${b.bucket}`)}</div>
                      <div className="text-lg font-bold display mt-0.5">{b.perKm != null ? `${money(b.perKm)}` : "—"}</div>
                      <div className="text-[11px] text-muted">
                        /{t("c.km")} · {t("pl.tripsN", { n: b.trips })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* locations */}
          <Card>
            <CardHead
              icon="pin"
              title={t("wk.zonesTitle")}
              sub={t("wk.zonesSub")}
              actions={
                <Segmented
                  size="sm"
                  value={zoneScope}
                  onChange={setZoneScope}
                  options={[
                    { value: "week", label: t("wk.thisWeekShort") },
                    { value: "all", label: t("c.allTime") },
                  ]}
                />
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ZoneList title={t("wk.pickupZones")} zones={zoneScope === "week" ? week.pickupZones : report.allTime.pickupZones} locale={locale} t={t} />
              <ZoneList title={t("wk.dropoffZones")} zones={zoneScope === "week" ? week.dropoffZones : report.allTime.dropoffZones} locale={locale} t={t} />
            </div>
            {(zoneScope === "week" ? week.pickupZones : report.allTime.pickupZones).length === 0 && <Empty>{t("wk.zonesEmpty")}</Empty>}
          </Card>

          {week.platforms.length > 1 && (
            <Card>
              <CardHead title={t("db.platformTitle")} />
              <div className="rows text-sm">
                {week.platforms.map((p: any) => (
                  <Row key={p.platform} label={t(`pf.${p.platform}`)} value={money(p.net)} sub={t("pl.tripsN", { n: p.trips })} />
                ))}
              </div>
            </Card>
          )}

          {/* comparison table */}
          <Card>
            <CardHead title={t("wk.compareTitle")} sub={t("wk.compareSub")} />
            <Table head={["", t("wk.thisWeekShort"), t("wk.prevShort"), `🏆 ${t("wk.best")}`]}>
              {(
                [
                  [t("db.trueProfit"), (w: any) => money(w.trueProfit)],
                  [t("db.gross"), (w: any) => money(w.earnings.netRevenue)],
                  [t("db.tripCount"), (w: any) => fmtNum(w.counts.trips, locale, 0)],
                  [t("tm.online"), (w: any) => fmtDuration(w.time.onlineMin, t)],
                  [t("db.perHour"), (w: any) => (w.rates.profitPerHour != null ? money(w.rates.profitPerHour) : "—")],
                  [t("wk.perTrip"), (w: any) => (w.rates.netPerTrip != null ? money(w.rates.netPerTrip) : "—")],
                  [t("sh.km"), (w: any) => `${fmtNum(w.km.shiftKm, locale, 0)} ${t("c.km")}`],
                  [t("tm.utilization"), (w: any) => (w.time.utilizationPct != null ? `${fmtNum(w.time.utilizationPct, locale, 0)}%` : "—")],
                  [t("db.deadShare"), (w: any) => (w.km.deadSharePct != null ? `${fmtNum(w.km.deadSharePct, locale, 0)}%` : "—")],
                ] as [string, (w: any) => string][]
              ).map(([label, f]) => (
                <tr key={label}>
                  <td className="py-2 px-2 text-muted">{label}</td>
                  <td className="py-2 px-2 font-bold tnum">{f(week)}</td>
                  <td className="py-2 px-2 tnum">{prev && (prev.counts.trips > 0 || prev.counts.shifts > 0) ? f(prev) : "—"}</td>
                  <td className="py-2 px-2 tnum">{bestWeek ? f(bestWeek) : "—"}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function InkStat({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-white/60 uppercase tracking-wide truncate">{label}</div>
      <div className="text-lg md:text-xl font-bold display text-white mt-0.5 truncate">{value}</div>
      {delta && <div className="mt-0.5 [&_span]:!text-white/80">{delta}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted truncate">{label}</div>
      <div className="text-base font-bold display mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Row({ label, value, sub, bold, muted, tone }: { label: string; value: string; sub?: string; bold?: boolean; muted?: boolean; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-money" : tone === "bad" ? "text-loss" : muted ? "text-muted" : "text-ink";
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className={`${bold ? "font-bold" : ""} ${muted ? "text-muted" : ""}`}>{label}</div>
        {sub && <div className="text-xs text-muted truncate">{sub}</div>}
      </div>
      <div className={`tnum shrink-0 ${bold ? "font-bold" : "font-semibold"} ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label, value, pct, cost, locale }: { color: string; label: string; value: string; pct?: number | null; cost?: string; locale: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-ink-500 flex-1 truncate">{label}</span>
      {cost && <span className="text-muted tnum">{cost}</span>}
      {pct != null && <span className="text-muted tnum">{fmtNum(pct, locale, 0)}%</span>}
      <span className="font-bold tnum">{value}</span>
    </div>
  );
}

function TripLine({ trip, locale, t }: { trip: any; locale: string; t: T }) {
  const money = (n: number) => fmtMoney(n, locale);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[28px] font-bold display leading-none text-money">{money(trip.net)}</div>
          <div className="text-xs text-muted mt-1.5 tnum">{fmtDateTime(trip.startTime, locale)}</div>
        </div>
        <div className="text-end text-xs text-muted tnum">
          {trip.distanceKm != null && <div>{fmtNum(trip.distanceKm, locale, 1)} {t("c.km")}{trip.perKm != null && ` · ${money(trip.perKm)}/${t("c.km")}`}</div>}
          {trip.durationMin != null && <div>{fmtNum(trip.durationMin, locale, 0)} {t("c.minShort")}{trip.perMin != null && ` · ${money(trip.perMin)}/${t("c.minShort")}`}</div>}
        </div>
      </div>
      {(trip.pickupAddress || trip.dropoffAddress) && (
        <div className="text-xs text-ink-500 mt-2 truncate">
          {trip.pickupAddress ?? "—"} → {trip.dropoffAddress ?? "—"}
        </div>
      )}
    </div>
  );
}

function ZoneList({ title, zones, locale, t }: { title: string; zones: any[]; locale: string; t: T }) {
  const money = (n: number) => fmtMoney(n, locale);
  if (zones.length === 0) return null;
  const max = Math.max(...zones.map((z) => z.trips), 1);
  return (
    <div>
      <div className="text-xs font-bold text-ink-500 mb-2">{title}</div>
      <div className="space-y-2">
        {zones.map((z, i) => (
          <div key={z.key} className="flex items-center gap-2.5">
            <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold truncate">{z.label}</span>
                <span className="text-xs text-muted tnum shrink-0">
                  {t("pl.tripsN", { n: z.trips })} · {money(z.avgNet)} {t("wk.perTrip")}
                  {z.perMin != null && ` · ${money(z.perMin)}/${t("c.minShort")}`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden mt-1">
                <div className="h-full rounded-full" style={{ width: `${(z.trips / max) * 100}%`, background: C.s1 }} />
              </div>
            </div>
            {z.lat != null && (
              <a href={`https://www.openstreetmap.org/#map=15/${z.lat}/${z.lng}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink" title="OpenStreetMap">
                <Icon name="pin" size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 7 pay days of the week as horizontal bars; the best day is flagged. */
function DayRows({ days, bestIndex, locale, t }: { days: any[]; bestIndex: number | null; locale: string; t: T }) {
  const max = Math.max(...days.map((d) => Math.abs(d.profit)), 1);
  return (
    <div className="space-y-2">
      {days.map((d) => {
        const active = d.trips > 0 || d.onlineMin > 0;
        return (
          <div key={d.index} className={`flex items-center gap-3 ${active ? "" : "opacity-40"}`}>
            <span className="w-9 text-xs font-bold text-ink-500">{dayName(d.index, locale)}</span>
            <div className="flex-1 h-5 rounded-md bg-line/60 overflow-hidden relative" dir="ltr">
              {active && (
                <div className="absolute inset-y-0 start-0 rounded-md" style={{ width: `${(Math.abs(d.profit) / max) * 100}%`, background: d.profit >= 0 ? (d.index === bestIndex ? C.ink : C.s1) : C.neg }} />
              )}
            </div>
            <span className="w-20 text-end text-sm font-bold tnum">{active ? fmtMoney(d.profit, locale) : "—"}</span>
            <span className="hidden sm:block w-28 text-end text-xs text-muted tnum">
              {active ? `${t("pl.tripsN", { n: d.trips })} · ${fmtNum(d.onlineMin / 60, locale)}${t("c.hours")}` : ""}
            </span>
            <span className="w-4">{d.index === bestIndex && active ? "🏆" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Earnings by hour of day as a single-hue strip. */
function HourStrip({ hours, locale, t }: { hours: { hour: number; trips: number; net: number }[]; locale: string; t: T }) {
  const max = Math.max(...hours.map((h) => h.net), 0);
  const [tip, setTip] = useState<number | null>(null);
  if (max <= 0) return <Empty>{t("c.noData")}</Empty>;
  return (
    <div dir="ltr">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
        {hours.map((h) => {
          const f = h.net / max;
          const color = h.net <= 0 ? "#f1f5f9" : RAMP[Math.min(RAMP.length - 1, Math.floor(f * RAMP.length))];
          return <div key={h.hour} className="h-7 rounded-sm" style={{ background: color }} onMouseEnter={() => setTip(h.hour)} onMouseLeave={() => setTip(null)} onClick={() => setTip(h.hour)} title={`${h.hour}:00 · ${fmtMoney(h.net, locale)} · ${t("pl.tripsN", { n: h.trips })}`} />;
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted tnum mt-1">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      {tip != null && (
        <div className="text-xs text-ink-500 mt-1 tnum">
          {tip}:00–{tip + 1}:00 · <b>{fmtMoney(hours[tip].net, locale)}</b> · {t("pl.tripsN", { n: hours[tip].trips })}
        </div>
      )}
    </div>
  );
}

/** One metric across the loaded weeks; tapping a bar selects that week. */
function WeekBars({ weeks, selected, onSelect, valueOf, fmt, locale }: { weeks: any[]; selected: string; onSelect: (k: string) => void; valueOf: (w: any) => number | null; fmt: (v: number) => string; locale: string }) {
  const vals = weeks.map((w) => valueOf(w) ?? 0);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const W = 480;
  const H = 170;
  const PAD = { top: 10, bottom: 22, left: 6, right: 6 };
  const plotH = H - PAD.top - PAD.bottom;
  const span = max - min || 1;
  const y = (v: number) => PAD.top + ((max - v) / span) * plotH;
  const zeroY = y(0);
  const bw = (W - PAD.left - PAD.right) / weeks.length;
  const barW = Math.min(bw * 0.6, 26);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke={C.grid} />
        {weeks.map((w, i) => {
          const v = vals[i];
          const cx = PAD.left + bw * i + bw / 2;
          const yv = y(v);
          const h = Math.abs(zeroY - yv);
          const sel = w.key === selected;
          const fill = v < 0 ? C.neg : sel ? C.ink : w.isCurrent ? C.s1 : "#9ec5f4";
          return (
            <g key={w.key} onClick={() => onSelect(w.key)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <rect x={PAD.left + bw * i} y={PAD.top} width={bw} height={plotH} fill="transparent" />
              {h > 0.5 && <rect x={cx - barW / 2} y={v >= 0 ? yv : zeroY} width={barW} height={h} rx={4} fill={fill} opacity={w.isCurrent && !sel ? 0.7 : 1} />}
              {(weeks.length <= 14 || i % 4 === 0) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill={sel ? C.ink : C.muted} fontWeight={sel ? 700 : 400}>
                  {w.key.slice(5).replace("-", "/")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="absolute top-0 -translate-x-1/2 bg-white border border-line shadow-md rounded-lg px-2.5 py-1.5 text-xs pointer-events-none z-10 whitespace-nowrap" style={{ left: `${((PAD.left + bw * hover + bw / 2) / W) * 100}%` }}>
          <div className="text-muted tnum">{fmtDate(weeks[hover].start, locale)}</div>
          <div className="font-bold tnum">{fmt(vals[hover])}</div>
        </div>
      )}
    </div>
  );
}
