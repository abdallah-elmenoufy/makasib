"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";
import { useCrud } from "@/components/useCrud";

const FUEL_SETUPS = ["PETROL", "CNG", "DUAL"];
const OWNERSHIPS = ["OWNED", "INSTALLMENT", "RENTED", "TARGET"];

export default function VehiclePage() {
  const { t } = useI18n();
  const { rows, loading, create, update } = useCrud<any>("vehicles");
  const vehicle = rows.find((v: any) => v.isActive) ?? rows[0];
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) {
      setForm(
        vehicle ?? {
          name: "",
          make: "",
          model: "",
          year: "",
          plate: "",
          fuelSetup: "DUAL",
          ownership: "OWNED",
          initialOdometer: "",
          notes: "",
        }
      );
    }
  }, [loading, vehicle]);

  if (!form) return null;
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = vehicle ? await update(vehicle.id, form) : await create({ ...form, isActive: true });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div>
      <PageTitle>{t("veh.title")}</PageTitle>
      {!vehicle && <p className="text-sm text-slate-500 mb-4">{t("veh.createFirst")}</p>}
      <Card>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("veh.name")}>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label={t("veh.plate")}>
            <Input value={form.plate ?? ""} onChange={(e) => set("plate", e.target.value)} />
          </Field>
          <Field label={t("veh.make")}>
            <Input value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} />
          </Field>
          <Field label={t("veh.model")}>
            <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
          </Field>
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
                <Input
                  type="number"
                  value={form.purchasePrice ?? ""}
                  onChange={(e) => set("purchasePrice", e.target.value)}
                />
              </Field>
              <Field label={t("veh.estimatedValue")}>
                <Input
                  type="number"
                  value={form.estimatedValue ?? ""}
                  onChange={(e) => set("estimatedValue", e.target.value)}
                />
              </Field>
              <Field label={t("veh.depreciationPerKm")}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.depreciationPerKm ?? ""}
                  onChange={(e) => set("depreciationPerKm", e.target.value)}
                />
              </Field>
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
            {saved && <span className="text-emerald-600 text-sm">✓ {t("c.saved")}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
