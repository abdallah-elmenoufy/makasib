"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Badge, Btn, Card, Input } from "./ui";

/**
 * One-field trip logging for the end of a shift.
 *
 * The full trip form asks for a dozen things. At 2am, parked, last tea going
 * cold, the driver knows exactly one number for sure: what the app paid them.
 * Everything else here is either defaulted (now, current car, the platform
 * they last used) or filled in later from the screenshot import — which
 * merges into this same trip rather than duplicating it, because
 * lib/importApply.ts matches on net amount within a ±5 min window.
 *
 * The mic is the same idea taken further: speak the number, don't type it.
 * Web Speech API is Chrome/Safari-only, so the button simply isn't rendered
 * where it won't work rather than failing on tap.
 */
export function QuickAddTrip({
  vehicleId,
  defaultPlatform = "UBER",
  onAdded,
}: {
  vehicleId: string;
  defaultPlatform?: string;
  onAdded: () => void;
}) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<"CASH" | "CARD">("CASH");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceOk(!!SR);
  }, []);

  const listen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.lang = locale === "ar" ? "ar-EG" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const said: string = e.results[0][0].transcript ?? "";
      // pull the first number out of whatever was said — "sixty five fifty",
      // "65.50", "٦٥" all reduce to a figure we can put in the box
      const normalised = said.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      const m = normalised.match(/\d+(?:[.,]\d+)?/);
      if (m) setAmount(m[0].replace(",", "."));
      else setFlash(t("qa.voiceNoNumber"));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const net = Number(amount);
    if (!Number.isFinite(net) || net <= 0) return;
    setSaving(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        platform: defaultPlatform,
        startTime: new Date().toISOString(),
        // net-first, exactly like the full form: fare carries the driver's
        // earnings and commission stays 0 unless cash reconciliation says so
        fare: net,
        commission: 0,
        paymentType: payment,
        tip: 0,
        source: "MANUAL",
      }),
    });
    setSaving(false);
    if (res.ok) {
      setAmount("");
      setFlash(t("qa.added"));
      setTimeout(() => setFlash(""), 2500);
      onAdded();
    } else {
      setFlash(t("c.error"));
    }
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
      <form onSubmit={save} className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[9rem]">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("qa.label")}</span>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-bold"
            />
            {voiceOk && (
              <button
                type="button"
                onClick={listen}
                title={t("qa.speak")}
                className={`shrink-0 w-12 rounded-xl border transition-colors ${
                  listening
                    ? "bg-red-500 border-red-500 text-white animate-pulse"
                    : "bg-white border-[var(--border)] hover:bg-slate-50"
                }`}
              >
                🎙
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-white border border-[var(--border)] rounded-xl p-1">
          {(["CASH", "CARD"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPayment(p)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                payment === p ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t(`tr.${p}`)}
            </button>
          ))}
        </div>

        <Btn type="submit" disabled={saving || !amount}>
          + {t("qa.add")}
        </Btn>
        {flash && <Badge tone="good">{flash}</Badge>}
      </form>
      <p className="text-xs text-slate-400 mt-2">{t("qa.hint")}</p>
    </Card>
  );
}
