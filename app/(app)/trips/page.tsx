"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Empty, Field, Input, PageTitle, Table, Textarea } from "@/components/ui";
import { useCrud, useVehicle } from "@/components/useCrud";
import { fmtDateTime, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

export default function TripsPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows: trips, loading, remove } = useCrud<any>("trips", vehicle?.id);
  const tipsCrud = useCrud<any>("tips", vehicle?.id);
  const [tipForm, setTipForm] = useState({ date: toLocalInput(), amount: "", notes: "" });
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
                <td className="py-2 px-2">{tr.tip ? fmtMoney(tr.tip, locale) : "—"}</td>
                <td className="py-2 px-2">{tr.distanceKm ? fmtNum(tr.distanceKm, locale) : "—"}</td>
                <td className="py-2 px-2">{tr.pickupKm ? fmtNum(tr.pickupKm, locale) : "—"}</td>
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
