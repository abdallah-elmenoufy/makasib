"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { AddPanel, Btn, Card, Empty, Field, Input, PageTitle, Pagination, Select, Table, Textarea } from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { PhotoInput } from "@/components/PhotoInput";
import { fmtDate, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

const CATEGORIES = [
  "OIL",
  "OIL_FILTER",
  "AIR_FILTER",
  "TIRES",
  "BRAKES",
  "BATTERY",
  "SPARK_PLUGS",
  "TRANSMISSION",
  "COOLING",
  "CNG_SERVICE",
  "SUSPENSION",
  "ELECTRICAL",
  "BODY",
  "OTHER",
];

const empty = () => ({
  date: toLocalInput(),
  odometer: "",
  category: "OIL",
  description: "",
  cost: "",
  photo: null as string | null,
  notes: "",
});

export default function MaintenancePage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows, loading, create, remove, page, setPage, totalPages } = useCrud<any>("maintenance", vehicle?.id);
  const [form, setForm] = useState<any>(empty());
  const [open, setOpen] = useState(false);

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
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  return (
    <div>
      <PageTitle>{t("mn.title")}</PageTitle>

      <AddPanel buttonLabel={t("mn.add")} open={open} setOpen={setOpen}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await create({ ...form, vehicleId: vehicle.id, date: new Date(form.date).toISOString() })) {
              setForm(empty());
              setOpen(false);
            }
          }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <Field label={t("c.date")}>
            <Input type="datetime-local" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label={t("mn.category")}>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`mn.cat.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("mn.cost")}>
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} required />
          </Field>
          <Field label={`${t("c.odometer")} (${t("c.optional")})`}>
            <Input type="number" step="0.1" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} />
          </Field>
          <Field label={`${t("mn.description")} (${t("c.optional")})`}>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label={`${t("c.photo")} (${t("c.optional")})`}>
            <PhotoInput value={form.photo} onChange={(v) => set("photo", v)} />
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
        {rows.length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <Table head={[t("c.date"), t("mn.category"), t("mn.description"), t("c.odometer"), t("mn.cost"), t("c.notes"), ""]}>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="py-2 px-2 whitespace-nowrap">{fmtDate(m.date, locale)}</td>
                <td className="py-2 px-2">{t(`mn.cat.${m.category}`)}</td>
                <td className="py-2 px-2">{m.description ?? "—"}</td>
                <td className="py-2 px-2">{m.odometer ? fmtNum(m.odometer, locale) : "—"}</td>
                <td className="py-2 px-2 font-semibold">{fmtMoney(m.cost, locale)}</td>
                <td className="py-2 px-2 text-slate-400 max-w-32 truncate">{m.notes ?? ""}</td>
                <td className="py-2 px-2">
                  <button onClick={() => confirm(t("c.confirmDelete")) && remove(m.id)} className="text-red-400 text-xs">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
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
