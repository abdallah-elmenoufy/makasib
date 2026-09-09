"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, GroupHeader, Input, PageTitle, Pagination, RecordCard, Select, StatCell, StatGrid, Textarea } from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { PhotoInput } from "@/components/PhotoInput";
import { GpsTracker } from "@/components/GpsTracker";
import { RowEditor, type EditField } from "@/components/RowEditor";
import { fmtDate, fmtDateTime, fmtNum, toLocalInput, hoursBetween } from "@/lib/format";

type T = (k: string, vars?: Record<string, string | number>) => string;

/**
 * Best guess at the end-odometer so the driver can confirm a number instead
 * of squinting at the dash while parked.
 *
 * Priority is by how much the source actually knows:
 *  1. GPS distance recorded during the shift — measured, not inferred.
 *  2. Trip km + pickup km, scaled up by this driver's own historical ratio
 *     of shift km to trip km. That ratio captures their cruising/dead km
 *     habit, and self-corrects as they log more shifts.
 *  3. Raw trip km + pickup km — a floor, since cruising is never negative.
 * Returns null when there's nothing to base a guess on: a wrong prefill is
 * worse than an empty box, because odometer readings drive every km cost.
 */
function suggestEndOdometer(
  active: any,
  trips: any[],
  completed: any[]
): { value: number; basis: "gps" | "ratio" | "trips" } | null {
  if (active.gpsKm && active.gpsKm > 0) {
    return { value: Math.round(active.startOdometer + active.gpsKm), basis: "gps" };
  }

  const mine = trips.filter((tr) => tr.shiftId === active.id);
  const tripKm = mine.reduce((s, tr) => s + (tr.distanceKm ?? 0) + (tr.pickupKm ?? 0), 0);
  if (tripKm <= 0) return null;

  // historical shiftKm / tripKm across completed shifts that have both
  let histShift = 0;
  let histTrip = 0;
  for (const s of completed) {
    const t = trips.filter((tr) => tr.shiftId === s.id).reduce((a, tr) => a + (tr.distanceKm ?? 0) + (tr.pickupKm ?? 0), 0);
    if (t > 0 && s.endOdometer != null) {
      histShift += s.endOdometer - s.startOdometer;
      histTrip += t;
    }
  }
  // clamp: a ratio below 1 would mean driving less than the trips themselves
  const ratio = histTrip > 0 ? Math.min(Math.max(histShift / histTrip, 1), 2.5) : null;
  return ratio
    ? { value: Math.round(active.startOdometer + tripKm * ratio), basis: "ratio" }
    : { value: Math.round(active.startOdometer + tripKm), basis: "trips" };
}

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
  const { vehicle, activeVehicles, loading: vLoading, setDefaultVehicle } = useVehicle();
  const { rows: shifts, loading, create, update, remove, page, setPage, totalPages, total } = useCrud<any>(
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

  const active = shifts.find((s) => s.endOdometer == null);
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
        <Link href="/cars" className="text-emerald-600 underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  return (
    <div>
      <PageTitle
        actions={
          <Link
            href="/import?tab=shift"
            className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2"
          >
            📷 {t("sh.fromPhotos")}
          </Link>
        }
      >
        {t("sh.title")}
      </PageTitle>

      {active ? (
        <EndShiftCard
          shift={active}
          suggestedEndOdo={suggestEndOdometer(active, trips, completed)}
          onEnd={(data) => update(active.id, data)}
        />
      ) : (
        <StartShiftCard
          lastOdo={shifts[0]?.endOdometer ?? vehicle.initialOdometer}
          vehicles={activeVehicles}
          currentVehicleId={vehicle.id}
          onSwitchDefault={setDefaultVehicle}
          onStart={(data) => create(data)}
        />
      )}

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
                    meta={`${t("sh.shiftCount", { n: dg.shifts.length })} · ${t("tr.tripCount", { n: dayTrips })}`}
                    right={<span className="text-xs font-bold tnum">{fmtNum(dayRevenue, locale)}</span>}
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
                                  {s.endTime && <span className="text-slate-400"> → {fmtDateTime(s.endTime, locale)}</span>}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 tnum">
                                  {fmtNum(s.startOdometer, locale, 0)} → {s.endOdometer != null ? fmtNum(s.endOdometer, locale, 0) : "—"} {t("c.km")}
                                </div>
                              </div>
                              <div className="text-end shrink-0">
                                <div className="text-lg font-black text-emerald-700 tnum leading-none">
                                  {fmtNum(ts.revenue, locale)}
                                </div>
                                <div className="flex gap-2 justify-end mt-1.5">
                                  <button onClick={() => setEditingRow(s)} className="text-xs text-slate-500 hover:text-slate-800">
                                    {t("c.edit")}
                                  </button>
                                  <button
                                    onClick={() => confirm(t("c.confirmDelete")) && remove(s.id)}
                                    className="text-xs text-red-400 hover:text-red-600"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                            <StatGrid cols={5}>
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
                                      className="text-emerald-600 underline underline-offset-2"
                                      title={t("sh.viewTrips")}
                                    >
                                      {ts.count}
                                    </button>
                                  ) : (
                                    0
                                  )
                                }
                              />
                              <StatCell label={t("sh.tripKm")} value={fmtNum(ts.km, locale)} />
                              <StatCell label={t("sh.deadKm")} value={fmtNum(Math.max(0, km - ts.km), locale)} tone="warn" />
                            </StatGrid>
                            {s.notes && (
                              <p className="text-xs text-slate-400 mt-2.5 pt-2 border-t border-slate-100 truncate">
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

function StartShiftCard({
  lastOdo,
  vehicles,
  currentVehicleId,
  onSwitchDefault,
  onStart,
}: {
  lastOdo: number;
  vehicles: any[];
  currentVehicleId: string;
  onSwitchDefault: (id: string) => void;
  onStart: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [ocrHint, setOcrHint] = useState(false);
  const [vehicleId, setVehicleId] = useState(currentVehicleId);

  // pick the OCR candidate that plausibly continues from the last known reading
  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter((c) => c >= lastOdo && c < lastOdo + 2000);
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null && !odo) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  if (!open) {
    return (
      <Btn variant="big" onClick={() => { setTime(toLocalInput()); setVehicleId(currentVehicleId); setOpen(true); }}>
        ▶ {t("sh.start")}
      </Btn>
    );
  }

  return (
    <Card className="border-emerald-300">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (vehicleId !== currentVehicleId) onSwitchDefault(vehicleId);
          if (
            await onStart({
              vehicleId,
              startTime: new Date(time).toISOString(),
              startOdometer: odo,
              startPhoto: photo,
              notes,
            })
          ) {
            setOpen(false);
            setOdo("");
            setPhoto(null);
            setNotes("");
          }
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {vehicles.length > 1 && (
          <Field label={t("sh.whichCar")}>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("sh.startOdo")} hint={ocrHint ? `📷 ${t("sh.ocrDetected")}` : undefined}>
          <Input
            type="number"
            step="0.1"
            value={odo}
            onChange={(e) => { setOdo(e.target.value); setOcrHint(false); }}
            placeholder={String(lastOdo)}
            required
            autoFocus
          />
        </Field>
        <Field label={t("sh.startTime")}>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label={`${t("c.photo")} (${t("c.optional")})`}>
          <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} />
        </Field>
        <Field label={`${t("c.notes")} (${t("c.optional")})`}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="md:col-span-2 flex gap-2">
          <Btn type="submit">▶ {t("sh.start")}</Btn>
          <Btn variant="secondary" onClick={() => setOpen(false)}>
            {t("c.cancel")}
          </Btn>
        </div>
      </form>
    </Card>
  );
}

function EndShiftCard({
  shift,
  suggestedEndOdo,
  onEnd,
}: {
  shift: any;
  suggestedEndOdo: { value: number; basis: "gps" | "ratio" | "trips" } | null;
  onEnd: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [ocrHint, setOcrHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async (thenImport: boolean) => {
    setBusy(true);
    const ok = await onEnd({
      endTime: new Date(time).toISOString(),
      endOdometer: odo,
      endPhoto: photo,
      notes,
    });
    setBusy(false);
    // the driver almost always imports the night's screenshots straight after
    // ending — carrying them there saves a page hunt while they're tired
    if (ok && thenImport) router.push("/import?tab=ocr");
  };

  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter(
      (c) => c > shift.startOdometer && c < shift.startOdometer + 2000
    );
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null && !odo) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-semibold text-sm">
          {t("sh.active")} · {t("sh.startedAt")} {fmtDateTime(shift.startTime, locale)} ·{" "}
          {fmtNum(shift.startOdometer, locale)} {t("c.km")}
        </span>
      </div>
      <div className="mb-3">
        <GpsTracker shiftId={shift.id} initialKm={shift.gpsKm ?? null} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          finish(false);
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <Field label={t("sh.endOdo")} hint={ocrHint ? `📷 ${t("sh.ocrDetected")}` : undefined}>
          <Input
            type="number"
            step="0.1"
            value={odo}
            onChange={(e) => { setOdo(e.target.value); setOcrHint(false); }}
            min={shift.startOdometer}
            required
            autoFocus
          />
          {suggestedEndOdo && !odo && (
            <button
              type="button"
              onClick={() => setOdo(String(suggestedEndOdo.value))}
              className="mt-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-full text-start transition-colors"
            >
              ✨ {t("sh.suggestOdo", { n: fmtNum(suggestedEndOdo.value, locale, 0) })}
              <span className="block text-emerald-600/70 font-normal mt-0.5">
                {t(`sh.suggestBasis.${suggestedEndOdo.basis}`)}
              </span>
            </button>
          )}
        </Field>
        <Field label={t("sh.endTime")}>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label={`${t("c.photo")} (${t("c.optional")})`}>
          <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} />
        </Field>
        <Field label={`${t("c.notes")} (${t("c.optional")})`}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Btn type="submit" disabled={busy}>
            ⏹ {t("sh.end")}
          </Btn>
          <Btn variant="secondary" disabled={busy} onClick={() => odo && finish(true)}>
            ⏹📸 {t("sh.endAndImport")}
          </Btn>
        </div>
      </form>
    </Card>
  );
}
