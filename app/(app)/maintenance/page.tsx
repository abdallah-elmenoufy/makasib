"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import {
  AddPanel,
  Badge,
  Btn,
  Card,
  CardHead,
  Empty,
  Field,
  Input,
  Meter,
  PageTitle,
  Pagination,
  Select,
  Table,
  Textarea,
} from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { PhotoInput } from "@/components/PhotoInput";
import { RowEditor } from "@/components/RowEditor";
import { fmtDate, fmtMoney, fmtNum, toLocalInput, sep } from "@/lib/format";
import { hasInterval, inServiceItems, serviceProgress, type ServiceState } from "@/lib/maintenance";

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
  lifetimeKm: "",
  photo: null as string | null,
  notes: "",
});

/** Typical service intervals (km) so the driver gets a sensible starting
 *  number instead of a blank box — always editable, never forced. */
const DEFAULT_INTERVAL_KM: Record<string, number> = {
  OIL: 5000,
  OIL_FILTER: 5000,
  AIR_FILTER: 10000,
  TIRES: 40000,
  BRAKES: 50000,
  BATTERY: 60000,
  SPARK_PLUGS: 30000,
  TRANSMISSION: 60000,
  COOLING: 40000,
  CNG_SERVICE: 20000,
  SUSPENSION: 60000,
  ELECTRICAL: 0,
  BODY: 0,
  OTHER: 0,
};

const STATE_TONE = { ok: "good", dueSoon: "warn", overdue: "bad" } as const;

export default function MaintenancePage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows, loading, create, remove, update, page, setPage, totalPages } = useCrud<any>("maintenance", vehicle?.id);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [form, setForm] = useState<any>(empty());
  const [open, setOpen] = useState(false);
  // the table is paginated, but wear has to be read across the whole history
  // — and against the car's live odometer, not the last row on this page
  const [allRows, setAllRows] = useState<any[]>([]);
  const [currentOdo, setCurrentOdo] = useState<number | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/maintenance?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAllRows(Array.isArray(d) ? d : []));
    fetch(`/api/analytics?vehicleId=${vehicle.id}&period=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => setCurrentOdo(a?.currentOdo ?? null));
    // `rows` changes identity after every create/update/delete (useCrud
    // refetches), which is exactly when the wear picture needs redrawing
  }, [vehicle, rows]);

  const liveIds = useMemo(() => new Set(inServiceItems(allRows).map((m) => m.id)), [allRows]);

  const progressFor = (m: any) =>
    serviceProgress(m, currentOdo ?? 0, liveIds.has(m.id));

  /** In-service parts that can actually be drawn, worst wear first. */
  const tracked = useMemo(() => {
    if (currentOdo == null) return [];
    return allRows
      .filter((m) => liveIds.has(m.id))
      .map((m) => ({ m, p: serviceProgress(m, currentOdo, true) }))
      .filter((x) => x.p.ratio != null)
      .sort((a, b) => b.p.ratio! - a.p.ratio!);
  }, [allRows, liveIds, currentOdo]);

  /** In-service parts with an interval but no odometer — one field away. */
  const untrackable = useMemo(
    () => allRows.filter((m) => liveIds.has(m.id) && (m.odometer == null || m.odometer <= 0)).length,
    [allRows, liveIds]
  );

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
  const set = (k: string, v: unknown) => {
    const next = { ...form, [k]: v };
    // switching category pre-fills its typical interval, but only while the
    // driver hasn't typed their own — never clobber a manual entry
    if (k === "category" && !form.lifetimeKm) {
      const suggested = DEFAULT_INTERVAL_KM[String(v)] ?? 0;
      next.lifetimeKm = suggested > 0 ? String(suggested) : "";
    }
    setForm(next);
  };

  const perKm =
    Number(form.cost) > 0 && Number(form.lifetimeKm) > 0
      ? Number(form.cost) / Number(form.lifetimeKm)
      : null;

  return (
    <div>
      <PageTitle>{t("mn.title")}</PageTitle>

      {tracked.length > 0 && (
        <Card className="mb-4">
          <CardHead
            icon="🔧"
            title={t("mn.serviceLifeTitle")}
            sub={t("mn.serviceLifeSub")}
            actions={
              <span className="text-xs text-muted tnum whitespace-nowrap">
                {fmtNum(currentOdo!, locale, 0)} {t("c.km")}
              </span>
            }
          />
          <div className="space-y-3.5">
            {tracked.map(({ m, p }) => (
              <Meter
                key={m.id}
                ratio={p.ratio!}
                tone={STATE_TONE[p.state as keyof typeof STATE_TONE] ?? "neutral"}
                label={
                  <>
                    {t(`mn.cat.${m.category}`)}
                    <span className="font-normal text-muted">{sep(locale)}{fmtDate(m.date, locale)}</span>
                  </>
                }
                value={`${fmtNum(p.kmUsed!, locale, 0)} / ${fmtNum(m.lifetimeKm, locale, 0)} ${t("c.km")}`}
                sub={
                  p.state === "overdue"
                    ? t("mn.overdueBy", { km: fmtNum(-p.kmRemaining!, locale, 0) })
                    : t("mn.kmLeft", {
                        km: fmtNum(p.kmRemaining!, locale, 0),
                        pct: fmtNum(p.ratio! * 100, locale, 0),
                      })
                }
              />
            ))}
          </div>
          {untrackable > 0 && (
            <p className="text-xs text-warn-ink bg-warn-soft border border-warn/60 rounded-lg px-3 py-2 mt-3">
              {t("mn.needsOdometer", { n: fmtNum(untrackable, locale, 0) })}
            </p>
          )}
        </Card>
      )}

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
          <Field label={t("mn.lifetimeKm")} hint={t("mn.lifetimeKmHint")}>
            <Input
              type="number"
              step="100"
              value={form.lifetimeKm}
              onChange={(e) => set("lifetimeKm", e.target.value)}
              placeholder={t("c.optional")}
            />
          </Field>
          {perKm != null && (
            <div className="col-span-2 md:col-span-3 -mt-1 text-xs bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink">
              {t("mn.perKmPreview", { cost: fmtMoney(perKm, locale), km: fmtNum(Number(form.lifetimeKm), locale, 0) })}
            </div>
          )}
          <Field label={`${t("c.odometer")} (${t("c.optional")})`} hint={t("mn.odometerHint")}>
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
          <Table
            head={[
              t("c.date"),
              t("mn.category"),
              t("mn.description"),
              t("c.odometer"),
              t("mn.cost"),
              t("mn.serviceLife"),
              t("mn.perKm"),
              t("c.notes"),
              "",
            ]}
          >
            {rows.map((m) => {
              const p = progressFor(m);
              return (
                <Fragment key={m.id}>
                  <tr>
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(m.date, locale)}</td>
                    <td className="py-2 px-2">{t(`mn.cat.${m.category}`)}</td>
                    <td className="py-2 px-2">{m.description ?? "—"}</td>
                    <td className="py-2 px-2">{m.odometer ? fmtNum(m.odometer, locale) : "—"}</td>
                    <td className="py-2 px-2 font-semibold">{fmtMoney(m.cost, locale)}</td>
                    <td className="py-2 px-2 min-w-40">
                      <ServiceLifeCell m={m} state={p.state} ratio={p.ratio} kmUsed={p.kmUsed} t={t} locale={locale} />
                    </td>
                    <td className="py-2 px-2 text-ink">
                      {m.lifetimeKm > 0 ? fmtMoney(m.cost / m.lifetimeKm, locale) : "—"}
                    </td>
                    <td className="py-2 px-2 text-muted max-w-32 truncate">{m.notes ?? ""}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <button
                        onClick={() => setEditingRow(m)}
                        className="text-xs text-muted me-2"
                      >
                        {t("c.edit")}
                      </button>
                      <button onClick={() => confirm(t("c.confirmDelete")) && remove(m.id)} className="text-loss text-xs">
                        ✕
                      </button>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </Table>
        )}
        {/* outside <Table>: a sheet inside <tbody> is invalid HTML */}
        {editingRow && (
          <RowEditor
            row={editingRow}
            title={t("mn.editItem")}
            onCancel={() => setEditingRow(null)}
            onSave={(patch) => update(editingRow.id, patch)}
            fields={[
              { key: "date", label: t("c.date"), type: "datetime" },
              {
                key: "category",
                label: t("mn.category"),
                type: "select",
                options: CATEGORIES.map((c) => ({ value: c, label: t(`mn.cat.${c}`) })),
              },
              { key: "description", label: t("mn.description"), type: "text" },
              { key: "cost", label: t("mn.cost"), type: "number", step: "0.01" },
              { key: "lifetimeKm", label: t("mn.lifetimeKm"), type: "number", step: "100", hint: t("mn.lifetimeKmHint") },
              { key: "odometer", label: t("c.odometer"), type: "number", step: "0.1", hint: t("mn.odometerHint") },
              { key: "notes", label: t("c.notes"), type: "textarea" },
            ]}
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

/** The table's wear cell: a bar when the part can be tracked, and a reason
 *  when it can't — never a blank the driver has to guess at. */
function ServiceLifeCell({
  m,
  state,
  ratio,
  kmUsed,
  t,
  locale,
}: {
  m: any;
  state: ServiceState;
  ratio: number | null;
  kmUsed: number | null;
  t: (k: string, v?: Record<string, string | number>) => string;
  locale: string;
}) {
  if (!hasInterval(m)) {
    return (
      <span className="text-warn-ink" title={t("mn.noIntervalHint")}>
        {t("mn.noInterval")}
      </span>
    );
  }
  if (state === "replaced") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted tnum whitespace-nowrap">
          {fmtNum(m.lifetimeKm, locale, 0)} {t("c.km")}
        </span>
        <Badge tone="neutral" title={t("mn.replacedHint")}>
          {t("mn.replaced")}
        </Badge>
      </div>
    );
  }
  if (ratio == null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted tnum whitespace-nowrap">
          {fmtNum(m.lifetimeKm, locale, 0)} {t("c.km")}
        </span>
        <Badge tone="warn" title={t("mn.needsOdometerHint")}>
          {t("mn.noOdo")}
        </Badge>
      </div>
    );
  }
  return (
    <div className="min-w-36">
      <div className="text-xs tnum whitespace-nowrap mb-1">
        {fmtNum(kmUsed!, locale, 0)} / {fmtNum(m.lifetimeKm, locale, 0)} {t("c.km")}
        <span className="text-muted">{sep(locale)}{fmtNum(ratio * 100, locale, 0)}%</span>
      </div>
      <Meter ratio={ratio} tone={STATE_TONE[state as keyof typeof STATE_TONE] ?? "neutral"} thin />
    </div>
  );
}
