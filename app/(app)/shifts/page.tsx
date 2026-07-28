"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Pagination, Select, Table, Textarea } from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { PhotoInput } from "@/components/PhotoInput";
import { GpsTracker } from "@/components/GpsTracker";
import { fmtDate, fmtDateTime, fmtNum, toLocalInput, hoursBetween } from "@/lib/format";

const SHIFT_COLS = 8;

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
        <EndShiftCard shift={active} onEnd={(data) => update(active.id, data)} />
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
          <Table
            head={[
              t("sh.startTime"),
              t("sh.duration"),
              t("sh.km"),
              t("sh.trips"),
              t("sh.tripKm"),
              t("sh.deadKm"),
              t("sh.revenue"),
              t("c.notes"),
              "",
            ]}
          >
            {dayGroups.map((dg) => {
              const isOpen = !!expandedDays[dg.key];
              const dayRevenue = dg.shifts.reduce((s, sh) => s + (tripsByShift[sh.id]?.revenue ?? 0), 0);
              const dayTrips = dg.shifts.reduce((s, sh) => s + (tripsByShift[sh.id]?.count ?? 0), 0);
              return (
                <Fragment key={dg.key}>
                  <tr
                    onClick={() => toggleDay(dg.key)}
                    className="cursor-pointer select-none bg-slate-50 hover:bg-slate-100"
                  >
                    <td colSpan={SHIFT_COLS} className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                        <span className="font-semibold text-sm">{fmtDate(dg.key, locale)}</span>
                        <span className="text-xs text-slate-500">
                          · {t("sh.shiftCount", { n: dg.shifts.length })} · {t("tr.tripCount", { n: dayTrips })}
                        </span>
                        <span className="ms-auto text-xs font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {fmtNum(dayRevenue, locale)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    dg.shifts.map((s) => {
                      const km = s.endOdometer - s.startOdometer;
                      const ts = tripsByShift[s.id] ?? { count: 0, km: 0, revenue: 0 };
                      return (
                        <tr key={s.id}>
                          <td className="py-2 px-2 whitespace-nowrap ps-6">{fmtDateTime(s.startTime, locale)}</td>
                          <td className="py-2 px-2">
                            {s.endTime ? `${fmtNum(hoursBetween(s.startTime, s.endTime), locale)} ${t("c.hours")}` : "—"}
                          </td>
                          <td className="py-2 px-2 font-semibold">{fmtNum(km, locale)}</td>
                          <td className="py-2 px-2">
                            {ts.count > 0 ? (
                              <button
                                onClick={() => router.push(`/trips?shiftId=${s.id}`)}
                                className="text-emerald-600 underline font-semibold"
                                title={t("sh.viewTrips")}
                              >
                                {ts.count}
                              </button>
                            ) : (
                              0
                            )}
                          </td>
                          <td className="py-2 px-2">{fmtNum(ts.km, locale)}</td>
                          <td className="py-2 px-2 text-amber-600">{fmtNum(Math.max(0, km - ts.km), locale)}</td>
                          <td className="py-2 px-2">{fmtNum(ts.revenue, locale)}</td>
                          <td className="py-2 px-2 text-slate-400 max-w-40 truncate">{s.notes ?? ""}</td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => confirm(t("c.confirmDelete")) && remove(s.id)}
                              className="text-red-400 text-xs"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </Table>
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
  onEnd,
}: {
  shift: any;
  onEnd: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [ocrHint, setOcrHint] = useState(false);

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
        onSubmit={async (e) => {
          e.preventDefault();
          await onEnd({
            endTime: new Date(time).toISOString(),
            endOdometer: odo,
            endPhoto: photo,
            notes,
          });
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
        <div className="md:col-span-2">
          <Btn type="submit">⏹ {t("sh.end")}</Btn>
        </div>
      </form>
    </Card>
  );
}
