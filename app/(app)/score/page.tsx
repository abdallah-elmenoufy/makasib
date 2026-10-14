"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Checkbox, Empty, Field, Input, PageTitle } from "@/components/ui";
import { useVehicle } from "@/components/VehicleProvider";
import { useTrackedTask } from "@/components/ActivityIndicator";
import { looksLikeTripRequest, parseTripRequestText } from "@/lib/tripRequest";
import { scoreOffer, OfferBaseline } from "@/lib/offerScore";
import { fmtMoney, fmtNum, sep } from "@/lib/format";

type OfferForm = {
  fare: string;
  pickupKm: string;
  pickupMin: string;
  tripKm: string;
  tripMin: string;
  isCash: boolean;
};
const emptyForm = (): OfferForm => ({
  fare: "",
  pickupKm: "",
  pickupMin: "",
  tripKm: "",
  tripMin: "",
  isCash: true,
});

const VERDICT_BG: Record<string, string> = {
  good: "bg-action",
  ok: "bg-warn-soft0",
  bad: "bg-loss",
  unknown: "bg-muted-2",
};
const VERDICT_ICON: Record<string, string> = { good: "🟢", ok: "🟡", bad: "🔴", unknown: "⚪️" };

export default function ScorePage() {
  const { t, locale } = useI18n();
  const { vehicle, loading } = useVehicle();
  const track = useTrackedTask();
  const [baseline, setBaseline] = useState<OfferBaseline | null>(null);
  const [form, setForm] = useState<OfferForm | null>(null);
  const [reading, setReading] = useState(false);
  const [notRecognized, setNotRecognized] = useState(false);

  // pre-warm the OCR engine the instant this page opens so the first real
  // read — under the platform's accept countdown — isn't paying cold-start
  useEffect(() => {
    import("@/lib/ocr").then((m) => m.warmupOcr());
  }, []);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/analytics?vehicleId=${vehicle.id}&period=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!a) return;
        setBaseline({
          costPerKm: a.rates.fuelCostPerKm + a.rates.maintCostPerKm + a.rates.depPerKm,
          profitPerKm: a.perKm,
          profitPerHour: a.perHour,
        });
      });
  }, [vehicle]);

  const onFile = async (file: File) => {
    setReading(true);
    setNotRecognized(false);
    try {
      const { ocrScreenshot } = await import("@/lib/ocr");
      let text = await track(t("act.reading"), () => ocrScreenshot(file));
      let r = looksLikeTripRequest(text) ? parseTripRequestText(text) : null;
      // dark request cards over a lighter map can fool auto-invert detection
      // — retry once, forcing inversion, before telling the driver it failed
      if (!r) {
        text = await track(t("act.reading"), () => ocrScreenshot(file, true));
        r = looksLikeTripRequest(text) ? parseTripRequestText(text) : null;
      }
      if (!r) {
        setNotRecognized(true);
        setForm(emptyForm());
        return;
      }
      setForm({
        fare: String(r.fare),
        pickupKm: String(r.pickupKm),
        pickupMin: String(r.pickupMin),
        tripKm: r.tripKm != null ? String(r.tripKm) : "",
        tripMin: r.tripMin != null ? String(r.tripMin) : "",
        isCash: r.isCash,
      });
    } finally {
      setReading(false);
    }
  };

  const score = useMemo(() => {
    if (!form || !baseline) return null;
    const fare = Number(form.fare);
    const pickupKm = Number(form.pickupKm);
    const pickupMin = Number(form.pickupMin);
    const tripKm = Number(form.tripKm);
    const tripMin = Number(form.tripMin);
    if (![fare, pickupKm, pickupMin, tripKm, tripMin].every((n) => Number.isFinite(n) && n >= 0)) return null;
    return scoreOffer({ fare, pickupKm, pickupMin, tripKm, tripMin }, baseline);
  }, [form, baseline]);

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-action underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  const set = (k: keyof OfferForm, v: string | boolean) =>
    setForm((f) => ({ ...(f ?? emptyForm()), [k]: v }));
  const reset = () => {
    setForm(null);
    setNotRecognized(false);
  };

  return (
    <div className="space-y-4">
      <PageTitle sub={t("score.subtitle")}>{t("score.title")}</PageTitle>
      <p className="text-xs text-warn-ink bg-warn-soft border border-warn/60 rounded-lg px-3 py-2">
        ⏱ {t("score.hurryNote")}
      </p>

      {!form && (
        <label
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            reading ? "border-line text-muted-2" : "border-line text-muted hover:bg-surface-2"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            disabled={reading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="hidden"
          />
          <div className="text-3xl mb-1">⚡</div>
          <div className="text-sm font-semibold">{reading ? t("score.reading") : t("score.drop")}</div>
        </label>
      )}

      {notRecognized && (
        <p className="text-xs text-warn-ink bg-warn-soft border border-warn/60 rounded-lg px-3 py-2">
          {t("score.notRecognized")}
        </p>
      )}

      {form && (
        <>
          {score && (
            <Card className={`${VERDICT_BG[score.verdict]} text-hero-fg border-none`}>
              <div className="text-center">
                <div className="text-2xl font-black">
                  {VERDICT_ICON[score.verdict]} {t(`score.verdict.${score.verdict}`)}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-xs opacity-80">{t("score.profitPerKm")}</div>
                    <div className="text-xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(score.profitPerKm, locale)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80">{t("score.profitPerHour")}</div>
                    <div className="text-xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(score.profitPerHour, locale)}
                    </div>
                  </div>
                </div>
                {score.ratioHour != null && baseline?.profitPerHour != null && (
                  <div className="text-xs opacity-80 mt-2">
                    {t("score.vsAverage", { n: fmtMoney(baseline.profitPerHour, locale) })}{sep(locale)}
                    {fmtNum(score.ratioHour * 100, locale, 0)}%
                  </div>
                )}
              </div>
            </Card>
          )}
          {!baseline && <p className="text-xs text-muted">{t("score.noBaseline")}</p>}

          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("tr.fare")}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.fare}
                  onChange={(e) => set("fare", e.target.value)}
                  autoFocus
                />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox label={t("tr.CASH")} checked={form.isCash} onChange={(v) => set("isCash", v)} />
              </div>
              <Field label={t("score.pickupKm")}>
                <Input type="number" step="0.1" value={form.pickupKm} onChange={(e) => set("pickupKm", e.target.value)} />
              </Field>
              <Field label={t("score.pickupMin")}>
                <Input type="number" step="1" value={form.pickupMin} onChange={(e) => set("pickupMin", e.target.value)} />
              </Field>
              <Field label={t("score.tripKm")}>
                <Input type="number" step="0.1" value={form.tripKm} onChange={(e) => set("tripKm", e.target.value)} />
              </Field>
              <Field label={t("score.tripMin")}>
                <Input type="number" step="1" value={form.tripMin} onChange={(e) => set("tripMin", e.target.value)} />
              </Field>
            </div>
            <Btn variant="secondary" onClick={reset}>
              {t("score.scoreAnother")}
            </Btn>
          </Card>
        </>
      )}
    </div>
  );
}
