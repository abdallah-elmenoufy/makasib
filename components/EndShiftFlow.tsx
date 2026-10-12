"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { Btn, Field, Input, Modal, Textarea } from "./ui";
import { Icon } from "./icons";
import { PhotoInput } from "./PhotoInput";
import { TripBatchEntry } from "./TripBatchEntry";
import { fmtDateTime, fmtMoney, fmtNum, hoursBetween, toLocalInput } from "@/lib/format";

/**
 * End-of-shift, in three short steps a tired driver can finish one-handed:
 *
 *   1. Close the shift — end odometer (with the app's own best guess one tap
 *      away), end time, optional photo.
 *   2. Log the night's trips — the batch entry, already knowing which shift
 *      they belong to, or skip straight to the screenshot import.
 *   3. A recap of the shift: hours, km, trips, what it made.
 */
export function EndShiftFlow({
  open,
  onClose,
  shift,
  vehicleId,
  suggestedEndOdo,
  existingTrips,
  onEnd,
  onTripsSaved,
}: {
  open: boolean;
  onClose: () => void;
  shift: any;
  vehicleId: string;
  suggestedEndOdo: { value: number; basis: "gps" | "ratio" | "trips" } | null;
  existingTrips: { count: number; km: number; revenue: number };
  onEnd: (d: Record<string, unknown>) => Promise<boolean>;
  onTripsSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [ocrHint, setOcrHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState<{ endOdometer: number; endTime: string } | null>(null);
  const [savedTrips, setSavedTrips] = useState(0);

  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter((c) => c > shift.startOdometer && c < shift.startOdometer + 2000);
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null && !odo) {
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
    const ok = await onEnd({ endTime: new Date(time).toISOString(), endOdometer: odo, endPhoto: photo, notes });
    setBusy(false);
    if (!ok) return setError(t("c.error"));
    setClosed({ endOdometer: end, endTime: new Date(time).toISOString() });
    setStep(2);
  };

  const batchShift = useMemo(
    () => (closed ? { id: shift.id as string, startTime: shift.startTime as string, endTime: closed.endTime } : null),
    [shift.id, shift.startTime, closed]
  );
  const km = closed ? closed.endOdometer - shift.startOdometer : 0;
  const hours = closed ? hoursBetween(shift.startTime, closed.endTime) : 0;

  const steps = [t("sh.step1"), t("sh.step2"), t("sh.step3")];

  return (
    <Modal open={open} onClose={onClose} title={t("sh.end")} wide>
      {/* step indicator */}
      <div className="flex items-center gap-2 mb-4">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${active ? "bg-ink text-background" : done ? "bg-money text-background" : "bg-surface-2 text-muted"}`}>
                {done ? <Icon name="check" size={14} strokeWidth={2.5} /> : n}
              </span>
              <span className={`text-xs font-bold truncate ${active ? "text-ink" : "text-muted"}`}>{label}</span>
              {i < steps.length - 1 && <span className="flex-1 h-px bg-line min-w-2" />}
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
          className="space-y-3"
        >
          <p className="text-sm text-muted">
            {t("sh.startedAt")} {fmtDateTime(shift.startTime, locale)} · {fmtNum(shift.startOdometer, locale, 0)} {t("c.km")}
          </p>
          <Field label={t("sh.endOdo")} hint={ocrHint ? `📷 ${t("sh.ocrDetected")}` : undefined}>
            <Input
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
              className="!h-16 !text-3xl font-bold tnum"
              placeholder={String(Math.round(shift.startOdometer))}
            />
          </Field>
          {suggestedEndOdo && !odo && (
            <button type="button" onClick={() => setOdo(String(suggestedEndOdo.value))} className="w-full text-start rounded-xl bg-surface hover:bg-surface-2 px-3.5 py-3 flex items-center gap-3">
              <Icon name="sparkle" size={20} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t("sh.suggestOdo", { n: fmtNum(suggestedEndOdo.value, locale, 0) })}</span>
                <span className="block text-xs text-muted">{t(`sh.suggestBasis.${suggestedEndOdo.basis}`)}</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("sh.endTime")}>
              <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
            </Field>
            <Field label={`${t("c.photo")} (${t("c.optional")})`}>
              <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} />
            </Field>
          </div>
          <Field label={`${t("c.notes")} (${t("c.optional")})`}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-loss">{error}</p>}
          <Btn type="submit" variant="big" disabled={busy || !odo}>
            <Icon name="stop" size={20} /> {t("sh.closeShift")}
          </Btn>
        </form>
      )}

      {step === 2 && closed && (
        <div>
          <div className="rounded-2xl bg-money-soft px-4 py-3 mb-4 flex items-center gap-3">
            <Icon name="check" size={20} className="text-money" strokeWidth={2.5} />
            <div className="text-sm">
              <span className="font-bold">{t("sh.closedOk")}</span>{" "}
              <span className="text-muted">
                {fmtNum(km, locale, 0)} {t("c.km")} · {fmtNum(hours, locale)} {t("c.hours")}
              </span>
            </div>
          </div>
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
            <Btn variant="secondary" onClick={() => router.push("/import?tab=ocr")}>
              <Icon name="camera" size={18} /> {t("sh.importInstead")}
            </Btn>
            <Btn variant="ghost" onClick={() => setStep(3)}>
              {t("sh.skipTrips")}
            </Btn>
          </div>
        </div>
      )}

      {step === 3 && closed && (
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-money text-white flex items-center justify-center mx-auto mb-3">
              <Icon name="check" size={28} strokeWidth={2.5} />
            </div>
            <div className="text-xl font-bold">{t("sh.doneTitle")}</div>
            <div className="text-sm text-muted mt-1">{t("sh.doneSub")}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Recap label={t("sh.duration")} value={`${fmtNum(hours, locale)} ${t("c.hours")}`} />
            <Recap label={t("sh.km")} value={`${fmtNum(km, locale, 0)} ${t("c.km")}`} />
            <Recap label={t("sh.trips")} value={fmtNum(existingTrips.count + savedTrips, locale, 0)} />
            <Recap label={t("sh.revenue")} value={fmtMoney(existingTrips.revenue, locale)} sub={savedTrips > 0 ? t("sh.plusNew", { n: savedTrips }) : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" onClick={() => router.push("/trips")}>
              {t("nav.trips")}
            </Btn>
            <Btn onClick={() => router.push("/")}>{t("sh.toDashboard")}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Recap({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-xl font-bold display mt-0.5">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
