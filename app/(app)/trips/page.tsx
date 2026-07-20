"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Empty, Field, Input, PageTitle, Select, Table, Textarea } from "@/components/ui";
import { useCrud, useVehicle } from "@/components/useCrud";
import { fmtDateTime, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

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

export default function TripsPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const tripsCrud = useCrud<any>("trips", vehicle?.id);
  const { rows: trips, loading, update: updateTrip, remove } = tripsCrud;
  const tipsCrud = useCrud<any>("tips", vehicle?.id);
  const [tipForm, setTipForm] = useState({ tripId: "", date: toLocalInput(), amount: "", notes: "" });
  const [tipOpen, setTipOpen] = useState(false);

  if (vLoading || loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/vehicle" className="text-emerald-600 underline">
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
                  {trips.map((tr) => (
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
            {trips.map((tr) => (
              <tr key={tr.id}>
                <td className="py-2 px-2 whitespace-nowrap">{fmtDateTime(tr.startTime, locale)}</td>
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
                  <button onClick={() => confirm(t("c.confirmDelete")) && remove(tr.id)} className="text-red-400 text-xs">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </Table>
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
