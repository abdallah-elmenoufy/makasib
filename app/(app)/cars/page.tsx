"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Btn, Card, Empty, Field, IconChip, Input, PageTitle, Segmented, Select, StatCell, StatGrid, Textarea, Toggle } from "@/components/ui";
import { CarRender, carTitle } from "@/components/CarRender";
import { useViewMode } from "@/components/ViewMode";
import { PAINTS } from "@/lib/carRender";
import { DEFAULT_MILEAGE_SENSITIVITY_PCT, DEFAULT_LIFETIME_KM, RESIDUAL_RATIO, ANNUAL_DEPRECIATION_RATE, VALUE_FLOOR_RATIO } from "@/lib/depreciation";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtDate, fmtMoney, fmtMoneyShort, fmtNum, sep } from "@/lib/format";

const FUEL_SETUPS = ["PETROL", "CNG", "DUAL"];
const OWNERSHIPS = ["OWNED", "INSTALLMENT", "RENTED", "TARGET"];

export default function CarsPage() {
  const { t, locale } = useI18n();
  const { rows: vehicles, loading, create, update, remove, refresh } = useCrud<any>("vehicles");
  const { vehicle: defaultVehicle, setDefaultVehicle, refreshVehicles } = useVehicle();
  const [editing, setEditing] = useState<any>(null); // vehicle row being edited, or {} for new
  const [overview, setOverview] = useState<{ summaries: any[]; insights: any[] } | null>(null);
  const { mode } = useViewMode();

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
        <Card className="mb-4">
          <div className="flex items-center gap-2 text-[15px] font-bold mb-2">
            <IconChip icon="sparkle" size="sm" /> {t("cars.insights")}
          </div>
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
        <div className="space-y-3">
          {vehicles.map((v: any) => {
            const s = summaryFor(v.id);
            const isDefault = defaultVehicle?.id === v.id;
            return (
              <Card key={v.id} className={`!p-0 overflow-hidden @container ${!v.isActive ? "opacity-60" : ""}`}>
                {/* one wide row per car: picture · identity · figures · actions.
                    Breakpoints follow the card's own width, not the screen's,
                    so the desktop sidebar can't squeeze it into two columns. */}
                <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-x-6 gap-y-3 p-4 @2xl:p-5 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <CarRender make={v.make} model={v.model} color={v.color} className="w-[42%] max-w-[210px] -ms-2 shrink-0" title={carTitle(v, locale)} />
                    <div className="min-w-0 flex-1">
                      {v.plate && <div dir="rtl" className="text-[24px] leading-tight font-bold tnum tracking-wide text-start">{v.plate}</div>}
                      <div className={`${v.plate ? "text-sm text-ink-500" : "text-[20px] font-bold"} leading-snug truncate`}>{v.plate ? carTitle(v, locale) : v.name}</div>
                      {v.plate && <div className="text-[15px] font-bold truncate">{v.name}</div>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {v.transmission && <Badge tone="neutral">{t(`veh.trans.${v.transmission}`)}</Badge>}
                        {v.year && <Badge tone="neutral">{v.year}</Badge>}
                        {isDefault && <Badge tone="good">✓ {t("cars.default")}</Badge>}
                        {!v.isActive && <Badge tone="warn">{t("cars.archived")}</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 border-t @2xl:border-t-0 @2xl:border-s border-line pt-3 @2xl:pt-0 @2xl:ps-6">
                    {/* the headline: distance since the car joined Makasib */}
                    <div className="flex items-end justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-ink-500">{t("cars.drivenSinceAdded")}</div>
                        <div className="text-[30px] font-bold display leading-none mt-1.5 tnum">
                          {s ? fmtNum(s.kmSinceRecord, locale, 0) : "—"} <span className="text-base font-bold text-muted">{t("c.km")}</span>
                        </div>
                        <div className="text-xs text-muted mt-1.5 tnum">
                          {t("cars.drivenSinceSub", { date: fmtDate(s?.trackedSince ?? v.createdAt, locale), from: fmtNum(v.initialOdometer, locale, 0), now: s ? fmtNum(s.currentOdo, locale, 0) : "—" })}
                        </div>
                      </div>
                      <div className="@md:text-end">
                        <div className="text-[13px] font-bold text-ink-500">{t("cars.allTimeProfit")}</div>
                        <div className={`text-[24px] font-bold display leading-none mt-1.5 ${s && s.trueProfit < 0 ? "text-loss" : "text-money"}`}>{s ? money(s.trueProfit) : "—"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                      <StatCell label={t("cars.health")} value={s?.healthScore != null ? fmtNum(s.healthScore, locale, 0) : "—"} tone={s?.healthScore == null ? "default" : s.healthScore >= 70 ? "good" : s.healthScore >= 40 ? "warn" : "bad"} title={t("cars.healthHint")} />
                      <StatCell label={t("veh.ownership")} value={t(`veh.own.${v.ownership}`)} />
                      {mode === "detailed" && (
                        <>
                          <StatCell label={t("cars.currentValue")} value={s?.currentValue != null ? fmtMoneyShort(s.currentValue, locale) : "—"} />
                          <StatCell label={t("cars.depSoFar")} value={s?.depreciationSoFar != null ? fmtMoneyShort(s.depreciationSoFar, locale) : "—"} tone="warn" />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex @4xl:flex-col items-center @4xl:items-stretch gap-2 flex-wrap @2xl:col-span-2 @4xl:col-span-1">
                    <Btn variant="secondary" size="sm" onClick={() => setEditing(v)}>
                      {t("c.edit")}
                    </Btn>
                    {!isDefault && v.isActive && (
                      <Btn variant="secondary" size="sm" onClick={() => setDefaultVehicle(v.id)}>
                        {t("cars.setDefault")}
                      </Btn>
                    )}
                    <span className="ms-auto @4xl:ms-0 flex items-center justify-center gap-3">
                      {v.isActive ? (
                        <button onClick={() => confirm(t("cars.confirmArchive")) && update(v.id, { isActive: false }).then(afterSave)} className="text-xs font-bold text-warn-ink">
                          {t("cars.archive")}
                        </button>
                      ) : (
                        <button onClick={() => update(v.id, { isActive: true }).then(afterSave)} className="text-xs font-bold text-ink">
                          {t("cars.reactivate")}
                        </button>
                      )}
                      {s && !s.hasRecords && (
                        <button onClick={() => confirm(t("c.confirmDelete")) && remove(v.id).then(afterSave)} className="text-xs font-bold text-loss">
                          {t("c.delete")}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
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
    if (form.transmission) qs.set("transmission", form.transmission);
    fetch(`/api/car-benchmark?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPreview);
  }, [form.carModelId, form.id, form.transmission]);

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

  const pickedModel = carModels.find((m) => m.id === form.carModelId);
  return (
    <Card className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-lg">{form.id ? t("cars.editCar") : t("cars.add")}</span>
        <button onClick={onCancel} className="w-10 h-10 rounded-full hover:bg-surface-2 text-muted hover:text-ink" aria-label={t("c.cancel")}>
          ✕
        </button>
      </div>
      {/* live preview: the car as riders will picture it */}
      <div className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2 mb-4">
        <CarRender make={form.make} model={form.model} category={pickedModel?.category} color={form.color} className="w-[52%] max-w-[260px] shrink-0" />
        <div className="min-w-0 flex-1 text-end">
          {form.plate && <div dir="rtl" className="text-xl font-bold tnum">{form.plate}</div>}
          <div className="text-sm font-bold truncate">{carTitle(form, locale) || t("veh.carModelPlaceholder")}</div>
          {form.transmission && <div className="text-xs text-muted mt-0.5">{t(`veh.trans.${form.transmission}`)}</div>}
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
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
                      {m.make} {m.model}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="OTHER">{t("veh.carModelOther")}</option>
            </Select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("veh.transmission")}</span>
          <Segmented
            fill
            value={(form.transmission ?? "") as string}
            onChange={(v) => set("transmission", v)}
            options={[
              { value: "AUTOMATIC", label: t("veh.trans.AUTOMATIC") },
              { value: "MANUAL", label: t("veh.trans.MANUAL") },
              { value: "CVT", label: t("veh.trans.CVT") },
            ]}
          />
          <span className="block text-xs text-muted mt-1.5">{t("veh.transmissionHint")}</span>
        </div>
        {preview && preview.carModel && (
          <div className="md:col-span-2 -mt-2 text-xs bg-action-soft rounded-xl px-3 py-2 text-ink">
            {preview.others.fuelPer100 != null
              ? t("veh.carModelPreview", {
                  car: `${preview.carModel.make} ${preview.carModel.model}${preview.gearboxMatched ? ` (${t(`veh.trans.${preview.gearbox}`)})` : ""}`,
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
        <div className="md:col-span-2">
          <span className="block text-xs font-bold text-ink-500 mb-2">{t("veh.color")}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("veh.color")}>
            {Object.entries(PAINTS).map(([key, p]) => {
              const on = (form.color ?? "").toUpperCase() === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={locale === "ar" ? p.ar : p.en}
                  onClick={() => set("color", key)}
                  className={`w-9 h-9 rounded-full border transition-transform ${on ? "ring-2 ring-action ring-offset-2 ring-offset-[var(--sheet)] scale-110" : "border-line-strong hover:scale-105"}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, #ffffff99, transparent 45%), ${p.hex}` }}
                />
              );
            })}
          </div>
          <span className="block text-xs text-muted mt-1.5">{form.color ? (PAINTS[(form.color ?? "").toUpperCase()] ? (locale === "ar" ? PAINTS[form.color.toUpperCase()].ar : PAINTS[form.color.toUpperCase()].en) : form.color) : t("veh.colorHint")}</span>
        </div>
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
              {activePerKm != null && <>{sep(locale)}{t("dep.previewWeek", { v: money(activePerKm * 500) })}</>}
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
