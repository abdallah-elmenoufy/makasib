"use client";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Empty, Field, Input, PageTitle, Pagination, Select, Table, Textarea } from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtDateTime, fmtMoney, fmtNum, hoursBetween, toLocalInput } from "@/lib/format";

/** Inline-editable number cell — click to edit, blur/Enter to save. Used for
 *  fields (tip, pickup km) the driver fixes up trip-by-trip, right where the
 *  trip already lives, instead of a disconnected form. */
function EditableNum({
  value,
  onSave,
  locale,
}: {
  value: number | null | undefined;
  onSave: (n: number | null) => void;
  locale: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value != null ? String(value) : "");
          setEditing(true);
        }}
        className="text-start hover:bg-slate-50 rounded px-1 -mx-1 w-full"
      >
        {value ? fmtNum(value, locale) : <span className="text-slate-300">—</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const n = draft.trim() === "" ? null : Number(draft);
    if (n !== value) onSave(n != null && Number.isFinite(n) ? n : null);
  };
  return (
    <input
      type="number"
      step="0.01"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="w-20 rounded border border-emerald-300 px-1.5 py-0.5 text-sm"
    />
  );
}

const TRIP_COLS = 11;

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
  const focusShiftId = params.get("shiftId");

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
        <Link href="/cars" className="text-emerald-600 underline">
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
            <Link
              href="/import?tab=ocr"
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2"
            >
              📸 {t("tr.fromScreens")}
            </Link>
            <Link
              href="/import?tab=manual"
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2"
            >
              ➕ {t("tr.add")}
            </Link>
          </div>
        }
      >
        {t("tr.title")}
      </PageTitle>

      {focusShiftId && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-slate-500">{t("tr.filteredByShift")}</span>
          <Link href="/trips" className="text-emerald-600 underline font-semibold">
            {t("tr.clearFilter")}
          </Link>
        </div>
      )}

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
          <Table
            head={[
              t("tr.startTime"),
              t("tr.platform"),
              t("tr.earnings"),
              t("tr.payment"),
              t("tr.tip"),
              t("tr.distance"),
              t("tr.pickupKm"),
              t("tr.shift"),
              t("tr.source"),
              t("c.notes"),
              "",
            ]}
          >
            {groups.map((g) => {
              const isOpen = !!expanded[g.key];
              const revenue = g.trips.reduce((s, tr) => s + (tr.fare - (tr.commission ?? 0) + (tr.tip ?? 0)), 0);
              const label = g.shift
                ? fmtDateTime(g.shift.startTime, locale)
                : t("tr.noShiftGroup");
              const sub = g.shift?.endTime
                ? `${fmtNum(hoursBetween(g.shift.startTime, g.shift.endTime), locale)} ${t("c.hours")}`
                : g.shift
                ? t("sh.active")
                : null;
              return (
                <Fragment key={g.key}>
                  <tr
                    id={`shift-group-${g.key}`}
                    onClick={() => toggle(g.key)}
                    className={`cursor-pointer select-none ${g.key === "__none__" ? "bg-amber-50 hover:bg-amber-100" : "bg-slate-50 hover:bg-slate-100"}`}
                  >
                    <td colSpan={TRIP_COLS} className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                        <span className="font-semibold text-sm">{label}</span>
                        {sub && <span className="text-xs text-slate-400">· {sub}</span>}
                        <span className="text-xs text-slate-500">
                          · {t("tr.tripCount", { n: g.trips.length })}
                        </span>
                        <span className="ms-auto text-xs font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {fmtMoney(revenue, locale)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    g.trips.map((tr) => (
                      <tr key={tr.id}>
                        <td className="py-2 px-2 whitespace-nowrap ps-6">{fmtDateTime(tr.startTime, locale)}</td>
                        <td className="py-2 px-2">{t(`pf.${tr.platform}`)}</td>
                        <td className="py-2 px-2 font-semibold">
                          {fmtMoney(tr.fare - (tr.commission ?? 0), locale)}
                        </td>
                        <td className="py-2 px-2">{t(`tr.${tr.paymentType}`)}</td>
                        <td className="py-2 px-2" title={t("c.clickToEdit")}>
                          <EditableNum value={tr.tip} locale={locale} onSave={(n) => updateTrip(tr.id, { tip: n ?? 0 })} />
                        </td>
                        <td className="py-2 px-2">{tr.distanceKm ? fmtNum(tr.distanceKm, locale) : "—"}</td>
                        <td className="py-2 px-2" title={t("tr.pickupKmHint")}>
                          <EditableNum value={tr.pickupKm} locale={locale} onSave={(n) => updateTrip(tr.id, { pickupKm: n })} />
                        </td>
                        <td className="py-2 px-2">{tr.shiftId ? "✓" : t("tr.noShift")}</td>
                        <td className="py-2 px-2 text-slate-400 text-xs">{tr.source}</td>
                        <td className="py-2 px-2 text-slate-400 max-w-32 truncate">{tr.notes ?? ""}</td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => confirm(t("c.confirmDelete")) && remove(tr.id)}
                            className="text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </Table>
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
                <td className="py-2 px-2 text-slate-400">{tp.notes ?? ""}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => confirm(t("c.confirmDelete")) && tipsCrud.remove(tp.id)}
                    className="text-red-400 text-xs"
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
