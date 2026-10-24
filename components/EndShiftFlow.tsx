"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { Btn, Field, Input, Modal, Textarea } from "./ui";
import { Icon } from "./icons";
import { PhotoInput } from "./PhotoInput";
import { TripBatchEntry } from "./TripBatchEntry";
import { fmtDateTime, fmtInt, fmtMoney, fmtNum, hoursBetween, toLocalInput, sep } from "@/lib/format";

/**
 * End-of-shift, in three short steps a tired driver can finish one-handed:
 *
 *   1. Close the shift — the end odometer (the app's best guess is one tap);
 *      end time and a note fold away because they are rarely needed.
 *   2. Trips — when trips were logged during the shift this is one tap
 *      ("That's all"); otherwise the batch entry, or the screenshot import.
 *   3. A recap of the shift: hours, km, trips, what it made.
 */
/** Why the driver stopped — over weeks this shows whether shifts end on purpose or by attrition. */
export const END_REASONS = ["target", "tired", "slow", "traffic", "car", "personal"] as const;

export function EndShiftFlow({
  open,
  onClose,
  shift,
  vehicleId,
  suggestedEndOdo,
  existingTrips,
  onEnd,
  onTripsSaved,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  shift: any;
  vehicleId: string;
  suggestedEndOdo: { value: number; basis: "gps" | "ratio" | "trips" } | null;
  existingTrips: { count: number; km: number; revenue: number };
  onEnd: (d: Record<string, unknown>) => Promise<boolean>;
  onTripsSaved: () => void;
  /** Called once the driver leaves the recap (or closes after the shift is closed). */
  onFinished?: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [reason, setReason] = useState<string | null>(null);
  const [extras, setExtras] = useState(false);
  const [ocrHint, setOcrHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState<{ endOdometer: number; endTime: string } | null>(null);
  const [savedTrips, setSavedTrips] = useState(0);
  const [addMissing, setAddMissing] = useState(existingTrips.count === 0);

  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter((c) => c > shift.startOdometer && c < shift.startOdometer + 2000);
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  const closeShift = async () => {
    const end = Number(odo);
    if (!Number.isFinite(end) || end <= shift.startOdometer) {
      setError(t("sh.endOdoTooLow", { n: fmtNum(shift.startOdometer, locale, 0) }));
      return;
    }
    setBusy(true);
    setError("");
    const endTime = new Date(extras ? time : Date.now()).toISOString();
    const ok = await onEnd({ endTime, endOdometer: odo, endPhoto: photo, notes, ...(reason ? { endReason: reason } : {}) });
    setBusy(false);
    if (!ok) return setError(t("c.error"));
    setClosed({ endOdometer: end, endTime });
    setStep(2);
  };

  const finish = (go?: string) => {
    if (closed) onFinished?.();
    else onClose();
    if (go) router.push(go);
  };

  const batchShift = useMemo(
    () => (closed ? { id: shift.id as string, startTime: shift.startTime as string, endTime: closed.endTime } : null),
    [shift.id, shift.startTime, closed]
  );
  const km = closed ? closed.endOdometer - shift.startOdometer : 0;
  const hours = closed ? hoursBetween(shift.startTime, closed.endTime) : 0;

  const steps = [t("sh.step1"), t("sh.step2"), t("sh.step3")];

  return (
    <Modal open={open} onClose={() => finish()} title={t("sh.end")} wide={step === 2 && addMissing}>
      {/* step indicator */}
      <div className="flex items-center gap-2 mb-5">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${active ? "brand-gradient text-white shadow-[var(--shadow-btn)]" : done ? "bg-action-soft text-action" : "bg-surface-2 text-muted"}`}>
                {done ? <Icon name="check" size={15} strokeWidth={2.6} /> : fmtInt(n, locale)}
              </span>
              <span className={`text-xs font-bold truncate ${active ? "text-ink" : "text-muted hidden sm:inline"}`}>{label}</span>
              {i < steps.length - 1 && <span className={`flex-1 h-0.5 rounded-full min-w-2 ${done ? "bg-action" : "bg-line"}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            closeShift();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted tnum">
            {t("sh.startedAt")} {fmtDateTime(shift.startTime, locale)}
            {sep(locale)}
            {fmtNum(shift.startOdometer, locale, 0)} {t("c.km")}
          </p>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("drive.endOdoQuestion")}</span>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              value={odo}
              onChange={(e) => {
                setOdo(e.target.value);
                setOcrHint(false);
              }}
              min={shift.startOdometer}
              required
              autoFocus
              className="w-full h-20 rounded-2xl bg-paper border-2 border-transparent focus:border-action focus:bg-sheet focus:outline-none px-4 text-[40px] font-bold display tnum text-center"
              placeholder={String(Math.round(shift.startOdometer))}
            />
            {ocrHint && <span className="block text-xs text-muted mt-1.5 text-center">📷 {t("sh.ocrDetected")}</span>}
          </label>
          {suggestedEndOdo && !odo && (
            <button type="button" onClick={() => setOdo(String(suggestedEndOdo.value))} className="w-full text-start rounded-2xl bg-action-soft hover:brightness-[0.98] px-4 py-3 flex items-center gap-3 transition">
              <span className="w-10 h-10 rounded-xl bg-action text-action-fg flex items-center justify-center shrink-0">
                <Icon name="sparkle" size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold tnum">{t("sh.suggestOdo", { n: fmtNum(suggestedEndOdo.value, locale, 0) })}</span>
                <span className="block text-xs text-ink-500">{t(`sh.suggestBasis.${suggestedEndOdo.basis}`)}</span>
              </span>
            </button>
          )}
          <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} label={t("drive.readFromPhoto")} />
          {extras ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pop-in">
              <Field label={t("sh.endTime")}>
                <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
              </Field>
              <Field label={`${t("c.notes")} (${t("c.optional")})`}>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          ) : (
            <button type="button" onClick={() => setExtras(true)} className="text-sm font-bold text-ink-500 underline underline-offset-4">
              {t("drive.endedEarlier")}
            </button>
          )}
          <div>
            <div className="text-xs font-bold text-ink-500 mb-2">{t("sh.whyStop")}</div>
            <div className="flex flex-wrap gap-2">
              {END_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason((x) => (x === r ? null : r))}
                  className={`h-10 px-3.5 rounded-full text-sm font-bold border transition-colors ${reason === r ? "bg-action text-action-fg border-action" : "bg-sheet border-line text-ink"}`}
                >
                  {t(`sh.reason.${r}`)}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-loss">{error}</p>}
          <Btn type="submit" variant="big" disabled={busy || !odo}>
            <Icon name="stop" size={20} /> {t("sh.closeShift")}
          </Btn>
        </form>
      )}

      {step === 2 && closed && (
        <div>
          <div className="rounded-2xl bg-action-soft px-4 py-3 mb-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-action text-action-fg flex items-center justify-center shrink-0">
              <Icon name="check" size={18} strokeWidth={2.6} />
            </span>
            <div className="text-sm">
              <span className="font-bold">{t("sh.closedOk")}</span>{" "}
              <span className="text-ink-500 tnum">
                {fmtNum(km, locale, 0)} {t("c.km")}
                {sep(locale)}
                {fmtNum(hours, locale)} {t("c.hours")}
              </span>
            </div>
          </div>

          {!addMissing ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-line p-4 text-center">
                <div className="text-sm text-muted">{t("drive.loggedDuring")}</div>
                <div className="text-[40px] font-bold display leading-none mt-2 tnum">{fmtInt(existingTrips.count, locale)}</div>
                <div className="text-sm font-bold text-money mt-1.5">{fmtMoney(existingTrips.revenue, locale)}</div>
              </div>
              <Btn variant="big" onClick={() => setStep(3)}>
                <Icon name="check" size={20} strokeWidth={2.5} /> {t("drive.thatsAll")}
              </Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" onClick={() => setAddMissing(true)}>
                  <Icon name="plus" size={18} /> {t("drive.addMissing")}
                </Btn>
                <Btn variant="secondary" onClick={() => finish("/import?tab=ocr")}>
                  <Icon name="camera" size={18} /> {t("sh.importInstead")}
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted mb-3">{t("sh.logTripsHint")}</p>
              <TripBatchEntry
                vehicleId={vehicleId}
                shift={batchShift}
                existingCount={existingTrips.count}
                minRows={1}
                onSaved={(n) => {
                  setSavedTrips(n);
                  onTripsSaved();
                  setStep(3);
                }}
                saveLabel={t("sh.saveTripsFinish")}
              />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Btn variant="secondary" onClick={() => finish("/import?tab=ocr")}>
                  <Icon name="camera" size={18} /> {t("sh.importInstead")}
                </Btn>
                <Btn variant="ghost" onClick={() => setStep(3)}>
                  {t("sh.skipTrips")}
                </Btn>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && closed && (
        <div className="space-y-4">
          <div className="hero-surface rounded-3xl text-hero-fg p-5 text-center">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
              <Icon name="check" size={28} strokeWidth={2.6} />
            </div>
            <div className="text-xl font-bold">{t("sh.doneTitle")}</div>
            <div className="text-[44px] font-bold display leading-tight mt-3">{fmtMoney(existingTrips.revenue, locale)}</div>
            <div className="text-sm text-hero-fg/70 mt-2">{savedTrips > 0 ? t("sh.plusNew", { n: savedTrips }) : t("drive.earnedThisShift")}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Recap label={t("sh.duration")} value={`${fmtNum(hours, locale)} ${t("c.hours")}`} />
            <Recap label={t("sh.km")} value={fmtNum(km, locale, 0)} />
            <Recap label={t("sh.trips")} value={fmtInt(existingTrips.count + savedTrips, locale)} />
          </div>
          <p className="text-xs text-muted text-center">{t("sh.doneSub")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" onClick={() => finish("/trips")}>
              {t("nav.trips")}
            </Btn>
            <Btn onClick={() => finish("/")}>{t("sh.toDashboard")}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper p-3 text-center">
      <div className="text-[11px] font-bold text-muted truncate">{label}</div>
      <div className="text-2xl font-bold display mt-0.5 tnum truncate">{value}</div>
    </div>
  );
}
