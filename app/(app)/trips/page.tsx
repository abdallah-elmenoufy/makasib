"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Badge, Btn, Card, Empty, Field, GroupHeader, Input, Modal, PageTitle, Pagination, RecordCard, Select, StatCell, StatGrid, Table, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TripBatchEntry } from "@/components/TripBatchEntry";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { RowEditor, type EditField } from "@/components/RowEditor";
import { LoggingContext } from "@/components/LoggingContext";
import { QuickAddTrip } from "@/components/QuickAddTrip";
import { fmtDateTime, fmtMoney, fmtNum, hoursBetween, toLocalInput, sep } from "@/lib/format";

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];

type T = (k: string, vars?: Record<string, string | number>) => string;

/** Every field a trip carries, so the editor is a true superset of what the
 *  table shows and a driver never has to delete a row to correct one value. */
const tripEditFields = (t: T): EditField[] => [
  { key: "startTime", label: t("tr.startTime"), type: "datetime" },
  { key: "endTime", label: t("tr.endTime"), type: "datetime" },
  { key: "platform", label: t("tr.platform"), type: "select", options: PLATFORMS.map((p) => ({ value: p, label: t(`pf.${p}`) })) },
  { key: "fare", label: t("tr.fare"), type: "number", step: "0.01" },
  {
    key: "paymentType",
    label: t("tr.payment"),
    type: "select",
    options: [
      { value: "CASH", label: t("tr.CASH") },
      { value: "CARD", label: t("tr.CARD") },
    ],
  },
  { key: "tip", label: t("tr.tip"), type: "number", step: "0.01" },
  { key: "distanceKm", label: t("tr.distance"), type: "number", step: "0.1" },
  { key: "pickupKm", label: t("tr.pickupKm"), type: "number", step: "0.1" },
  { key: "pickupMin", label: t("tr.pickupMin"), type: "number", step: "1" },
  { key: "durationMin", label: t("be.minutes"), type: "number", step: "1" },
  { key: "pickupAddress", label: t("tr.pickupAddress"), type: "text" },
  { key: "dropoffAddress", label: t("tr.dropoffAddress"), type: "text" },
  { key: "notes", label: t("c.notes"), type: "textarea" },
];

export default function TripsPage() {
  return (
    <Suspense>
      <TripsInner />
    </Suspense>
  );
}

function TripsInner() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const params = useSearchParams();
  const router = useRouter();
  const focusShiftId = params.get("shiftId");
  // arriving from the dashboard / active-shift card with ?add=1 opens the
  // batch entry straight away — one tap fewer for a driver at the kerb
  const [adding, setAdding] = useState(params.get("add") === "1");

  const tripsCrud = useCrud<any>("trips", vehicle?.id);
  const { rows: pagedTrips, loading, update: updateTrip, remove, page, setPage, totalPages } = tripsCrud;
  const tipsCrud = useCrud<any>("tips", vehicle?.id);
  const [tipForm, setTipForm] = useState({ tripId: "", date: toLocalInput(), amount: "", notes: "" });
  const [tipOpen, setTipOpen] = useState(false);

  // shift metadata for group headers — fetched in full (not paginated),
  // it's small (one row per shift, not per trip)
  const [shifts, setShifts] = useState<any[]>([]);
  useEffect(() => {
    if (!vehicle?.id) return;
    fetch(`/api/shifts?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setShifts);
  }, [vehicle?.id]);

  // arriving from the shifts page for one specific shift: show every trip
  // in that shift regardless of which page it'd normally land on, instead
  // of making the driver hunt for it across paginated pages
  const [focusTrips, setFocusTrips] = useState<any[] | null>(null);
  useEffect(() => {
    if (!vehicle?.id || !focusShiftId) {
      setFocusTrips(null);
      return;
    }
    fetch(`/api/trips?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => setFocusTrips(all.filter((tr: any) => tr.shiftId === focusShiftId)));
  }, [vehicle?.id, focusShiftId]);

  const trips = focusShiftId ? focusTrips ?? [] : pagedTrips;

  const [editingRow, setEditingRow] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (focusShiftId) setExpanded((e) => ({ ...e, [focusShiftId]: true }));
  }, [focusShiftId]);
  useEffect(() => {
    if (focusShiftId) {
      const el = document.getElementById(`shift-group-${focusShiftId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusShiftId, focusTrips]);

  const openShift = useMemo(() => shifts.find((sh) => sh.endOdometer == null) ?? null, [shifts]);

  const shiftById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const s of shifts) m[s.id] = s;
    return m;
  }, [shifts]);

  // group the currently-visible trips (one page, or one shift's full set)
  // by shift, most recent shift first; trips with no shift form their own
  // "unlinked" group at the top since those need the driver's attention
  const groups = useMemo(() => {
    const order: string[] = [];
    const byKey: Record<string, any[]> = {};
    for (const tr of trips) {
      const key = tr.shiftId ?? "__none__";
      if (!byKey[key]) {
        byKey[key] = [];
        order.push(key);
      }
      byKey[key].push(tr);
    }
    order.sort((a, b) => {
      if (a === "__none__") return -1;
      if (b === "__none__") return 1;
      const sa = shiftById[a]?.startTime;
      const sb = shiftById[b]?.startTime;
      return sa && sb ? new Date(sb).getTime() - new Date(sa).getTime() : 0;
    });
    return order.map((key) => ({ key, shift: key === "__none__" ? null : shiftById[key], trips: byKey[key] }));
  }, [trips, shiftById]);

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

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

  const submitTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(tipForm.amount);
    if (!Number.isFinite(amount)) return;
    let ok: boolean;
    if (tipForm.tripId) {
      ok = await updateTrip(tipForm.tripId, { tip: amount });
    } else {
      ok = await tipsCrud.create({
        vehicleId: vehicle.id,
        date: new Date(tipForm.date).toISOString(),
        amount: tipForm.amount,
        notes: tipForm.notes,
      });
    }
    if (ok) {
      setTipForm({ tripId: "", date: toLocalInput(), amount: "", notes: "" });
      setTipOpen(false);
    }
  };

  return (
    <div>
      <PageTitle
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/import?tab=ocr" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink bg-surface-2 hover:bg-line rounded-full px-4 h-10">
              <Icon name="camera" size={18} /> {t("tr.fromScreens")}
            </Link>
            <Btn onClick={() => setAdding(true)} className="!rounded-full !h-10">
              <Icon name="plus" size={18} strokeWidth={2.5} /> {t("tr.addMany")}
            </Btn>
          </div>
        }
      >
        {t("tr.title")}
      </PageTitle>

      <Modal open={adding} onClose={() => { setAdding(false); if (params.get("add")) router.replace("/trips"); }} title={t("tr.addMany")} wide>
        <TripBatchEntry
          vehicleId={vehicle.id}
          shift={openShift ? { id: openShift.id, startTime: openShift.startTime } : focusShiftId && shiftById[focusShiftId] ? { id: focusShiftId, startTime: shiftById[focusShiftId].startTime, endTime: shiftById[focusShiftId].endTime } : null}
          defaultPlatform={pagedTrips[0]?.platform ?? "UBER"}
          existingCount={openShift ? pagedTrips.filter((tr) => tr.shiftId === openShift.id).length : 0}
          onSaved={() => {
            setAdding(false);
            if (params.get("add")) router.replace("/trips");
            tripsCrud.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <LoggingContext vehicleId={vehicle.id} onChanged={() => tripsCrud.refresh()} />

      {focusShiftId && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-muted">{t("tr.filteredByShift")}</span>
          <Link href="/trips" className="text-action underline font-semibold">
            {t("tr.clearFilter")}
          </Link>
        </div>
      )}

      <div className="mb-3">
        <QuickAddTrip
          vehicleId={vehicle.id}
          defaultPlatform={pagedTrips[0]?.platform ?? "UBER"}
          onAdded={() => tripsCrud.refresh()}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <AddPanel buttonLabel={t("tip.add")} open={tipOpen} setOpen={setTipOpen}>
          <form onSubmit={submitTip} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label={t("tip.selectTrip")} hint={t("tip.tiedHint")}>
                <Select
                  value={tipForm.tripId}
                  onChange={(e) => setTipForm({ ...tipForm, tripId: e.target.value })}
                >
                  <option value="">{t("tip.noTrip")}</option>
                  {pagedTrips.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {fmtDateTime(tr.startTime, locale)} — {fmtMoney(tr.fare - (tr.commission ?? 0), locale)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t("tip.amount")}>
              <Input
                type="number"
                step="0.01"
                value={tipForm.amount}
                onChange={(e) => setTipForm({ ...tipForm, amount: e.target.value })}
                required
              />
            </Field>
            {!tipForm.tripId && (
              <Field label={t("c.date")}>
                <Input
                  type="datetime-local"
                  value={tipForm.date}
                  onChange={(e) => setTipForm({ ...tipForm, date: e.target.value })}
                  required
                />
              </Field>
            )}
            {!tipForm.tripId && (
              <div className="col-span-2">
                <Field label={`${t("c.notes")} (${t("c.optional")})`}>
                  <Textarea value={tipForm.notes} onChange={(e) => setTipForm({ ...tipForm, notes: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="col-span-2">
              <Btn type="submit">{t("c.save")}</Btn>
            </div>
          </form>
        </AddPanel>
      </div>

      <Card className="mt-2">
        {trips.length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const isOpen = !!expanded[g.key];
              const revenue = g.trips.reduce((s, tr) => s + (tr.fare - (tr.commission ?? 0) + (tr.tip ?? 0)), 0);
              const label = g.shift ? fmtDateTime(g.shift.startTime, locale) : t("tr.noShiftGroup");
              const sub = g.shift?.endTime
                ? `${fmtNum(hoursBetween(g.shift.startTime, g.shift.endTime), locale)} ${t("c.hours")}`
                : g.shift
                ? t("sh.active")
                : null;
              return (
                <div key={g.key} id={`shift-group-${g.key}`}>
                  <GroupHeader
                    open={isOpen}
                    onToggle={() => toggle(g.key)}
                    tone={g.key === "__none__" ? "warn" : "plain"}
                    title={label}
                    meta={`${sub ? sub + sep(locale) : ""}${t("tr.tripCount", { n: g.trips.length })}`}
                    right={<span className="text-xs font-bold tnum text-money">{fmtMoney(revenue, locale)}</span>}
                  />
                  {isOpen && (
                    <div className="space-y-2 mt-2 ps-2 sm:ps-4">
                      {g.trips.map((tr) => (
                        <RecordCard key={tr.id} tone={tr.shiftId ? "plain" : "warn"}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm tnum">{fmtDateTime(tr.startTime, locale)}</span>
                                <Badge tone="neutral">{t(`pf.${tr.platform}`)}</Badge>
                                <Badge tone={tr.paymentType === "CASH" ? "warn" : "neutral"}>
                                  {t(`tr.${tr.paymentType}`)}
                                </Badge>
                                {!tr.shiftId && <Badge tone="warn">{t("tr.noShift")}</Badge>}
                                {(tr.pickupLat != null || tr.dropoffLat != null) && (
                                  <a
                                    href={`https://www.openstreetmap.org/?mlat=${tr.pickupLat ?? tr.dropoffLat}&mlon=${tr.pickupLng ?? tr.dropoffLng}#map=15/${tr.pickupLat ?? tr.dropoffLat}/${tr.pickupLng ?? tr.dropoffLng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={t("tr.located")}
                                    className="text-muted hover:text-ink"
                                  >
                                    <Icon name="pin" size={14} />
                                  </a>
                                )}
                              </div>
                              {(tr.pickupAddress || tr.dropoffAddress) && (
                                <p className="text-xs text-muted mt-1 truncate">
                                  {tr.pickupAddress ?? "—"} → {tr.dropoffAddress ?? "—"}
                                </p>
                              )}
                            </div>
                            <div className="text-end shrink-0">
                              <div className="text-lg font-bold text-money tnum leading-none">
                                {fmtMoney(tr.fare - (tr.commission ?? 0), locale)}
                              </div>
                              <div className="flex gap-2 justify-end mt-1.5">
                                <button onClick={() => setEditingRow(tr)} className="text-xs text-muted hover:text-ink">
                                  {t("c.edit")}
                                </button>
                                <button
                                  onClick={() => confirm(t("c.confirmDelete")) && remove(tr.id)}
                                  className="text-xs text-loss hover:text-loss"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                          <StatGrid cols={6}>
                            <StatCell label={t("tr.endTime")} value={tr.endTime ? fmtDateTime(tr.endTime, locale) : "—"} />
                            <StatCell label={t("tr.tip")} value={tr.tip ? fmtNum(tr.tip, locale) : "—"} />
                            <StatCell label={t("tr.distance")} value={tr.distanceKm ? fmtNum(tr.distanceKm, locale) : "—"} />
                            <StatCell label={t("tr.pickupKm")} value={tr.pickupKm ? fmtNum(tr.pickupKm, locale) : "—"} />
                            <StatCell
                              label={t("tr.pickupMin")}
                              value={tr.pickupMin != null ? fmtNum(tr.pickupMin, locale, 0) : "—"}
                            />
                            <StatCell label={t("be.minutes")} value={tr.durationMin != null ? fmtNum(tr.durationMin, locale, 0) : tr.endTime ? fmtNum(hoursBetween(tr.startTime, tr.endTime) * 60, locale, 0) : "—"} />
                            <StatCell
                              label={t("tr.perMin")}
                              value={(() => {
                                const mins = tr.durationMin ?? (tr.endTime ? hoursBetween(tr.startTime, tr.endTime) * 60 : 0);
                                return mins > 0 ? fmtMoney((tr.fare - (tr.commission ?? 0) + (tr.tip ?? 0)) / mins, locale) : "—";
                              })()}
                              tone="good"
                            />
                          </StatGrid>
                          {(tr.notes || tr.source) && (
                            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-line text-xs text-muted">
                              {tr.source && <span className="shrink-0">{tr.source}</span>}
                              {tr.notes && <span className="truncate">{sep(locale)}{tr.notes}</span>}
                            </div>
                          )}
                        </RecordCard>
                      ))}
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
            title={t("tr.editTrip")}
            fields={tripEditFields(t)}
            onCancel={() => setEditingRow(null)}
            onSave={(patch) => updateTrip(editingRow.id, patch)}
          />
        )}
        {!focusShiftId && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            labelPrev={t("c.prev")}
            labelNext={t("c.next")}
            labelPage={t("c.pageOf", { page, total: totalPages })}
          />
        )}
      </Card>

      {tipsCrud.rows.length > 0 && (
        <Card className="mt-4">
          <div className="font-semibold text-sm mb-2">{t("tip.noTrip")}</div>
          <Table head={[t("c.date"), t("tip.amount"), t("c.notes"), ""]}>
            {tipsCrud.rows.map((tp) => (
              <tr key={tp.id}>
                <td className="py-2 px-2">{fmtDateTime(tp.date, locale)}</td>
                <td className="py-2 px-2 font-semibold">{fmtMoney(tp.amount, locale)}</td>
                <td className="py-2 px-2 text-muted">{tp.notes ?? ""}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => confirm(t("c.confirmDelete")) && tipsCrud.remove(tp.id)}
                    className="text-loss text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
