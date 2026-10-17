"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Badge, Btn, Card, Segmented } from "./ui";
import { Icon } from "./icons";

/**
 * One-field trip logging while the shift is still running.
 *
 * At the kerb, the driver knows exactly one number for sure: what the app
 * just paid. That is the only required field. "Details" unfolds the rest —
 * tip, trip km, km to the rider, minutes — for anyone who wants them now;
 * otherwise they merge in later from the screenshot import (±5 min, same
 * amount — lib/importApply.ts never duplicates).
 *
 * Because this is logged where the rider just got out, the phone's position
 * is captured as the drop-off (when location is allowed), and the pickup is
 * read back from the shift's GPS track by time (lib/tripLocation.ts).
 */
export function QuickAddTrip({
  vehicleId,
  defaultPlatform = "UBER",
  onAdded,
  bare = false,
}: {
  vehicleId: string;
  defaultPlatform?: string;
  onAdded: () => void;
  /** Without the card frame — inside the drive sheet. */
  bare?: boolean;
}) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<"CASH" | "CARD">("CASH");
  const [more, setMore] = useState(false);
  const [tip, setTip] = useState("");
  const [km, setKm] = useState("");
  const [pickupKm, setPickupKm] = useState("");
  const [mins, setMins] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [geoOk, setGeoOk] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceOk(!!SR);
    setGeoOk("geolocation" in navigator && window.isSecureContext);
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

  /** Where the car is right now — best effort, 4 s budget, never blocks the save. */
  const herePosition = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!geoOk) return resolve(null);
      const done = (v: { lat: number; lng: number } | null) => resolve(v);
      const timer = setTimeout(() => done(null), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer);
          done({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          done(null);
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 3500 }
      );
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const net = Number(amount);
    // what this save sends — anything typed while it is in flight is the next trip and must survive
    const sent = { amount, tip, km, pickupKm, mins };
    if (!Number.isFinite(net) || net <= 0) return;
    setSaving(true);
    const here = await herePosition();
    const now = new Date();
    const durationMin = mins !== "" ? Number(mins) : null;
    // the trip just ended: its start is `minutes` ago when known
    const startTime = durationMin && durationMin > 0 ? new Date(now.getTime() - durationMin * 60_000) : now;
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        platform: defaultPlatform,
        startTime: startTime.toISOString(),
        endTime: durationMin ? now.toISOString() : null,
        fare: net,
        commission: 0,
        paymentType: payment,
        tip: tip === "" ? 0 : Number(tip),
        distanceKm: km,
        pickupKm,
        durationMin: mins,
        dropoffLat: here?.lat ?? null,
        dropoffLng: here?.lng ?? null,
        source: "MANUAL",
      }),
    });
    setSaving(false);
    if (res.ok) {
      setAmount((v) => (v === sent.amount ? "" : v));
      setTip((v) => (v === sent.tip ? "" : v));
      setKm((v) => (v === sent.km ? "" : v));
      setPickupKm((v) => (v === sent.pickupKm ? "" : v));
      setMins((v) => (v === sent.mins ? "" : v));
      setFlash(here ? t("qa.addedLocated") : t("qa.added"));
      setTimeout(() => setFlash(""), 2500);
      onAdded();
    } else {
      setFlash(t("c.error"));
    }
  };

  const small = "w-full h-11 rounded-xl bg-surface-2 border border-transparent focus:border-action focus:bg-sheet focus:outline-none px-3 text-[15px] font-semibold tnum";

  const Frame = bare ? "div" : Card;
  return (
    <Frame>
      <form onSubmit={save}>
        <span className="block text-sm font-bold mb-2">{t("qa.label")}</span>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label={t("qa.label")}
            className="min-w-0 flex-1 h-16 rounded-2xl bg-paper border-2 border-transparent focus:border-action focus:bg-sheet focus:outline-none px-4 text-[32px] font-bold display tnum"
          />
          {voiceOk && (
            <button
              type="button"
              onClick={listen}
              title={t("qa.speak")}
              className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${listening ? "bg-loss text-white animate-pulse" : "bg-paper text-ink hover:bg-surface-2"}`}
            >
              <Icon name="mic" size={22} />
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-2 items-stretch">
          <Segmented
            fill
            className="flex-1 !p-1.5"
            value={payment}
            onChange={setPayment}
            options={[
              { value: "CASH", label: t("tr.CASH") },
              { value: "CARD", label: t("tr.CARD") },
            ]}
          />
          <Btn type="submit" disabled={saving || !amount} className="flex-1 !h-14 !rounded-2xl !text-base">
            <Icon name="plus" size={18} strokeWidth={2.5} /> {t("qa.add")}
          </Btn>
        </div>
        {flash && (
          <div className="mt-2">
            <Badge tone="good">{flash}</Badge>
          </div>
        )}

        <button type="button" onClick={() => setMore((m) => !m)} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-ink-500">
          <Icon name="chevron" size={14} className={`transition-transform ${more ? "rotate-90" : "rtl:rotate-180"}`} /> {more ? t("qa.lessDetails") : t("qa.moreDetails")}
        </button>
        {more && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 animate-pop-in">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-1">{t("tr.tip")}</span>
              <input type="number" inputMode="decimal" step="1" min="0" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" className={small} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-1">{t("be.tripKm")}</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" className={small} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-1">{t("be.pickupKm")}</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" value={pickupKm} onChange={(e) => setPickupKm(e.target.value)} placeholder="0" className={small} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-1">{t("be.minutes")}</span>
              <input type="number" inputMode="numeric" step="1" min="0" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="0" className={small} />
            </label>
          </div>
        )}
      </form>
      {!bare && (
        <p className="text-xs text-muted mt-3 leading-relaxed flex items-start gap-1.5">
          {geoOk && <Icon name="pin" size={14} className="mt-0.5 shrink-0" />}
          <span>{geoOk ? t("qa.hintLocated") : t("qa.hint")}</span>
        </p>
      )}
    </Frame>
  );
}
