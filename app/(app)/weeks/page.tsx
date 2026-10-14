"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Btn, Card, CardHead, Delta, Empty, Hero, IconButton, Modal, PageTitle, Segmented, Select, StackedMeter, Table, Tile } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useVehicle } from "@/components/VehicleProvider";
import { BarChart, CHART, HBars, HeatStrip } from "@/components/charts";
import { fmtDate, fmtDateTime, fmtHourRange, fmtInt, fmtMoney, fmtNum, localizeDigits, sep } from "@/lib/format";
import { weekKey, weekStartFor } from "@/lib/week";

type T = (k: string, vars?: Record<string, string | number>) => string;

/** How many weeks the page can load at once; 104 = the two years the API serves. */
const SPANS = [12, 26, 52, 104] as const;
type Span = (typeof SPANS)[number];

function fmtDuration(min: number, t: T, locale: string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${fmtInt(m, locale)}${t("c.minShort")}`;
  return `${fmtInt(h, locale)}${t("c.hours")} ${localizeDigits(String(m).padStart(2, "0"), locale)}${t("c.minShort")}`;
}

function dayName(index: number, locale: string, style: "short" | "long" = "short"): string {
  // 2026-10-12 is a Monday; index 0 = Monday in the pay week
  const d = new Date(2026, 9, 12 + index);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: style }).format(d);
}

const intlLocale = (locale: string) => (locale === "ar" ? "ar-EG" : "en-GB");

function weekLabel(w: any, locale: string): string {
  const end = new Date(new Date(w.end).getTime() - 1);
  return `${fmtDate(w.start, locale)} – ${fmtDate(end, locale)}`;
}

/** "5 – 12 Oct" or "28 Sep – 5 Oct" (Monday to Monday, like Uber's statement) — the compact form. */
function shortRange(w: any, locale: string): string {
  const s = new Date(w.start);
  const e = new Date(new Date(w.end).getTime() - 1);
  const dm = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" });
  const d = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric" });
  return s.getMonth() === e.getMonth() ? `${d.format(s)} – ${dm.format(e)}` : `${dm.format(s)} – ${dm.format(e)}`;
}

function monthKeyOf(w: any): string {
  const s = new Date(w.start);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

const hasData = (w: any) => w.counts.trips > 0 || w.counts.shifts > 0;

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
  const [span, setSpan] = useState<Span>(12);
  const [metric, setMetric] = useState<"profit" | "net" | "hours" | "perHour">("profit");
  const [zoneScope, setZoneScope] = useState<"week" | "all">("week");
  const [copied, setCopied] = useState(false);
  const [picker, setPicker] = useState(false);

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

  // a deep link to a week older than what is loaded → load more, up to the cap
  useEffect(() => {
    if (!report || !selectedKey) return;
    // wait for the report of the current span before widening again
    if (report.weeks.length !== span) return;
    if (report.weeks.some((w: any) => w.key === selectedKey)) return;
    const next = SPANS.find((s) => s > span);
    if (next) setSpan(next);
  }, [report, selectedKey, span]);

  const select = (key: string) => router.replace(`/weeks?week=${key}`);

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-action underline font-bold">
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
  const next = idx >= 0 && idx < weeks.length - 1 ? weeks[idx + 1] : null;
  const bestKey = report.best.byProfit;
  const bestWeek = bestKey ? weeks.find((w) => w.key === bestKey) : null;
  const isBest = bestKey === week.key;
  const d = (f: (w: any) => number | null) => (prev ? (f(week) != null && f(prev) != null ? f(week)! - f(prev)! : null) : null);
  const weekHasData = hasData(week);
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

  const trendBars = weeks.map((w) => ({
    key: w.key,
    label: w.key.slice(5).replace("-", "/"),
    value: metricOf(w) ?? 0,
    sub: hasData(w) ? `${t("pl.tripsN", { n: w.counts.trips })}${sep(locale)}${fmtDate(w.start, locale)}` : fmtDate(w.start, locale),
    selected: w.key === week.key,
    muted: w.isCurrent,
  }));

  return (
    <div className="space-y-4">
      <PageTitle sub={t("wk.subtitle")}>{t("wk.title")}</PageTitle>

      {/* week header: step with the arrows, or open the vertical picker */}
      <div className="flex items-center gap-1.5">
        <IconButton name="back" label={t("wk.prevWeek")} onClick={() => prev && select(prev.key)} className={`rtl:-scale-x-100 bg-surface border border-line ${prev ? "" : "opacity-30 pointer-events-none"}`} />
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex-1 min-w-0 flex items-center gap-3 bg-surface border border-line rounded-2xl px-3.5 py-2 text-start hover:bg-surface-2 transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-action-soft text-action flex items-center justify-center shrink-0">
            <Icon name="calendar" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-muted truncate">
              {week.isCurrent ? t("wk.current") : isBest ? `🏆 ${t("wk.bestWeek")}` : t("wk.uberWeek")}
              {sep(locale)}
              {localizeDigits(new Date(week.start).getFullYear(), locale)}
            </span>
            <span className="block text-[15px] font-bold tnum truncate">{shortRange(week, locale)}</span>
          </span>
          <span className="text-xs font-bold text-action shrink-0 inline-flex items-center gap-0.5">
            {t("wk.choose")} <Icon name="chevron" size={14} className="rtl:-scale-x-100" />
          </span>
        </button>
        <IconButton name="chevron" label={t("wk.nextWeek")} onClick={() => next && select(next.key)} className={`rtl:-scale-x-100 bg-surface border border-line ${next ? "" : "opacity-30 pointer-events-none"}`} />
      </div>

      <WeekPicker
        open={picker}
        onClose={() => setPicker(false)}
        weeks={weeks}
        selected={week.key}
        bestKey={bestKey}
        span={span}
        onSpan={setSpan}
        onSelect={(k) => {
          select(k);
          setPicker(false);
        }}
        locale={locale}
        t={t}
      />

      {/* hero */}
      <Card tone="ink">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-bold tnum">{weekLabel(week, locale)}</span>
          {week.isCurrent ? (
            <Badge tone="neutral">
              {t("wk.inProgress")}{sep(locale)}{fmtNum(week.progress * 100, locale, 0)}%
            </Badge>
          ) : (
            <Badge tone="neutral">{t("wk.closed")}</Badge>
          )}
          {isBest && <Badge tone="good">🏆 {t("wk.bestWeek")}</Badge>}
          {week.goals.metProfit === true && <Badge tone="good">{t("wk.goalMet")}</Badge>}
          <span className="ms-auto inline-flex items-center gap-3">
            <a href={`/api/weeks/export?vehicleId=${vehicle.id}&week=${week.key}`} className="inline-flex items-center gap-1 text-xs font-bold text-hero-fg/80 hover:text-hero-fg">
              <Icon name="download" size={14} /> {t("wk.export")}
            </a>
            <button onClick={share} className="inline-flex items-center gap-1 text-xs font-bold text-hero-fg/80 hover:text-hero-fg">
              {copied ? t("db.recapCopied") : t("wk.share")}
            </button>
          </span>
        </div>
        {!weekHasData ? (
          <Empty>
            <span className="text-hero-fg/60">{t("wk.noData")}</span>
          </Empty>
        ) : (
          <>
            <Hero
              label={t("db.trueProfit")}
              value={money(week.trueProfit)}
              tone={week.trueProfit >= 0 ? "ink" : "loss"}
              size="xl"
              sub={
                <span className="text-hero-fg/70 flex items-center gap-2 flex-wrap">
                  {prev && prev.counts.trips > 0 && (
                    <>
                      {t("wk.vsLastWeek")} <Delta value={d((w) => w.trueProfit)} fmt={money} />
                    </>
                  )}
                  {bestWeek && !isBest && (
                    <>
                      {sep(locale)}{t("wk.vsBest")} <Delta value={week.trueProfit - bestWeek.trueProfit} fmt={money} />
                    </>
                  )}
                </span>
              }
            />
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-hero-fg/15">
              <InkStat label={t("db.gross")} value={money(week.earnings.netRevenue)} delta={<Delta value={d((w) => w.earnings.netRevenue)} fmt={money} />} />
              <InkStat label={t("db.cashProfit")} value={money(week.cashProfit)} />
              <InkStat label={t("db.perHour")} value={week.rates.profitPerHour != null ? money(week.rates.profitPerHour) : "—"} delta={<Delta value={d((w) => w.rates.profitPerHour)} fmt={money} />} />
            </div>
            {week.isCurrent && report.projection && (
              <p className="text-xs text-hero-fg/70 mt-4">
                {t("wk.onPace", { v: money(report.projection.trueProfit), n: report.projection.trips })}
                {report.previousAtSamePoint && report.previousAtSamePoint.netRevenue > 0 && (
                  <>
                    {sep(locale)}
                    {t("wk.vsSamePoint")} <Delta value={week.earnings.netRevenue - report.previousAtSamePoint.netRevenue} fmt={money} />
                  </>
                )}
              </p>
            )}
          </>
        )}
      </Card>

      {weekHasData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label={t("db.tripCount")} value={fmtNum(week.counts.trips, locale, 0)} delta={<Delta value={d((w) => w.counts.trips)} fmt={(n) => fmtInt(n, locale)} />} sub={week.rates.netPerTrip != null ? `${money(week.rates.netPerTrip)} ${t("wk.perTrip")}` : undefined} />
            <Tile label={t("tm.online")} value={fmtDuration(week.time.onlineMin, t, locale)} delta={<Delta value={d((w) => w.time.onlineMin / 60)} fmt={(n) => fmtNum(n, locale)} suffix={t("c.hours")} />} sub={t("sh.shiftCount", { n: week.counts.shifts })} />
            <Tile label={t("sh.km")} value={`${fmtNum(week.km.shiftKm, locale, 0)} ${t("c.km")}`} delta={<Delta value={d((w) => w.km.shiftKm)} fmt={(n) => fmtNum(n, locale, 0)} />} sub={week.rates.profitPerKm != null ? `${money(week.rates.profitPerKm)}/${t("c.km")}` : undefined} />
            <Tile label={t("tm.utilization")} value={week.time.utilizationPct != null ? `${fmtNum(week.time.utilizationPct, locale, 0)}%` : "—"} delta={<Delta value={d((w) => w.time.utilizationPct)} fmt={(n) => fmtNum(n, locale, 0)} suffix="%" />} sub={t("tm.utilizationSub")} />
          </div>

          {/* week-over-week chart */}
          <Card>
            <CardHead title={t("wk.trendTitle")} sub={t("wk.trendSub")} />
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "profit", label: t("db.trueProfit") },
                  { value: "net", label: t("db.gross") },
                  { value: "hours", label: t("tm.online") },
                  { value: "perHour", label: t("db.perHour") },
                ]}
              />
              <Segmented
                size="sm"
                value={String(span) as `${Span}`}
                onChange={(v) => setSpan(Number(v) as Span)}
                options={SPANS.map((s) => ({ value: String(s) as `${Span}`, label: fmtInt(s, locale) }))}
              />
            </div>
            <BarChart bars={trendBars} locale={locale} fmt={metricFmt} onSelect={select} labelEvery={weeks.length <= 14 ? 1 : weeks.length <= 30 ? 2 : weeks.length <= 60 ? 4 : 8} />
          </Card>

          {/* day by day */}
          <Card>
            <CardHead icon="calendar" title={t("wk.daysTitle")} sub={t("wk.daysSub")} />
            <HBars
              locale={locale}
              labelWidth="4rem"
              valueWidth="5.5rem"
              rows={week.days.map((day: any) => {
                const active = day.trips > 0 || day.onlineMin > 0;
                return {
                  key: String(day.index),
                  label: dayName(day.index, locale),
                  value: active ? day.profit : 0,
                  display: active ? money(day.profit) : "—",
                  sub: active ? `${t("pl.tripsN", { n: day.trips })}${sep(locale)}${fmtNum(day.onlineMin / 60, locale)}${t("c.hours")}` : "",
                  best: active && day.index === (week.bestDay?.index ?? null),
                  muted: !active,
                };
              })}
            />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* time */}
            <Card>
              <CardHead icon="timer" title={t("tm.title")} sub={t("wk.timeSub")} />
              <StackedMeter
                height={14}
                segments={[
                  { key: "trip", value: week.time.tripMin, color: CHART.s1, label: t("tm.withRider") },
                  { key: "pickup", value: week.time.pickupMin, color: CHART.s2, label: t("tm.toPickup") },
                  { key: "idle", value: week.time.idleMin, color: CHART.neutral, label: t("tm.idle") },
                ]}
              />
              <div className="mt-3 space-y-1 text-xs">
                <Legend color={CHART.s1} label={t("tm.withRider")} value={fmtDuration(week.time.tripMin, t, locale)} pct={week.time.onlineMin > 0 ? (week.time.tripMin / week.time.onlineMin) * 100 : null} locale={locale} />
                <Legend color={CHART.s2} label={t("tm.toPickup")} value={fmtDuration(week.time.pickupMin, t, locale)} pct={week.time.onlineMin > 0 ? (week.time.pickupMin / week.time.onlineMin) * 100 : null} locale={locale} />
                <Legend color={CHART.neutral} label={t("tm.idle")} value={fmtDuration(week.time.idleMin, t, locale)} pct={week.time.onlineMin > 0 ? (week.time.idleMin / week.time.onlineMin) * 100 : null} locale={locale} />
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
                  { key: "trip", value: week.km.tripKm, color: CHART.s1, label: t("db.tripKm") },
                  { key: "pickup", value: week.km.pickupKm, color: CHART.s2, label: t("db.pickupSplit") },
                  { key: "cruise", value: week.km.cruisingKm, color: CHART.s3, label: t("db.cruisingSplit") },
                  { key: "personal", value: week.km.personalKm, color: CHART.neutral, label: t("db.personalKm") },
                ]}
              />
              <div className="mt-3 space-y-1 text-xs">
                <Legend color={CHART.s1} label={t("db.tripKm")} value={`${fmtNum(week.km.tripKm, locale, 0)} ${t("c.km")}`} locale={locale} />
                <Legend color={CHART.s2} label={t("tm.toPickup")} value={`${fmtNum(week.km.pickupKm, locale, 0)} ${t("c.km")}`} cost={money(week.km.pickupKm * costPerKm)} locale={locale} />
                <Legend color={CHART.s3} label={t("db.cruisingSplit").replace("↳ ", "")} value={`${fmtNum(week.km.cruisingKm, locale, 0)} ${t("c.km")}`} cost={money(week.km.cruisingKm * costPerKm)} locale={locale} />
                <Legend color={CHART.neutral} label={t("db.personalKm")} value={`${fmtNum(week.km.personalKm, locale, 0)} ${t("c.km")}`} locale={locale} />
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
                <Row label={t("db.gross")} value={money(week.earnings.netRevenue)} bold />
                <Row label={t("db.fuelCost")} value={`− ${money(week.costs.fuel)}`} muted />
                <Row label={t("db.maintCost")} value={`− ${money(week.costs.maintenance)}`} muted />
                <Row label={t("db.expenses")} value={`− ${money(week.costs.workExpenses)}`} muted sub={week.expensesByCategory.map((e: any) => `${t(`ex.cat.${e.category}`)} ${money(e.amount)}`).join(sep(locale)) || undefined} />
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
                <HeatStrip hours={week.hours.map((h: any) => ({ hour: h.hour, value: h.net, sub: t("pl.tripsN", { n: h.trips }) }))} locale={locale} fmt={money} t={t} />
                {week.bestHour && (
                  <p className="text-xs text-muted mt-2">
                    {t("wk.bestHour", { h: fmtHourRange(week.bestHour.hour, locale), v: money(week.bestHour.net), n: week.bestHour.trips })}
                  </p>
                )}
              </Card>
              <Card>
                <CardHead title={t("wk.lengthTitle")} sub={t("wk.lengthSub")} />
                <div className="grid grid-cols-3 gap-2">
                  {week.lengthBuckets.map((b: any) => (
                    <div key={b.bucket} className="bg-paper rounded-xl p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t(`wk.len.${b.bucket}`)}</div>
                      <div className="text-lg font-bold display mt-0.5">{b.perKm != null ? `${money(b.perKm)}` : "—"}</div>
                      <div className="text-[11px] text-muted">
                        /{t("c.km")}{sep(locale)}{t("pl.tripsN", { n: b.trips })}
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
                  [t("tm.online"), (w: any) => fmtDuration(w.time.onlineMin, t, locale)],
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
                  <td className="py-2 px-2 tnum">{prev && hasData(prev) ? f(prev) : "—"}</td>
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

/* ---------------------------------------------------------------------------
   Week picker — a bottom sheet with a vertical list of weeks, newest first,
   grouped under sticky month headings. Filter by month, by year, or jump to
   the week that contains a date. Older weeks load on demand (up to 2 years).
--------------------------------------------------------------------------- */
type Filter = "all" | "month" | "year" | "date";

function WeekPicker({
  open,
  onClose,
  weeks,
  selected,
  bestKey,
  span,
  onSpan,
  onSelect,
  locale,
  t,
}: {
  open: boolean;
  onClose: () => void;
  weeks: any[];
  selected: string;
  bestKey: string | null;
  span: Span;
  onSpan: (s: Span) => void;
  onSelect: (key: string) => void;
  locale: string;
  t: T;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [dateMsg, setDateMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const newestFirst = useMemo(() => [...weeks].reverse(), [weeks]);
  const months = useMemo(() => Array.from(new Set(newestFirst.map(monthKeyOf))), [newestFirst]);
  const years = useMemo(() => Array.from(new Set(newestFirst.map((w) => monthKeyOf(w).slice(0, 4)))), [newestFirst]);
  const maxAbs = Math.max(...weeks.filter(hasData).map((w) => Math.abs(w.trueProfit)), 1);

  // defaults: the newest month / year once the list is known
  useEffect(() => {
    if (!month && months.length) setMonth(months[0]);
    if (!year && years.length) setYear(years[0]);
  }, [months, years, month, year]);

  // scroll the selected week into view when the sheet opens
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-selected='true']");
    el?.scrollIntoView({ block: "center" });
  }, [open, filter, month, year]);

  const visible = newestFirst.filter((w) => {
    if (filter === "month") return monthKeyOf(w) === month;
    if (filter === "year") return monthKeyOf(w).slice(0, 4) === year;
    return true;
  });

  const groups: { key: string; weeks: any[] }[] = [];
  for (const w of visible) {
    const k = monthKeyOf(w);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.weeks.push(w);
    else groups.push({ key: k, weeks: [w] });
  }

  const nextSpan = SPANS.find((s) => s > span) ?? null;

  const jump = (value: string) => {
    setDate(value);
    setDateMsg(null);
    if (!value) return;
    const dt = new Date(`${value}T12:00:00`);
    if (isNaN(dt.getTime())) return;
    const key = weekKey(weekStartFor(dt));
    if (weeks.some((w) => w.key === key)) {
      onSelect(key);
      return;
    }
    if (dt.getTime() > Date.now()) {
      setDateMsg(t("wk.dateFuture"));
      return;
    }
    // older than what is loaded → load more and let the deep link pick it up
    if (nextSpan) {
      onSpan(nextSpan);
      onSelect(key);
    } else setDateMsg(t("wk.dateNotLoaded"));
  };

  return (
    <Modal open={open} onClose={onClose} title={t("wk.pickTitle")}>
      <div className="space-y-3 -mx-1">
        <div className="px-1 space-y-2">
          <Segmented
            size="sm"
            fill
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("wk.filterAll") },
              { value: "month", label: t("wk.filterMonth") },
              { value: "year", label: t("wk.filterYear") },
              { value: "date", label: t("wk.filterDate") },
            ]}
          />
          {filter === "month" && (
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, locale)}
                </option>
              ))}
            </Select>
          )}
          {filter === "year" && years.length > 0 && (
            <Segmented size="sm" fill value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: localizeDigits(y, locale) }))} />
          )}
          {filter === "date" && (
            <div>
              <label className="block text-xs text-muted mb-1">{t("wk.jumpDate")}</label>
              <input type="date" value={date} onChange={(e) => jump(e.target.value)} className="w-full rounded-xl border border-line bg-sheet px-3 py-2.5 text-sm text-ink tnum" />
              {dateMsg && <p className="text-xs text-warn-ink mt-1.5">{dateMsg}</p>}
            </div>
          )}
        </div>

        <div ref={listRef}>
          {groups.length === 0 && <Empty>{t("wk.noWeeksMatch")}</Empty>}
          {groups.map((g) => {
            const withData = g.weeks.filter(hasData);
            const total = withData.reduce((s, w) => s + w.trueProfit, 0);
            return (
              <div key={g.key}>
                <div className="sticky top-0 z-10 bg-sheet/95 backdrop-blur px-1 py-1.5 flex items-baseline justify-between gap-2 border-b border-line">
                  <span className="text-xs font-bold text-ink-500">{monthLabel(g.key, locale)}</span>
                  <span className="text-[11px] text-muted tnum">
                    {t("wk.weeksN", { n: g.weeks.length })}
                    {withData.length > 0 && <>{sep(locale)}<b className={total >= 0 ? "text-money" : "text-loss"}>{fmtMoney(total, locale)}</b></>}
                  </span>
                </div>
                <div className="py-1">
                  {g.weeks.map((w) => {
                    const active = w.key === selected;
                    const data = hasData(w);
                    const start = new Date(w.start);
                    return (
                      <button
                        type="button"
                        key={w.key}
                        data-selected={active ? "true" : undefined}
                        onClick={() => onSelect(w.key)}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-start transition-colors ${active ? "bg-action-soft" : "hover:bg-surface-2"} ${data ? "" : "opacity-60"}`}
                      >
                        <span className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none ${active ? "bg-action text-action-fg" : "bg-paper text-ink"}`}>
                          <span className="text-base font-bold tnum">{localizeDigits(start.getDate(), locale)}</span>
                          <span className={`text-[9px] font-bold uppercase mt-0.5 ${active ? "text-action-fg/80" : "text-muted"}`}>{new Intl.DateTimeFormat(intlLocale(locale), { month: "short" }).format(start)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-bold tnum truncate">{shortRange(w, locale)}</span>
                            {w.isCurrent && <Badge tone="neutral">{t("wk.current")}</Badge>}
                            {w.key === bestKey && <span title={t("wk.bestWeek")}>🏆</span>}
                          </span>
                          <span className="block text-[11px] text-muted tnum truncate mt-0.5">
                            {data ? `${t("pl.tripsN", { n: w.counts.trips })}${sep(locale)}${fmtDuration(w.time.onlineMin, t, locale)}` : t("wk.noData")}
                          </span>
                          <span className="block h-[3px] rounded-full bg-line/60 mt-1.5 overflow-hidden" dir="ltr">
                            {data && <span className="block h-full rounded-full" style={{ width: `${(Math.abs(w.trueProfit) / maxAbs) * 100}%`, background: w.trueProfit < 0 ? CHART.neg : active ? CHART.ink : CHART.s1 }} />}
                          </span>
                        </span>
                        <span className={`text-sm font-bold tnum shrink-0 ${!data ? "text-muted" : w.trueProfit < 0 ? "text-loss" : ""}`}>{data ? fmtMoney(w.trueProfit, locale) : "—"}</span>
                        <span className="w-4 shrink-0 text-action">{active && <Icon name="check" size={16} strokeWidth={2.5} />}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-1 pt-1">
          {nextSpan ? (
            <Btn variant="secondary" className="w-full" onClick={() => onSpan(nextSpan)}>
              {t("wk.loadOlder")}{sep(locale)}{t("wk.weeksN", { n: nextSpan })}
            </Btn>
          ) : (
            <p className="text-xs text-muted text-center">{t("wk.allLoaded", { n: weeks.length })}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InkStat({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-hero-fg/60 uppercase tracking-wide truncate">{label}</div>
      <div className="text-[15px] sm:text-lg md:text-xl font-bold display text-hero-fg mt-0.5 truncate">{value}</div>
      {delta && <div className="mt-0.5 [&_span]:!text-hero-fg/80">{delta}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper rounded-xl px-3 py-2.5">
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
          {trip.distanceKm != null && <div>{fmtNum(trip.distanceKm, locale, 1)} {t("c.km")}{trip.perKm != null && `${sep(locale)}${money(trip.perKm)}/${t("c.km")}`}</div>}
          {trip.durationMin != null && <div>{fmtNum(trip.durationMin, locale, 0)} {t("c.minShort")}{trip.perMin != null && `${sep(locale)}${money(trip.perMin)}/${t("c.minShort")}`}</div>}
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

/** Ranked areas: the top one is drawn in ink, the rest in the series green. */
function ZoneList({ title, zones, locale, t }: { title: string; zones: any[]; locale: string; t: T }) {
  const money = (n: number) => fmtMoney(n, locale);
  if (zones.length === 0) return null;
  const max = Math.max(...zones.map((z) => z.trips), 1);
  return (
    <div>
      <div className="text-xs font-bold text-ink-500 mb-2">{title}</div>
      <div className="space-y-2.5">
        {zones.map((z, i) => (
          <div key={z.key} className="flex items-center gap-2.5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold tnum shrink-0 ${i === 0 ? "bg-ink text-background" : "bg-paper text-muted"}`}>{fmtInt(i + 1, locale)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span dir="auto" className="text-sm font-bold truncate min-w-0">{z.label}</span>
                <span className="text-xs text-muted tnum shrink-0">
                  {t("pl.tripsN", { n: z.trips })}{sep(locale)}{money(z.avgNet)} {t("wk.perTrip")}
                  {z.perMin != null && `${sep(locale)}${money(z.perMin)}/${t("c.minShort")}`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-line/60 overflow-hidden mt-1" dir="ltr">
                <div className="h-full rounded-full" style={{ width: `${(z.trips / max) * 100}%`, background: i === 0 ? CHART.ink : CHART.s1 }} />
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
