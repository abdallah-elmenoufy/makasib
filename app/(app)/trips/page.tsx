"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Checkbox, Empty, Field, Input, PageTitle, Select, Table, Textarea } from "@/components/ui";
import { useCrud, useVehicle } from "@/components/useCrud";
import { fmtDateTime, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];

const emptyTrip = () => ({
  platform: "UBER",
  startTime: toLocalInput(),
  fare: "",
  distanceKm: "",
  paymentType: "CASH",
  tip: "",
  commission: "",
  notes: "",
});

export default function TripsPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows: trips, loading, create, remove } = useCrud<any>("trips", vehicle?.id);
  const tipsCrud = useCrud<any>("tips", vehicle?.id);
  const [form, setForm] = useState<any>(emptyTrip());
  const [tipForm, setTipForm] = useState({ date: toLocalInput(), amount: "", notes: "" });
  const [open, setOpen] = useState(false);
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
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  return (
    <div>
      <PageTitle>{t("tr.title")}</PageTitle>

      <div className="flex gap-2 flex-wrap">
        <AddPanel buttonLabel={t("tr.add")} open={open} setOpen={setOpen}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await create({
                  ...form,
                  vehicleId: vehicle.id,
                  startTime: new Date(form.startTime).toISOString(),
                })
              ) {
                setForm(emptyTrip());
                setOpen(false);
              }
            }}
            className="grid grid-cols-2 md:grid-cols-3 gap-3"
          >
            <Field label={t("tr.platform")}>
              <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {t(`pf.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("tr.startTime")}>
              <Input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                required
              />
            </Field>
            <Field label={t("tr.fare")}>
              <Input type="number" step="0.01" value={form.fare} onChange={(e) => set("fare", e.target.value)} required />
            </Field>
            <Field label={t("tr.distance")}>
              <Input type="number" step="0.1" value={form.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} />
            </Field>
            <Field label={t("tr.payment")}>
              <Select value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)}>
                <option value="CASH">{t("tr.CASH")}</option>
                <option value="CARD">{t("tr.CARD")}</option>
              </Select>
            </Field>
            <Field label={t("tr.tip")}>
              <Input type="number" step="0.01" value={form.tip} onChange={(e) => set("tip", e.target.value)} />
            </Field>
            <Field label={t("tr.commission")} hint={t("tr.commissionHint")}>
              <Input type="number" step="0.01" value={form.commission} onChange={(e) => set("commission", e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label={`${t("c.notes")} (${t("c.optional")})`}>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
            <div className="col-span-2 md:col-span-3 flex items-center gap-3">
              <Btn type="submit">{t("c.save")}</Btn>
              <span className="text-xs text-slate-400">✓ {t("tr.autoMatch")}</span>
            </div>
          </form>
        </AddPanel>

        <AddPanel buttonLabel={t("tip.add")} open={tipOpen} setOpen={setTipOpen}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await tipsCrud.create({
                  vehicleId: vehicle.id,
                  date: new Date(tipForm.date).toISOString(),
                  amount: tipForm.amount,
                  notes: tipForm.notes,
                })
              ) {
                setTipForm({ date: toLocalInput(), amount: "", notes: "" });
                setTipOpen(false);
              }
            }}
            className="grid grid-cols-2 gap-3"
          >
            <Field label={t("tip.amount")}>
              <Input
                type="number"
                step="0.01"
                value={tipForm.amount}
                onChange={(e) => setTipForm({ ...tipForm, amount: e.target.value })}
                required
              />
            </Field>
            <Field label={t("c.date")}>
              <Input
                type="datetime-local"
                value={tipForm.date}
                onChange={(e) => setTipForm({ ...tipForm, date: e.target.value })}
                required
              />
            </Field>
            <div className="col-span-2">
              <Field label={`${t("c.notes")} (${t("c.optional")})`}>
                <Textarea value={tipForm.notes} onChange={(e) => setTipForm({ ...tipForm, notes: e.target.value })} />
              </Field>
            </div>
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
              t("tr.fare"),
              t("tr.payment"),
              t("tr.tip"),
              t("tr.distance"),
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
                <td className="py-2 px-2 font-semibold">{fmtMoney(tr.fare, locale)}</td>
                <td className="py-2 px-2">{t(`tr.${tr.paymentType}`)}</td>
                <td className="py-2 px-2">{tr.tip ? fmtMoney(tr.tip, locale) : "—"}</td>
                <td className="py-2 px-2">{tr.distanceKm ? fmtNum(tr.distanceKm, locale) : "—"}</td>
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
          <div className="font-semibold text-sm mb-2">{t("tip.add")}</div>
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
