"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Btn, Segmented } from "./ui";
import { Icon } from "./icons";
import { PLATFORMS } from "@/lib/tripForm";
import { fmtMoney } from "@/lib/format";

/**
 * Logging a whole shift's trips in one go, for a driver who is parked, tired,
 * and wants to be done.
 *
 * Every trip is one compact row: the net the app paid (the only required
 * field, big and first), then tip, trip km, km to the rider, minutes, time
 * and cash/card. Each new row inherits the previous row's platform and payment
 * and starts a plausible number of minutes after the previous trip ended, so
 * the driver mostly types the amounts and taps Save. Nothing here is a table:
 * rows reflow on a phone and every control is 48px tall.
 */

export type BatchRow = {
  id: number;
  time: string; // HH:mm
  earnings: string;
  paymentType: "CASH" | "CARD";
  tip: string;
  distanceKm: string;
  pickupKm: string;
  durationMin: string;
  platform: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

let nextId = 1;

export function TripBatchEntry({
  vehicleId,
  shift,
  defaultPlatform = "UBER",
  onSaved,
  onCancel,
  saveLabel,
  minRows = 1,
  existingCount = 0,
}: {
  vehicleId: string;
  /** The shift the trips belong to — its day and window anchor the times. */
  shift?: { id: string; startTime: string | Date; endTime?: string | Date | null } | null;
  defaultPlatform?: string;
  onSaved: (count: number) => void;
  onCancel?: () => void;
  saveLabel?: string;
  minRows?: number;
  /** Trips already logged for this shift — shown so the driver knows what is missing. */
  existingCount?: number;
}) {
  const { t, locale } = useI18n();
  // keyed on the shift's identity, not the prop object: callers re-render
  // freely and must not reset the rows a driver is typing into
  const shiftId = shift?.id ?? null;
  const shiftStart = shift ? new Date(shift.startTime).getTime() : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anchor = useMemo(() => (shiftStart != null ? new Date(shiftStart) : new Date()), [shiftId, shiftStart]);

  const blank = (prev?: BatchRow): BatchRow => {
    let time: string;
    if (prev) {
      const [h, m] = prev.time.split(":").map(Number);
      const d = new Date(anchor);
      d.setHours(h, m + (Number(prev.durationMin) || 20) + 10, 0, 0);
      time = hhmm(d);
    } else if (shift) {
      const d = new Date(anchor.getTime() + 15 * 60_000);
      time = hhmm(d);
    } else {
      time = hhmm(new Date());
    }
    return {
      id: nextId++,
      time,
      earnings: "",
      paymentType: prev?.paymentType ?? "CASH",
      tip: "",
      distanceKm: "",
      pickupKm: "",
      durationMin: "",
      platform: prev?.platform ?? defaultPlatform,
    };
  };

  const [rows, setRows] = useState<BatchRow[]>(() => Array.from({ length: Math.max(1, minRows) }, () => blank()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastRef = useRef<HTMLInputElement | null>(null);

  // re-seed the first row's time only when the sheet is opened for a
  // different shift (never on an ordinary parent re-render)
  const seededFor = useRef<string | null>(shiftId);
  useEffect(() => {
    if (seededFor.current === shiftId) return;
    seededFor.current = shiftId;
    setRows((rs) => (rs.length === 1 && rs[0].earnings === "" ? [blank()] : rs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const set = (id: number, patch: Partial<BatchRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => {
    setRows((rs) => [...rs, blank(rs[rs.length - 1])]);
    setTimeout(() => lastRef.current?.focus(), 50);
  };
  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const valid = rows.filter((r) => Number(r.earnings) > 0);
  const total = valid.reduce((s, r) => s + Number(r.earnings) + (Number(r.tip) || 0), 0);

  /** Resolve HH:mm against the shift's day; a time before the shift started
   *  is after midnight, so it rolls to the next day. */
  const instantFor = (time: string): Date => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(anchor);
    d.setHours(h, m, 0, 0);
    if (shift && d.getTime() < anchor.getTime() - 60 * 60_000) d.setDate(d.getDate() + 1);
    return d;
  };

  const save = async () => {
    if (valid.length === 0) return;
    setSaving(true);
    setError("");
    let saved = 0;
    for (const r of valid) {
      const earnings = Number(r.earnings);
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          shiftId: shift?.id ?? null,
          platform: r.platform,
          startTime: instantFor(r.time).toISOString(),
          // net-first (DOCS §5): the driver types what the app paid them;
          // cash settlement with the platform is Uber's ledger, not ours
          fare: earnings,
          commission: 0,
          paymentType: r.paymentType,
          tip: r.tip === "" ? 0 : Number(r.tip),
          distanceKm: r.distanceKm,
          pickupKm: r.pickupKm,
          durationMin: r.durationMin,
          source: "MANUAL",
        }),
      });
      if (res.ok) saved++;
    }
    setSaving(false);
    if (saved < valid.length) setError(t("c.error"));
    if (saved > 0) onSaved(saved);
  };

  return (
    <div>
      {existingCount > 0 && (
        <p className="text-xs text-muted mb-3 bg-surface rounded-lg px-3 py-2">{t("be.alreadyLogged", { n: existingCount })}</p>
      )}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-2xl bg-surface p-3 animate-pop-in">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="w-7 h-7 rounded-full bg-ink text-background text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <input
                type="time"
                value={r.time}
                onChange={(e) => set(r.id, { time: e.target.value })}
                className="h-9 rounded-lg bg-paper px-2 text-sm font-bold tnum border border-transparent focus:border-ink focus:outline-none"
              />
              <Segmented
                size="sm"
                value={r.paymentType}
                onChange={(v) => set(r.id, { paymentType: v })}
                options={[
                  { value: "CASH", label: t("tr.CASH") },
                  { value: "CARD", label: t("tr.CARD") },
                ]}
              />
              <select
                value={r.platform}
                onChange={(e) => set(r.id, { platform: e.target.value })}
                className="h-9 rounded-lg bg-paper px-2 text-xs font-bold border border-transparent focus:border-ink focus:outline-none ms-auto max-w-[6.5rem]"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {t(`pf.${p}`)}
                  </option>
                ))}
              </select>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(r.id)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-loss hover:bg-paper" aria-label={t("c.delete")}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Num
                label={t("be.earnings")}
                value={r.earnings}
                onChange={(v) => set(r.id, { earnings: v })}
                big
                inputRef={i === rows.length - 1 ? lastRef : undefined}
                autoFocus={i === 0}
                className="col-span-2"
              />
              <Num label={t("tr.tip")} value={r.tip} onChange={(v) => set(r.id, { tip: v })} />
              <Num label={t("be.tripKm")} value={r.distanceKm} onChange={(v) => set(r.id, { distanceKm: v })} />
              <Num label={t("be.pickupKm")} value={r.pickupKm} onChange={(v) => set(r.id, { pickupKm: v })} />
              <Num label={t("be.minutes")} value={r.durationMin} onChange={(v) => set(r.id, { durationMin: v })} step="1" />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={add} className="mt-3 w-full h-12 rounded-2xl border-2 border-dashed border-line-strong text-sm font-bold text-ink-500 hover:bg-surface flex items-center justify-center gap-2">
        <Icon name="plus" size={18} strokeWidth={2.25} /> {t("be.addAnother")}
      </button>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <Btn onClick={save} disabled={saving || valid.length === 0} className="flex-1 min-w-[12rem]">
          {saving ? "…" : saveLabel ?? t("be.saveN", { n: valid.length })}
          {valid.length > 0 && <span className="opacity-70 font-semibold">· {fmtMoney(total, locale)}</span>}
        </Btn>
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>
            {t("c.cancel")}
          </Btn>
        )}
        {error && <span className="text-sm text-loss">{error}</span>}
      </div>
      <p className="text-xs text-muted mt-3 leading-relaxed">{t("be.hint")}</p>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  big = false,
  step = "0.1",
  placeholder = "0",
  inputRef,
  autoFocus,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  big?: boolean;
  step?: string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-1 truncate">{label}</span>
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl bg-paper border border-transparent focus:border-ink focus:outline-none px-3 tnum ${big ? "h-14 text-2xl font-bold" : "h-11 text-[15px] font-semibold"}`}
      />
    </label>
  );
}
