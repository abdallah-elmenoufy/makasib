"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Empty, Field, Input, PageTitle, Table, Textarea } from "@/components/ui";
import { useCrud, useVehicle } from "@/components/useCrud";
import { fmtDate, fmtNum, toLocalInput } from "@/lib/format";

const empty = () => ({
  title: "",
  dueDate: "",
  dueOdometer: "",
  repeatKm: "",
  repeatMonths: "",
  notes: "",
});

export default function RemindersPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows, loading, create, update, remove } = useCrud<any>("reminders", vehicle?.id);
  const [form, setForm] = useState<any>(empty());
  const [open, setOpen] = useState(false);
  const [currentOdo, setCurrentOdo] = useState<number>(0);

  useEffect(() => {
    if (vehicle) {
      fetch(`/api/analytics?vehicleId=${vehicle.id}&period=today`)
        .then((r) => (r.ok ? r.json() : null))
        .then((a) => a && setCurrentOdo(a.currentOdo));
    }
  }, [vehicle]);

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

  const statusOf = (r: any) => {
    const kmLeft = r.dueOdometer != null ? r.dueOdometer - currentOdo : null;
    const daysLeft = r.dueDate ? Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86_400_000) : null;
    if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0)) return "overdue";
    if ((kmLeft != null && kmLeft <= 500) || (daysLeft != null && daysLeft <= 7)) return "dueSoon";
    return "ok";
  };

  const markDone = async (r: any) => {
    const data: Record<string, unknown> = {
      lastDoneDate: new Date().toISOString(),
      lastDoneOdometer: currentOdo,
    };
    if (r.repeatKm) data.dueOdometer = currentOdo + r.repeatKm;
    if (r.repeatMonths) {
      const d = new Date();
      d.setMonth(d.getMonth() + r.repeatMonths);
      data.dueDate = d.toISOString();
    }
    if (!r.repeatKm && !r.repeatMonths) data.active = false;
    await update(r.id, data);
  };

  const badge = {
    overdue: "bg-red-100 text-red-700",
    dueSoon: "bg-amber-100 text-amber-700",
    ok: "bg-emerald-50 text-emerald-700",
  } as const;
  const badgeText = { overdue: t("rm.overdue"), dueSoon: t("rm.dueSoon"), ok: t("rm.ok") } as const;

  return (
    <div>
      <PageTitle>{t("rm.title")}</PageTitle>
      <p className="text-xs text-slate-400 mb-3">
        {t("veh.currentOdo")}: <b>{fmtNum(currentOdo, locale)}</b> {t("c.km")}
      </p>

      <AddPanel buttonLabel={t("rm.add")} open={open} setOpen={setOpen}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await create({
                ...form,
                vehicleId: vehicle.id,
                dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : "",
                active: true,
              })
            ) {
              setForm(empty());
              setOpen(false);
            }
          }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <Field label={t("rm.reminderTitle")}>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <Field label={`${t("rm.dueDate")} (${t("c.optional")})`}>
            <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
          <Field label={`${t("rm.dueOdometer")} (${t("c.optional")})`}>
            <Input type="number" value={form.dueOdometer} onChange={(e) => set("dueOdometer", e.target.value)} />
          </Field>
          <Field label={`${t("rm.repeatKm")} (${t("c.optional")})`}>
            <Input type="number" value={form.repeatKm} onChange={(e) => set("repeatKm", e.target.value)} />
          </Field>
          <Field label={`${t("rm.repeatMonths")} (${t("c.optional")})`}>
            <Input type="number" value={form.repeatMonths} onChange={(e) => set("repeatMonths", e.target.value)} />
          </Field>
          <div className="col-span-2 md:col-span-3">
            <Field label={`${t("c.notes")} (${t("c.optional")})`}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2 md:col-span-3">
            <Btn type="submit">{t("c.save")}</Btn>
          </div>
        </form>
      </AddPanel>

      <Card>
        {rows.filter((r) => r.active).length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <Table head={["", t("rm.reminderTitle"), t("rm.dueDate"), t("rm.dueOdometer"), t("c.notes"), "", ""]}>
            {rows
              .filter((r) => r.active)
              .map((r) => {
                const s = statusOf(r);
                const kmLeft = r.dueOdometer != null ? r.dueOdometer - currentOdo : null;
                return (
                  <tr key={r.id}>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge[s]}`}>
                        {badgeText[s]}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-semibold">{r.title}</td>
                    <td className="py-2 px-2">{r.dueDate ? fmtDate(r.dueDate, locale) : "—"}</td>
                    <td className="py-2 px-2">
                      {r.dueOdometer != null ? (
                        <>
                          {fmtNum(r.dueOdometer, locale)}{" "}
                          <span className="text-xs text-slate-400">
                            (
                            {kmLeft! >= 0
                              ? t("rm.inKm", { n: fmtNum(kmLeft!, locale) })
                              : t("rm.kmOverdue", { n: fmtNum(-kmLeft!, locale) })}
                            )
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-400 max-w-32 truncate">{r.notes ?? ""}</td>
                    <td className="py-2 px-2">
                      <Btn variant="secondary" onClick={() => markDone(r)} className="!px-2 !py-1 !text-xs">
                        ✓ {t("rm.markDone")}
                      </Btn>
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => confirm(t("c.confirmDelete")) && remove(r.id)} className="text-red-400 text-xs">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
          </Table>
        )}
      </Card>
    </div>
  );
}
