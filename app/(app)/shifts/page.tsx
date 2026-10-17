"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Card, Empty, GroupHeader, PageTitle, Pagination, RecordCard, StatCell, StatGrid } from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { DriveCard } from "@/components/Drive";
import { useViewMode } from "@/components/ViewMode";
import { Icon } from "@/components/icons";
import { RowEditor, type EditField } from "@/components/RowEditor";
import { fmtDate, fmtDateTime, fmtInt, fmtMoney, fmtNum, hoursBetween, sep } from "@/lib/format";

type T = (k: string, vars?: Record<string, string | number>) => string;

const shiftEditFields = (t: T): EditField[] => [
  { key: "startTime", label: t("sh.startTime"), type: "datetime" },
  { key: "endTime", label: t("sh.endTime"), type: "datetime" },
  { key: "startOdometer", label: t("sh.startOdo"), type: "number", step: "0.1" },
  { key: "endOdometer", label: t("sh.endOdo"), type: "number", step: "0.1" },
  { key: "notes", label: t("c.notes"), type: "textarea" },
];


/** Local-day key (not UTC) so a shift just after midnight groups with the
 *  right calendar day for the driver, not whatever day UTC thinks it is. */
function dayKey(d: string | Date): string {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function ShiftsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { vehicle, loading: vLoading } = useVehicle();
  const { mode } = useViewMode();
  const { rows: shifts, loading, update, remove, page, setPage, totalPages } = useCrud<any>(
    "shifts",
    vehicle?.id
  );
  // full (unpaginated) trip list — this only feeds the per-shift km/revenue
  // tally below, not a rendered table, so it must cover every trip
  // regardless of how many pages the shifts table itself has. Re-fetched
  // whenever `shifts` changes too: starting/ending/reconciling a shift can
  // change which shift a trip belongs to without the trip row itself changing.
  const [trips, setTrips] = useState<any[]>([]);
  useEffect(() => {
    if (!vehicle?.id) return;
    fetch(`/api/trips?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTrips);
  }, [vehicle?.id, shifts]);

  const tripsByShift = useMemo(() => {
    const m: Record<string, { count: number; km: number; revenue: number }> = {};
    for (const tr of trips) {
      if (!tr.shiftId) continue;
      m[tr.shiftId] ??= { count: 0, km: 0, revenue: 0 };
      m[tr.shiftId].count++;
      m[tr.shiftId].km += tr.distanceKm ?? 0;
      m[tr.shiftId].revenue += tr.fare + (tr.tip ?? 0);
    }
    return m;
  }, [trips]);

  const completed = useMemo(() => shifts.filter((s) => s.endOdometer != null), [shifts]);
  // group by calendar day — a driver commonly works more than one shift a
  // day (split shifts, breaks), so the day is the natural unit to scan first
  const dayGroups = useMemo(() => {
    const order: string[] = [];
    const byDay: Record<string, any[]> = {};
    for (const s of completed) {
      const key = dayKey(s.startTime);
      if (!byDay[key]) {
        byDay[key] = [];
        order.push(key);
      }
      byDay[key].push(s);
    }
    order.sort((a, b) => (a < b ? 1 : -1));
    return order.map((key) => ({ key, shifts: byDay[key] }));
  }, [completed]);

  const [editingRow, setEditingRow] = useState<any>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // the most recent day open by default, everything older starts collapsed
    if (dayGroups.length > 0) setExpandedDays((e) => (e[dayGroups[0].key] === undefined ? { ...e, [dayGroups[0].key]: true } : e));
  }, [dayGroups]);
  const toggleDay = (key: string) => setExpandedDays((e) => ({ ...e, [key]: !e[key] }));

  if (vLoading || loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-action underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  return (
    <div>
      <PageTitle
        actions={
          <Link href="/import?tab=shift" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink bg-sheet border border-line shadow-[var(--shadow-sm)] hover:bg-surface-2 rounded-full px-4 h-10">
            <Icon name="camera" size={18} /> {t("sh.fromPhotos")}
          </Link>
        }
      >
        {t("sh.title")}
      </PageTitle>

      {/* start / live / end — the same drive card as Home, plus GPS tracking */}
      <DriveCard withGps />

      <Card className="mt-4">
        {completed.length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <div className="space-y-3">
            {dayGroups.map((dg) => {
              const isOpen = !!expandedDays[dg.key];
              const dayRevenue = dg.shifts.reduce((s, sh) => s + (tripsByShift[sh.id]?.revenue ?? 0), 0);
              const dayTrips = dg.shifts.reduce((s, sh) => s + (tripsByShift[sh.id]?.count ?? 0), 0);
              return (
                <div key={dg.key}>
                  <GroupHeader
                    open={isOpen}
                    onToggle={() => toggleDay(dg.key)}
                    title={fmtDate(dg.key, locale)}
                    meta={`${t("sh.shiftCount", { n: dg.shifts.length })}${sep(locale)}${t("tr.tripCount", { n: dayTrips })}`}
                    right={<span className="text-xs font-bold tnum text-money">{fmtMoney(dayRevenue, locale)}</span>}
                  />
                  {isOpen && (
                    <div className="space-y-2 mt-2 ps-2 sm:ps-4">
                      {dg.shifts.map((s) => {
                        const km = s.endOdometer - s.startOdometer;
                        const ts = tripsByShift[s.id] ?? { count: 0, km: 0, revenue: 0 };
                        return (
                          <RecordCard key={s.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-sm tnum">
                                  {fmtDateTime(s.startTime, locale)}
                                  {s.endTime && <span className="text-muted"> → {fmtDateTime(s.endTime, locale)}</span>}
                                </div>
                                <div className="text-xs text-muted mt-0.5 tnum">
                                  {fmtNum(s.startOdometer, locale, 0)} → {s.endOdometer != null ? fmtNum(s.endOdometer, locale, 0) : "—"} {t("c.km")}
                                </div>
                              </div>
                              <div className="text-end shrink-0">
                                <div className="text-2xl font-bold display text-money tnum leading-none">
                                  {fmtMoney(ts.revenue, locale)}
                                </div>
                                <div className="flex gap-2 justify-end mt-1.5">
                                  <button onClick={() => setEditingRow(s)} className="text-xs text-muted hover:text-ink">
                                    {t("c.edit")}
                                  </button>
                                  <button
                                    onClick={() => confirm(t("c.confirmDelete")) && remove(s.id)}
                                    className="text-xs text-loss hover:text-loss"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                            <StatGrid cols={mode === "simple" ? 3 : 5}>
                              <StatCell
                                label={t("sh.duration")}
                                value={s.endTime ? `${fmtNum(hoursBetween(s.startTime, s.endTime), locale)} ${t("c.hours")}` : "—"}
                              />
                              <StatCell label={t("sh.km")} value={fmtNum(km, locale)} />
                              <StatCell
                                label={t("sh.trips")}
                                value={
                                  ts.count > 0 ? (
                                    <button
                                      onClick={() => router.push(`/trips?shiftId=${s.id}`)}
                                      className="text-action underline underline-offset-2 font-bold"
                                      title={t("sh.viewTrips")}
                                    >
                                      {fmtInt(ts.count, locale)}
                                    </button>
                                  ) : (
                                    fmtInt(0, locale)
                                  )
                                }
                              />
                              {mode === "detailed" && (
                                <>
                                  <StatCell label={t("sh.tripKm")} value={fmtNum(ts.km, locale)} />
                                  <StatCell label={t("sh.deadKm")} value={fmtNum(Math.max(0, km - ts.km), locale)} tone="warn" />
                                </>
                              )}
                            </StatGrid>
                            {s.notes && (
                              <p className="text-xs text-muted mt-2.5 pt-2 border-t border-line truncate">
                                {s.notes}
                              </p>
                            )}
                          </RecordCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {editingRow && (
          <RowEditor
            row={editingRow}
            title={t("sh.editShift")}
            fields={shiftEditFields(t)}
            onCancel={() => setEditingRow(null)}
            onSave={(patch) => update(editingRow.id, patch)}
          />
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          labelPrev={t("c.prev")}
          labelNext={t("c.next")}
          labelPage={t("c.pageOf", { page, total: totalPages })}
        />
      </Card>
    </div>
  );
}
