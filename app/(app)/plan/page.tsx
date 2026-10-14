"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useI18n } from "@/components/I18nProvider";
import { Card, Empty, PageTitle } from "@/components/ui";
import { useVehicle } from "@/components/VehicleProvider";
import { HBars, CHART, HeatGrid } from "@/components/charts";
import { fmtHour, fmtHourRange, fmtInt, fmtMoney, fmtNum, sep } from "@/lib/format";

// leaflet needs the DOM — never render it on the server
const GpsHeatmap = dynamic(() => import("@/components/GpsHeatmap").then((m) => m.GpsHeatmap), {
  ssr: false,
});

// Monday first — the order of Uber's pay week (lib/week.ts)
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

function dayName(dow: number, locale: string, style: "short" | "long" = "short"): string {
  // 2026-07-05 is a Sunday → +dow days lands on the right weekday
  const d = new Date(2026, 6, 5 + dow);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: style }).format(d);
}

export default function PlanPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading } = useVehicle();
  const [plan, setPlan] = useState<any>(null);
  const [community, setCommunity] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<{ points: [number, number][]; totalPoints: number } | null>(null);

  useEffect(() => {
    if (vehicle) {
      fetch(`/api/plan?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setPlan);
      fetch(`/api/plan/heatmap?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setHeatmap);
      fetch(`/api/plan/community?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setCommunity);
    }
  }, [vehicle]);

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-action underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }
  if (!plan) return null;

  const gapRows = plan.gaps.filter((g: any) => g.medianGapMin != null && g.samples >= 3);

  return (
    <div className="space-y-4">
      <PageTitle sub={t("pl.subtitle")}>{t("pl.title")}</PageTitle>

      {!plan.enoughData && (
        <Card className="border-warn/60 bg-warn-soft">
          <p className="text-sm">
            🌱 {t("pl.learning", { trips: plan.totals.trips, shifts: plan.totals.shifts })}
          </p>
        </Card>
      )}

      {/* weekday × hour heatmap of EGP/hour */}
      <Card>
        <div className="text-sm font-semibold mb-3">{t("pl.heatTitle")}</div>
        <HeatGrid cells={plan.cells} dowOrder={DOW_ORDER} dayName={(dow, style) => dayName(dow, locale, style)} locale={locale} fmt={(v) => fmtMoney(v, locale)} t={t} />
      </Card>

      {/* community version — pooled across every other active vehicle,
          honestly hidden until there's a real sample to show */}
      <Card>
        <div className="text-sm font-semibold mb-1">👥 {t("pl.communityTitle")}</div>
        <p className="text-xs text-muted mb-3">{t("pl.communitySub")}</p>
        {!community || !community.enoughDrivers ? (
          <Empty>{t("pl.communityNotEnough")}</Empty>
        ) : (
          <>
            <HeatGrid cells={community.cells} dowOrder={DOW_ORDER} dayName={(dow, style) => dayName(dow, locale, style)} locale={locale} fmt={(v) => fmtMoney(v, locale)} t={t} />
            <div className="text-xs text-muted mt-3 text-center">
              {t("bm.driverCount", { n: fmtNum(community.driverCount, locale, 0) })}
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* best time slots */}
        <Card>
          <div className="text-sm font-semibold mb-3">🏆 {t("pl.topTitle")}</div>
          {plan.topSlots.length === 0 ? (
            <Empty>{t("pl.noData")}</Empty>
          ) : (
            <div className="space-y-2">
              {plan.topSlots.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tnum shrink-0 ${i === 0 ? "bg-ink text-background" : "bg-paper text-muted"}`}>{fmtInt(i + 1, locale)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold">{dayName(s.dow, locale, "long")}</span>
                    <span className="block text-xs text-muted tnum">
                      {fmtHourRange(s.hour, locale)}
                      {sep(locale)}
                      {t("pl.tripsN", { n: s.trips })}
                    </span>
                  </span>
                  <span className="text-sm font-bold tnum shrink-0">
                    {fmtMoney(s.ratePerHour, locale)}
                    <span className="text-xs font-semibold text-muted">/{t("c.hours")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* wait between trips */}
        <Card>
          <div className="text-sm font-semibold mb-1">⏱ {t("pl.gapsTitle")}</div>
          <p className="text-xs text-muted mb-3">{t("pl.gapsSub")}</p>
          {gapRows.length === 0 ? (
            <Empty>{t("pl.noData")}</Empty>
          ) : (
            <HBars
              locale={locale}
              labelWidth="3.2rem"
              valueWidth="4.5rem"
              rows={gapRows.map((g: any) => ({
                key: String(g.hour),
                label: fmtHour(g.hour, locale),
                value: g.medianGapMin,
                display: `${fmtInt(g.medianGapMin, locale)} ${t("pl.min")}`,
                color: CHART.s2,
                // the shortest wait is the busiest hour
                best: g.medianGapMin === Math.min(...gapRows.map((x: any) => x.medianGapMin)),
              }))}
            />
          )}
        </Card>
      </div>

      {/* real GPS heatmap — where the driver actually spent driving time
          during shifts, not a geocoded guess from address text */}
      <Card>
        <div className="text-sm font-semibold mb-1">🗺️ {t("pl.heatmapTitle")}</div>
        <p className="text-xs text-muted mb-3">{t("pl.heatmapSub")}</p>
        {!heatmap || heatmap.points.length === 0 ? (
          <Empty>{t("pl.heatmapEmpty")}</Empty>
        ) : (
          <GpsHeatmap points={heatmap.points} />
        )}
      </Card>

      {/* seasons */}
      <Card>
        <div className="text-sm font-semibold mb-3">{t("pl.seasonsTitle")}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plan.seasons.map((s: any) => (
            <div key={s.season} className="border border-line rounded-lg p-3">
              <div className="text-xs font-bold text-ink-500 mb-1">{t(`pl.season.${s.season}`)}</div>
              <div className="text-2xl font-black">
                {s.ratePerHour != null ? (
                  <>
                    {fmtMoney(s.ratePerHour, locale)}
                    <span className="text-xs font-semibold text-muted">/{t("c.hours")}</span>
                  </>
                ) : (
                  <span className="text-muted-2">—</span>
                )}
              </div>
              <div className="text-xs text-muted mt-1">
                {t("pl.tripsN", { n: s.trips })}{sep(locale)}{fmtNum(s.hours, locale)} {t("c.hours")}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
