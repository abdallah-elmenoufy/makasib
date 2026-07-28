"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useI18n } from "@/components/I18nProvider";
import { Card, Empty, PageTitle } from "@/components/ui";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtMoney, fmtNum } from "@/lib/format";

// leaflet needs the DOM — never render it on the server
const GpsHeatmap = dynamic(() => import("@/components/GpsHeatmap").then((m) => m.GpsHeatmap), {
  ssr: false,
});

// sequential blue ramp (validated reference palette) — light → dark = low → high
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#0d366b"];
const EMPTY_CELL = "#f1f5f9";
// Egypt week starts Saturday
const DOW_ORDER = [6, 0, 1, 2, 3, 4, 5];

function dayName(dow: number, locale: string, style: "short" | "long" = "short"): string {
  // 2026-07-05 is a Sunday → +dow days lands on the right weekday
  const d = new Date(2026, 6, 5 + dow);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: style }).format(d);
}

export default function PlanPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading } = useVehicle();
  const [plan, setPlan] = useState<any>(null);
  const [tip, setTip] = useState<{ x: number; y: number; cell: any } | null>(null);
  const [heatmap, setHeatmap] = useState<{ points: [number, number][]; totalPoints: number } | null>(null);

  useEffect(() => {
    if (vehicle) {
      fetch(`/api/plan?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setPlan);
      fetch(`/api/plan/heatmap?vehicleId=${vehicle.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setHeatmap);
    }
  }, [vehicle]);

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-emerald-600 underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }
  if (!plan) return null;

  const rates = plan.cells.filter((c: any) => c.ratePerHour != null).map((c: any) => c.ratePerHour);
  const maxRate = rates.length ? Math.max(...rates) : 0;
  const minRate = rates.length ? Math.min(...rates) : 0;
  const color = (c: any) => {
    if (c.ratePerHour == null) return EMPTY_CELL;
    if (maxRate === minRate) return RAMP[3];
    const f = (c.ratePerHour - minRate) / (maxRate - minRate);
    return RAMP[Math.min(RAMP.length - 1, Math.floor(f * RAMP.length))];
  };
  const cellAt = (dow: number, hour: number) => plan.cells[dow * 24 + hour];
  const gapRows = plan.gaps.filter((g: any) => g.medianGapMin != null && g.samples >= 3);
  const maxGap = Math.max(...gapRows.map((g: any) => g.medianGapMin), 1);

  return (
    <div className="space-y-4">
      <PageTitle>🗓️ {t("pl.title")}</PageTitle>
      <p className="text-sm text-slate-500 -mt-2">{t("pl.subtitle")}</p>

      {!plan.enoughData && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm">
            🌱 {t("pl.learning", { trips: plan.totals.trips, shifts: plan.totals.shifts })}
          </p>
        </Card>
      )}

      {/* weekday × hour heatmap of EGP/hour */}
      <Card>
        <div className="text-sm font-semibold mb-3">{t("pl.heatTitle")}</div>
        {rates.length === 0 ? (
          <Empty>{t("pl.noData")}</Empty>
        ) : (
          <div className="relative overflow-x-auto" dir="ltr">
            <div className="min-w-[640px]">
              <div className="grid" style={{ gridTemplateColumns: "3rem repeat(24, 1fr)", gap: 2 }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-[9px] text-slate-400 text-center" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
                {DOW_ORDER.map((dow) => (
                  <Fragment key={dow}>
                    <div key={`d${dow}`} className="text-[10px] text-slate-500 font-semibold flex items-center">
                      {dayName(dow, locale)}
                    </div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const c = cellAt(dow, h);
                      return (
                        <div
                          key={`${dow}-${h}`}
                          className="h-5 rounded-sm cursor-default"
                          style={{ background: color(c) }}
                          onMouseEnter={(e) => {
                            const r = (e.target as HTMLElement).closest(".relative")!.getBoundingClientRect();
                            const b = (e.target as HTMLElement).getBoundingClientRect();
                            setTip({ x: b.left - r.left + b.width / 2, y: b.top - r.top, cell: c });
                          }}
                          onMouseLeave={() => setTip(null)}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
                <span>{fmtMoney(minRate, locale)}/{t("c.hours")}</span>
                {RAMP.map((c) => (
                  <span key={c} className="inline-block w-6 h-2.5 rounded-sm" style={{ background: c }} />
                ))}
                <span>{fmtMoney(maxRate, locale)}/{t("c.hours")}</span>
                <span className="ms-3 inline-block w-6 h-2.5 rounded-sm" style={{ background: EMPTY_CELL }} />
                <span>{t("pl.noSample")}</span>
              </div>
            </div>
            {tip && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full bg-white border border-slate-200 shadow-md rounded-lg px-2.5 py-1.5 text-xs pointer-events-none z-10 whitespace-nowrap"
                style={{ left: tip.x, top: tip.y - 4 }}
              >
                <div className="text-slate-400">
                  {dayName(tip.cell.dow, locale, "long")} {tip.cell.hour}:00–{tip.cell.hour + 1}:00
                </div>
                <div className="font-bold">
                  {tip.cell.ratePerHour != null
                    ? `${fmtMoney(tip.cell.ratePerHour, locale)}/${t("c.hours")}`
                    : t("pl.noSample")}
                </div>
                <div className="text-slate-500">
                  {t("pl.tripsN", { n: tip.cell.trips })} · {fmtNum(tip.cell.hours, locale)} {t("c.hours")}
                </div>
              </div>
            )}
          </div>
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
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-center font-black text-slate-300">{i + 1}</span>
                  <span className="flex-1 font-semibold">
                    {dayName(s.dow, locale, "long")} {s.hour}:00–{s.hour + 1}:00
                  </span>
                  <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(s.ratePerHour, locale)}/{t("c.hours")}
                  </span>
                  <span className="text-xs text-slate-400">{t("pl.tripsN", { n: s.trips })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* wait between trips */}
        <Card>
          <div className="text-sm font-semibold mb-1">⏱ {t("pl.gapsTitle")}</div>
          <p className="text-xs text-slate-400 mb-3">{t("pl.gapsSub")}</p>
          {gapRows.length === 0 ? (
            <Empty>{t("pl.noData")}</Empty>
          ) : (
            <div className="space-y-1.5">
              {gapRows.map((g: any) => (
                <div key={g.hour} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {g.hour}:00
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(g.medianGapMin / maxGap) * 100}%`, background: "#3987e5" }}
                    />
                  </div>
                  <span className="w-16 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {g.medianGapMin} {t("pl.min")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* real GPS heatmap — where the driver actually spent driving time
          during shifts, not a geocoded guess from address text */}
      <Card>
        <div className="text-sm font-semibold mb-1">🗺️ {t("pl.heatmapTitle")}</div>
        <p className="text-xs text-slate-400 mb-3">{t("pl.heatmapSub")}</p>
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
            <div key={s.season} className="border border-slate-100 rounded-lg p-3">
              <div className="text-xs font-bold text-slate-600 mb-1">{t(`pl.season.${s.season}`)}</div>
              <div className="text-2xl font-black">
                {s.ratePerHour != null ? (
                  <>
                    {fmtMoney(s.ratePerHour, locale)}
                    <span className="text-xs font-semibold text-slate-400">/{t("c.hours")}</span>
                  </>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t("pl.tripsN", { n: s.trips })} · {fmtNum(s.hours, locale)} {t("c.hours")}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
