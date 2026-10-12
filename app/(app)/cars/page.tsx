"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Segmented, Select, Table, Textarea, Toggle } from "@/components/ui";
import { DEFAULT_MILEAGE_SENSITIVITY_PCT, DEFAULT_LIFETIME_KM, RESIDUAL_RATIO, ANNUAL_DEPRECIATION_RATE, VALUE_FLOOR_RATIO } from "@/lib/depreciation";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtMoney, fmtNum } from "@/lib/format";

const FUEL_SETUPS = ["PETROL", "CNG", "DUAL"];
const OWNERSHIPS = ["OWNED", "INSTALLMENT", "RENTED", "TARGET"];

export default function CarsPage() {
  const { t, locale } = useI18n();
  const { rows: vehicles, loading, create, update, remove, refresh } = useCrud<any>("vehicles");
  const { vehicle: defaultVehicle, setDefaultVehicle, refreshVehicles } = useVehicle();
  const [editing, setEditing] = useState<any>(null); // vehicle row being edited, or {} for new
  const [overview, setOverview] = useState<{ summaries: any[]; insights: any[] } | null>(null);

  const loadOverview = () => fetch("/api/cars-overview").then((r) => (r.ok ? r.json() : null)).then(setOverview);
  useEffect(() => {
    loadOverview();
  }, [vehicles.length]);

  const money = (n: number) => fmtMoney(n, locale);
  const summaryFor = (id: string) => overview?.summaries.find((s: any) => s.vehicle.id === id);

  const afterSave = async () => {
    setEditing(null);
    await Promise.all([refresh(), refreshVehicles()]);
    loadOverview();
  };

  if (loading) return null;

  return (
    <div>
      <PageTitle
        actions={
          <Btn onClick={() => setEditing({})}>+ {t("cars.add")}</Btn>
        }
      >
        {t("cars.title")}
      </PageTitle>

      {overview && overview.insights.length > 0 && (
        <Card className="mb-4 border-line">
          <div className="text-sm font-semibold mb-2">💡 {t("cars.insights")}</div>
          <div className="space-y-1.5">
            {overview.insights.map((ins: any, i: number) => (
              <div key={i} className="text-sm text-ink-700">
                {insightMessage(t, ins)}
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <CarForm
          vehicle={editing.id ? editing : null}
          onCancel={() => setEditing(null)}
          onSaved={afterSave}
          create={create}
          update={update}
        />
      )}

      {vehicles.length === 0 ? (
        <Empty>{t("veh.createFirst")}</Empty>
      ) : (
        <Card>
          <Table
            head={[
              t("veh.name"),
              t("veh.ownership"),
              t("cars.initialOdo"),
              t("cars.currentOdo"),
              t("cars.kmDriven"),
              t("cars.currentValue"),
              t("cars.depSoFar"),
              t("cars.allTimeProfit"),
              t("cars.health"),
              t("cars.default"),
              t("c.actions"),
            ]}
          >
            {vehicles.map((v: any) => {
              const s = summaryFor(v.id);
              const isDefault = defaultVehicle?.id === v.id;
              return (
                <tr key={v.id} className={!v.isActive ? "opacity-50" : ""}>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div className="font-semibold">{v.name}</div>
                    {v.plate && <div className="text-xs text-muted">{v.plate}</div>}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">{t(`veh.own.${v.ownership}`)}</td>
                  <td className="py-2 px-2">{fmtNum(v.initialOdometer, locale)} {t("c.km")}</td>
                  <td className="py-2 px-2">{s ? `${fmtNum(s.currentOdo, locale)} ${t("c.km")}` : "—"}</td>
                  <td className="py-2 px-2 font-semibold">{s ? `${fmtNum(s.kmSinceRecord, locale)} ${t("c.km")}` : "—"}</td>
                  <td className="py-2 px-2">{s?.currentValue != null ? money(s.currentValue) : "—"}</td>
                  <td className="py-2 px-2 text-warn-ink">
                    {s?.depreciationSoFar != null ? money(s.depreciationSoFar) : "—"}
                  </td>
                  <td className="py-2 px-2 font-semibold" style={{ color: s && s.trueProfit >= 0 ? "var(--money)" : "var(--loss)" }}>
                    {s ? money(s.trueProfit) : "—"}
                  </td>
                  <td className="py-2 px-2">
                    {s?.healthScore != null ? (
                      <span
                        className="text-xs font-bold rounded-full px-2 py-0.5"
                        style={{
                          color: s.healthScore >= 70 ? "var(--money)" : s.healthScore >= 40 ? "var(--warn-ink)" : "var(--loss)",
                          background: s.healthScore >= 70 ? "var(--money-soft)" : s.healthScore >= 40 ? "var(--warn-soft)" : "var(--loss-soft)",
                        }}
                        title={t("cars.healthHint")}
                      >
                        {s.healthScore}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {isDefault ? (
                      <span className="text-xs font-semibold text-ink bg-surface-2 border border-line rounded-full px-2 py-0.5">
                        ✓ {t("cars.default")}
                      </span>
                    ) : v.isActive ? (
                      <button
                        onClick={() => setDefaultVehicle(v.id)}
                        className="text-xs text-ink underline"
                      >
                        {t("cars.setDefault")}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">{t("cars.archived")}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <button onClick={() => setEditing(v)} className="text-xs text-muted me-2">
                      {t("c.edit")}
                    </button>
                    {v.isActive ? (
                      <button
                        onClick={() => confirm(t("cars.confirmArchive")) && update(v.id, { isActive: false }).then(afterSave)}
                        className="text-xs text-warn-ink me-2"
                      >
                        {t("cars.archive")}
                      </button>
                    ) : (
                      <button
                        onClick={() => update(v.id, { isActive: true }).then(afterSave)}
                        className="text-xs text-ink me-2"
                      >
                        {t("cars.reactivate")}
                      </button>
                    )}
                    {s && !s.hasRecords && (
                      <button
                        onClick={() => confirm(t("c.confirmDelete")) && remove(v.id).then(afterSave)}
                        className="text-xs text-loss"
                      >
                        {t("c.delete")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </div>
  );
}

function insightMessage(t: (k: string, vars?: Record<string, string | number>) => string, ins: any) {
  const vars = { car: ins.vehicleName, ...(ins.vars ?? {}) };
  return t(`cars.insight.${ins.kind}`, vars);
}

function CarForm({
  vehicle,
  onCancel,
  onSaved,
  create,
  update,
}: {
  vehicle: any | null;
  onCancel: () => void;
  onSaved: () => void;
  create: (d: Record<string, unknown>) => Promise<boolean>;
  update: (id: string, d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<any>(
    vehicle ?? {
      name: "",
      make: "",
      model: "",
      carModelId: "",
      year: "",
      plate: "",
      fuelSetup: "DUAL",
      ownership: "OWNED",
      initialOdometer: "",
      depreciationEnabled: true,
      depreciationMethod: "MILEAGE",
      notes: "",
    }
  );
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  const [carModels, setCarModels] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/carmodels")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCarModels);
  }, []);

  // "OTHER" = not in the catalog, fall back to free-text make/model;
  // an existing vehicle with no carModelId (created before the catalog
  // existed, or a genuine one-off) also starts on the free-text path
  const [customMake, setCustomMake] = useState(!form.carModelId);
  const carModelSelectValue = customMake ? "OTHER" : form.carModelId || "";

  const onPickCarModel = (value: string) => {
    if (value === "OTHER") {
      setCustomMake(true);
      set("carModelId", "");
      return;
    }
    setCustomMake(false);
    const picked = carModels.find((m) => m.id === value);
    setForm({ ...form, carModelId: value, make: picked?.make ?? form.make, model: picked?.model ?? form.model });
  };

  const [preview, setPreview] = useState<any>(null);
  useEffect(() => {
    if (!form.carModelId) {
      setPreview(null);
      return;
    }
    const qs = new URLSearchParams({ carModelId: form.carModelId });
    if (form.id) qs.set("excludeVehicleId", form.id);
    fetch(`/api/car-benchmark?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPreview);
  }, [form.carModelId, form.id]);

  const makesGrouped = useMemo(() => {
    const byMake: Record<string, any[]> = {};
    for (const m of carModels) {
      byMake[m.make] ??= [];
      byMake[m.make].push(m);
    }
    return Object.entries(byMake).sort(([a], [b]) => a.localeCompare(b));
  }, [carModels]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, carModelId: customMake ? null : form.carModelId || null };
    const ok = form.id ? await update(form.id, payload) : await create({ ...payload, isActive: true });
    if (ok) onSaved();
  };

  return (
    <Card className="mb-4 border-line">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">{form.id ? t("cars.editCar") : t("cars.add")}</span>
        <button onClick={onCancel} className="text-muted hover:text-ink-500">
          ✕
        </button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("veh.name")}>
          <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label={t("veh.plate")}>
          <Input value={form.plate ?? ""} onChange={(e) => set("plate", e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label={t("veh.carModel")} hint={t("veh.carModelHint")}>
            <Select value={carModelSelectValue} onChange={(e) => onPickCarModel(e.target.value)}>
              <option value="" disabled>
                {t("veh.carModelPlaceholder")}
              </option>
              {makesGrouped.map(([make, models]) => (
                <optgroup key={make} label={make}>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="OTHER">{t("veh.carModelOther")}</option>
            </Select>
          </Field>
        </div>
        {preview && preview.carModel && (
          <div className="md:col-span-2 -mt-2 text-xs bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink">
            {preview.others.fuelPer100 != null
              ? t("veh.carModelPreview", {
                  car: `${preview.carModel.make} ${preview.carModel.model}`,
                  n: fmtNum(preview.others.fuelPer100, locale),
                  unit: preview.others.fuelUnit === "m3" ? t("c.m3") : t("c.liters"),
                  count: preview.others.driverCount,
                })
              : t("veh.carModelPreviewNoData", { car: `${preview.carModel.make} ${preview.carModel.model}` })}
          </div>
        )}
        {customMake && (
          <>
            <Field label={t("veh.make")}>
              <Input value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} />
            </Field>
            <Field label={t("veh.model")}>
              <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
            </Field>
          </>
        )}
        <Field label={t("veh.year")}>
          <Input type="number" value={form.year ?? ""} onChange={(e) => set("year", e.target.value)} />
        </Field>
        <Field label={t("veh.initialOdometer")}>
          <Input
            type="number"
            step="1"
            value={form.initialOdometer ?? ""}
            onChange={(e) => set("initialOdometer", e.target.value)}
            required
          />
        </Field>
        <Field label={t("veh.fuelSetup")}>
          <Select value={form.fuelSetup} onChange={(e) => set("fuelSetup", e.target.value)}>
            {FUEL_SETUPS.map((f) => (
              <option key={f} value={f}>
                {t(`veh.fuel.${f}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("veh.ownership")}>
          <Select value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
            {OWNERSHIPS.map((o) => (
              <option key={o} value={o}>
                {t(`veh.own.${o}`)}
              </option>
            ))}
          </Select>
        </Field>
        {(form.ownership === "OWNED" || form.ownership === "INSTALLMENT") && (
          <>
            <Field label={t("veh.purchasePrice")}>
              <Input type="number" inputMode="decimal" value={form.purchasePrice ?? ""} onChange={(e) => set("purchasePrice", e.target.value)} />
            </Field>
            <Field label={t("veh.estimatedValue")} hint={t("veh.estimatedValueHint")}>
              <Input type="number" inputMode="decimal" value={form.estimatedValue ?? ""} onChange={(e) => set("estimatedValue", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <DepreciationSection form={form} set={set} />
            </div>
          </>
        )}
        {form.ownership === "INSTALLMENT" && (
          <Field label={t("veh.monthlyInstallment")}>
            <Input
              type="number"
              value={form.monthlyInstallment ?? ""}
              onChange={(e) => set("monthlyInstallment", e.target.value)}
            />
          </Field>
        )}
        {form.ownership === "RENTED" && (
          <Field label={t("veh.dailyRentalFee")}>
            <Input
              type="number"
              value={form.dailyRentalFee ?? ""}
              onChange={(e) => set("dailyRentalFee", e.target.value)}
            />
          </Field>
        )}
        {form.ownership === "TARGET" && (
          <Field label={t("veh.targetOwnerShare")}>
            <Input
              type="number"
              step="0.1"
              value={form.targetOwnerShare ?? ""}
              onChange={(e) => set("targetOwnerShare", e.target.value)}
            />
          </Field>
        )}
        <div className="md:col-span-2">
          <Field label={t("c.notes")}>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <Btn type="submit">{t("c.save")}</Btn>
          <Btn variant="secondary" onClick={onCancel}>
            {t("c.cancel")}
          </Btn>
        </div>
      </form>
    </Card>
  );
}

/**
 * The depreciation block of the car form: the master switch, the method, and
 * a live preview of what each method would charge per km for THIS car, so the
 * driver picks with the numbers in front of them rather than on faith.
 */
function DepreciationSection({ form, set }: { form: any; set: (k: string, v: unknown) => void }) {
  const { t, locale } = useI18n();
  const enabled = form.depreciationEnabled !== false;
  const method: string = form.depreciationMethod ?? (form.depreciationPerKm != null && form.depreciationPerKm !== "" ? "MANUAL" : "MILEAGE");
  const money = (n: number) => fmtMoney(n, locale);

  // mirror lib/depreciation.ts on the client for the preview
  const purchase = Number(form.purchasePrice) > 0 ? Number(form.purchasePrice) : null;
  const estimated = Number(form.estimatedValue) > 0 ? Number(form.estimatedValue) : null;
  const year = Number(form.year) > 0 ? Number(form.year) : null;
  const age = year != null ? Math.max(0, new Date().getFullYear() - year) : 0;
  const currentValue = estimated ?? (purchase != null ? Math.max(purchase * Math.pow(1 - ANNUAL_DEPRECIATION_RATE, age), purchase * VALUE_FLOOR_RATIO) : null);
  const sens = Number(form.mileageSensitivityPct) > 0 ? Number(form.mileageSensitivityPct) : DEFAULT_MILEAGE_SENSITIVITY_PCT;
  const lifetime = Number(form.lifetimeKm) > 0 ? Number(form.lifetimeKm) : DEFAULT_LIFETIME_KM;
  const remaining = Math.max(lifetime - (Number(form.initialOdometer) || 0), 30_000);
  const mileagePerKm = currentValue != null ? (currentValue * (sens / 100)) / 10_000 : null;
  const lifetimeBasis = purchase ?? currentValue;
  const lifetimePerKm = lifetimeBasis != null ? (lifetimeBasis * (1 - RESIDUAL_RATIO)) / remaining : null;
  const manualPerKm = Number(form.depreciationPerKm) > 0 ? Number(form.depreciationPerKm) : null;
  const activePerKm = method === "MANUAL" ? manualPerKm : method === "LIFETIME" ? lifetimePerKm : mileagePerKm;

  return (
    <div className="rounded-2xl bg-surface p-4 space-y-4">
      <Toggle checked={enabled} onChange={(v) => set("depreciationEnabled", v)} label={t("dep.toggle")} sub={enabled ? t("dep.toggleOnSub") : t("dep.toggleOffSub")} />
      <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
        <div className="text-xs font-bold text-ink-500 mb-1.5">{t("dep.method")}</div>
        <Segmented
          fill
          value={method as "MILEAGE" | "LIFETIME" | "MANUAL"}
          onChange={(v) => set("depreciationMethod", v)}
          options={[
            { value: "MILEAGE", label: t("dep.m.MILEAGE") },
            { value: "LIFETIME", label: t("dep.m.LIFETIME") },
            { value: "MANUAL", label: t("dep.m.MANUAL") },
          ]}
        />
        <p className="text-xs text-muted mt-2 leading-relaxed">{t(`dep.desc.${method}`)}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {method === "MILEAGE" && (
            <Field label={t("dep.sensitivity")} hint={t("dep.sensitivityHint", { v: DEFAULT_MILEAGE_SENSITIVITY_PCT })}>
              <Input type="number" inputMode="decimal" step="0.1" min="0.1" max="10" value={form.mileageSensitivityPct ?? ""} onChange={(e) => set("mileageSensitivityPct", e.target.value)} placeholder={String(DEFAULT_MILEAGE_SENSITIVITY_PCT)} />
            </Field>
          )}
          {method === "LIFETIME" && (
            <Field label={t("veh.lifetimeKm")} hint={t("veh.lifetimeKmHint")}>
              <Input type="number" inputMode="numeric" step="1000" value={form.lifetimeKm ?? ""} onChange={(e) => set("lifetimeKm", e.target.value)} placeholder={String(DEFAULT_LIFETIME_KM)} />
            </Field>
          )}
          {method === "MANUAL" && (
            <Field label={t("veh.depreciationPerKm")} hint={t("dep.manualHint")}>
              <Input type="number" inputMode="decimal" step="0.01" value={form.depreciationPerKm ?? ""} onChange={(e) => set("depreciationPerKm", e.target.value)} />
            </Field>
          )}
          <div className="rounded-xl bg-paper p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{t("dep.preview")}</div>
            <div className="text-2xl font-bold display mt-0.5">{activePerKm != null ? `${money(activePerKm)} / ${t("c.km")}` : "—"}</div>
            <div className="text-xs text-muted mt-1 leading-relaxed">
              {currentValue != null ? t("dep.previewValue", { v: money(currentValue) }) : t("dep.previewNeedValue")}
              {activePerKm != null && <> · {t("dep.previewWeek", { v: money(activePerKm * 500) })}</>}
            </div>
            <div className="text-[11px] text-muted mt-2 space-y-0.5 tnum">
              <div>{t("dep.m.MILEAGE")}: {mileagePerKm != null ? money(mileagePerKm) : "—"}</div>
              <div>{t("dep.m.LIFETIME")}: {lifetimePerKm != null ? money(lifetimePerKm) : "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
