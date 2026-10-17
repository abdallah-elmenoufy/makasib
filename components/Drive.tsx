"use client";
import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { useVehicle } from "./VehicleProvider";
import { emitChanged, useOnChanged } from "./dataBus";
import { Btn, Modal, Select } from "./ui";
import { Icon } from "./icons";
import { PhotoInput } from "./PhotoInput";
import { QuickAddTrip } from "./QuickAddTrip";
import { TripBatchEntry } from "./TripBatchEntry";
import { EndShiftFlow } from "./EndShiftFlow";
import { GpsTracker } from "./GpsTracker";
import { fmtInt, fmtMoney, fmtNum, localizeDigits, sep, toLocalInput } from "@/lib/format";

/* ---------------------------------------------------------------------------
   Drive: the whole working day in one sheet.

   Before: Home → Shifts → open a form → start; trips from another page; back
   to Shifts to end. Now one green button in the middle of the tab bar does
   the right thing for the moment:
     • no shift running → "Start shift": the odometer (one tap if the car is
       where it was parked), nothing else required;
     • shift running    → "Add trip": one number, cash/card, done — plus
       several-at-once, screenshots, and End shift;
     • End shift        → the existing three-step close (odometer, missing
       trips, recap), skipping the trips step when they were logged live.
--------------------------------------------------------------------------- */

export type DriveState = {
  vehicleId: string;
  active: { id: string; startTime: string; startOdometer: number; gpsKm: number | null; notes: string | null } | null;
  tally: { trips: number; earnings: number; tripKm: number };
  startOdoGuess: number | null;
  endOdoSuggestion: { value: number; basis: "gps" | "ratio" | "trips" } | null;
  lastShift: { id: string; endTime: string | null; endOdometer: number | null } | null;
};

type SheetMode = "closed" | "start" | "live" | "batch";

type Ctx = {
  state: DriveState | null;
  refresh: () => void;
  /** Open the sheet on whatever fits now (start or add trip). */
  open: (mode?: "auto" | "batch") => void;
  /** Go straight to the end-of-shift flow. */
  end: () => void;
};

const DriveCtx = createContext<Ctx>({ state: null, refresh: () => {}, open: () => {}, end: () => {} });
export const useDrive = () => useContext(DriveCtx);

/** Minutes since `iso`, re-rendered every 30 s while mounted. */
function useElapsedMin(iso: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  return iso ? Math.max(0, (now - new Date(iso).getTime()) / 60_000) : 0;
}

export function fmtClock(min: number, locale: string, t: (k: string) => string): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return h > 0 ? `${fmtInt(h, locale)}${t("c.hours")} ${localizeDigits(String(m).padStart(2, "0"), locale)}${t("c.minShort")}` : `${fmtInt(m, locale)}${t("c.minShort")}`;
}

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { vehicle } = useVehicle();
  const [state, setState] = useState<DriveState | null>(null);
  const [mode, setMode] = useState<SheetMode>("closed");
  // a snapshot taken when End is tapped: closing the shift makes `state.active`
  // null, but the flow must stay up for the trips step and the recap
  const [ending, setEnding] = useState<{ shift: NonNullable<DriveState["active"]>; tally: DriveState["tally"]; suggestion: DriveState["endOdoSuggestion"] } | null>(null);
  const self = useId();

  const refresh = useCallback(() => {
    if (!vehicle?.id) return;
    fetch(`/api/drive?vehicleId=${vehicle.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setState(s));
  }, [vehicle?.id]);

  useEffect(() => {
    setState(null);
    refresh();
  }, [refresh]);
  // a trip saved just before End was tapped lands after the snapshot — keep its tally live
  useEffect(() => {
    if (state?.active && ending && state.active.id === ending.shift.id && state.tally !== ending.tally) {
      setEnding((e) => (e ? { ...e, tally: state.tally } : e));
    }
  }, [state, ending]);
  useOnChanged(refresh, self);

  const changed = () => {
    refresh();
    emitChanged(self);
  };

  const open = (m: "auto" | "batch" = "auto") => {
    if (m === "batch" && state?.active) return setMode("batch");
    setMode(state?.active ? "live" : "start");
  };
  const end = () => {
    setMode("closed");
    if (state?.active) setEnding({ shift: state.active, tally: state.tally, suggestion: state.endOdoSuggestion });
  };

  return (
    <DriveCtx.Provider value={{ state, refresh, open, end }}>
      {children}
      {vehicle && state && mode !== "closed" && (
        <DriveSheet mode={mode} setMode={setMode} state={state} vehicleId={vehicle.id} onChanged={changed} onEnd={end} />
      )}
      {vehicle && ending && (
        <EndShiftFlow
          open
          onClose={() => setEnding(null)}
          shift={ending.shift}
          vehicleId={vehicle.id}
          suggestedEndOdo={ending.suggestion}
          existingTrips={{ count: ending.tally.trips, km: ending.tally.tripKm, revenue: ending.tally.earnings }}
          onEnd={async (data) => {
            const res = await fetch(`/api/shifts/${ending.shift.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(data),
            });
            // keep the flow mounted for steps 2–3; the bus refreshes the lists
            if (res.ok) emitChanged(self);
            return res.ok;
          }}
          onTripsSaved={() => emitChanged(self)}
          onFinished={() => {
            setEnding(null);
            changed();
          }}
        />
      )}
    </DriveCtx.Provider>
  );
}

function DriveSheet({
  mode,
  setMode,
  state,
  vehicleId,
  onChanged,
  onEnd,
}: {
  mode: SheetMode;
  setMode: (m: SheetMode) => void;
  state: DriveState;
  vehicleId: string;
  onChanged: () => void;
  onEnd: () => void;
}) {
  const { t } = useI18n();
  const close = () => setMode("closed");
  const title = mode === "start" ? t("drive.startTitle") : mode === "batch" ? t("tr.addMany") : t("drive.liveTitle");
  return (
    <Modal open onClose={close} title={title} wide={mode === "batch"}>
      {mode === "start" && <StartForm state={state} onStarted={() => { onChanged(); close(); }} onClose={close} />}
      {mode === "live" && state.active && <LivePanel state={state} vehicleId={vehicleId} onChanged={onChanged} onBatch={() => setMode("batch")} onEnd={onEnd} onClose={close} />}
      {mode === "batch" && state.active && (
        <TripBatchEntry
          vehicleId={vehicleId}
          shift={{ id: state.active.id, startTime: state.active.startTime }}
          existingCount={state.tally.trips}
          onSaved={() => {
            onChanged();
            setMode("live");
          }}
          onCancel={() => setMode("live")}
        />
      )}
    </Modal>
  );
}

/** Start a shift: the odometer is the only thing asked for. */
function StartForm({ state, onStarted, onClose }: { state: DriveState; onStarted: () => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { vehicle, activeVehicles, setDefaultVehicle } = useVehicle();
  const [vehicleId, setVehicleId] = useState(vehicle?.id ?? state.vehicleId);
  const [odo, setOdo] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [ocrHint, setOcrHint] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [time, setTime] = useState(toLocalInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guess = vehicleId === state.vehicleId ? state.startOdoGuess : null;

  const onOcrDigits = (candidates: number[]) => {
    const floor = guess ?? 0;
    const plausible = candidates.filter((c) => c >= floor && c < floor + 2000);
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(odo);
    if (!Number.isFinite(n) || n <= 0) return setError(t("drive.odoRequired"));
    setBusy(true);
    setError("");
    if (vehicleId !== vehicle?.id) await setDefaultVehicle(vehicleId);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, startTime: new Date(earlier ? time : Date.now()).toISOString(), startOdometer: odo, startPhoto: photo }),
    });
    setBusy(false);
    if (!res.ok) return setError(t("c.error"));
    onStarted();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {activeVehicles.length > 1 && (
        <label className="block">
          <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("sh.whichCar")}</span>
          <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {activeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-bold mb-2">{t("drive.odoQuestion")}</span>
        <input
          type="number"
          inputMode="decimal"
          step="1"
          value={odo}
          onChange={(e) => {
            setOdo(e.target.value);
            setOcrHint(false);
          }}
          placeholder={guess != null ? String(guess) : "0"}
          autoFocus
          className="w-full h-20 rounded-2xl bg-paper border-2 border-transparent focus:border-action focus:bg-sheet focus:outline-none px-4 text-[40px] font-bold display tnum text-center"
        />
        {ocrHint && <span className="block text-xs text-muted mt-1.5 text-center">📷 {t("sh.ocrDetected")}</span>}
      </label>

      {guess != null && odo === "" && (
        <button type="button" onClick={() => setOdo(String(guess))} className="w-full rounded-2xl bg-action-soft text-start px-4 py-3 flex items-center gap-3 hover:brightness-[0.98] transition">
          <span className="w-10 h-10 rounded-xl bg-action text-action-fg flex items-center justify-center shrink-0">
            <Icon name="check" size={20} strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold tnum">{t("drive.useLast", { n: fmtNum(guess, locale, 0) })}</span>
            <span className="block text-xs text-ink-500">{t("drive.useLastSub")}</span>
          </span>
        </button>
      )}

      <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} label={t("drive.readFromPhoto")} />

      {earlier ? (
        <label className="block">
          <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("sh.startTime")}</span>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-12 rounded-xl bg-paper px-3.5 text-[15px] tnum" />
        </label>
      ) : (
        <button type="button" onClick={() => setEarlier(true)} className="text-sm font-bold text-ink-500 underline underline-offset-4">
          {t("drive.startedEarlier")}
        </button>
      )}

      {error && <p className="text-sm text-loss">{error}</p>}
      <Btn type="submit" variant="big" disabled={busy || odo === ""}>
        <Icon name="play" size={20} /> {t("sh.start")}
      </Btn>
      <Link href="/import?tab=shift" onClick={onClose} className="block text-center text-sm font-bold text-ink-500 hover:text-ink">
        {t("drive.pastShift")}
      </Link>
    </form>
  );
}

/** A shift is running: show what it has made and make "add trip" one number. */
function LivePanel({
  state,
  vehicleId,
  onChanged,
  onBatch,
  onEnd,
  onClose,
}: {
  state: DriveState;
  vehicleId: string;
  onChanged: () => void;
  onBatch: () => void;
  onEnd: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const min = useElapsedMin(state.active?.startTime);
  return (
    <div className="space-y-4">
      <LiveTally state={state} minutes={min} />
      <QuickAddTrip vehicleId={vehicleId} onAdded={onChanged} bare />
      <div className="grid grid-cols-2 gap-2">
        <ActionTile icon="plus" label={t("drive.several")} onClick={onBatch} />
        <ActionTile
          icon="camera"
          label={t("tr.fromScreens")}
          onClick={() => {
            onClose();
            router.push("/import?tab=ocr");
          }}
        />
      </div>
      <button type="button" onClick={onEnd} className="w-full h-14 rounded-2xl bg-ink text-background font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition">
        <Icon name="stop" size={18} /> {t("sh.end")}
        <span className="opacity-60 font-semibold text-sm">{sep(locale)}{fmtClock(min, locale, t)}</span>
      </button>
    </div>
  );
}

function ActionTile({ icon, label, onClick }: { icon: "plus" | "camera"; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl bg-paper hover:bg-surface-2 px-3 py-3 flex items-center gap-2.5 text-start text-sm font-bold transition">
      <span className="w-9 h-9 rounded-xl bg-sheet text-action flex items-center justify-center shrink-0 shadow-[var(--shadow-sm)]">
        <Icon name={icon} size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
    </button>
  );
}

/** Time on shift, trips, and earnings so far — on the hero gradient. */
export function LiveTally({ state, minutes, compact = false }: { state: DriveState; minutes: number; compact?: boolean }) {
  const { t, locale } = useI18n();
  const perHour = minutes >= 20 ? state.tally.earnings / (minutes / 60) : null;
  return (
    <div className={`hero-surface rounded-3xl text-hero-fg ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--hero-accent)] opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-[var(--hero-accent)]" />
        </span>
        {t("sh.active")}
        <span className="ms-auto text-hero-fg/70 font-semibold tnum">{fmtClock(minutes, locale, t)}</span>
      </div>
      <div className="flex items-end justify-between gap-4 mt-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-hero-fg/70">{t("drive.earnedSoFar")}</div>
          <div className={`${compact ? "text-[36px]" : "text-[44px]"} font-bold display leading-none mt-1.5 truncate`}>{fmtMoney(state.tally.earnings, locale)}</div>
        </div>
        <div className="flex gap-5 shrink-0 text-end">
          <HeroStat label={t("sh.trips")} value={fmtInt(state.tally.trips, locale)} />
          <HeroStat label={t("drive.perHour")} value={perHour != null ? fmtMoney(perHour, locale) : "—"} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-hero-fg/70 truncate">{label}</div>
      <div className="text-xl font-bold display leading-tight mt-0.5 truncate">{value}</div>
    </div>
  );
}

/**
 * The drive card at the top of Home and Shifts: a big "Start shift" when
 * idle, the live tally with Add trip / End shift while driving.
 */
export function DriveCard({ withGps = false }: { withGps?: boolean }) {
  const { t, locale } = useI18n();
  const { state, open, end } = useDrive();
  const min = useElapsedMin(state?.active?.startTime);
  if (!state) return <div className="h-[132px] rounded-3xl bg-surface border border-line animate-pulse" />;

  if (!state.active) {
    return (
      <div className="rounded-3xl bg-sheet border border-line shadow-[var(--shadow-card)] p-4 md:p-5 flex flex-wrap sm:flex-nowrap items-center gap-4">
        <span className="w-14 h-14 rounded-2xl brand-gradient text-white flex items-center justify-center shrink-0 shadow-[var(--shadow-btn)]">
          <Icon name="car" size={28} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold leading-tight">{t("drive.ready")}</div>
          <div className="text-sm text-muted mt-1 tnum">
            {state.startOdoGuess != null ? t("drive.parkedAt", { n: fmtNum(state.startOdoGuess, locale, 0) }) : t("drive.readySub")}
          </div>
        </div>
        <Btn onClick={() => open()} className="!h-14 !px-6 !rounded-2xl !text-base w-full sm:w-auto shrink-0">
          <Icon name="play" size={18} /> {t("sh.start")}
        </Btn>
      </div>
    );
  }

  return (
    <div>
      <LiveTally state={state} minutes={min} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Btn onClick={() => open()} className="!h-14 !rounded-2xl !text-base">
          <Icon name="plus" size={20} strokeWidth={2.5} /> {t("tr.add")}
        </Btn>
        <button type="button" onClick={end} className="h-14 rounded-2xl bg-sheet border border-line font-bold text-base flex items-center justify-center gap-2 hover:bg-surface-2 transition">
          <Icon name="stop" size={18} /> {t("sh.end")}
        </button>
      </div>
      {withGps && (
        <div className="mt-2 rounded-2xl bg-sheet border border-line px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
          <GpsTracker shiftId={state.active.id} initialKm={state.active.gpsKm} />
          <span className="text-xs text-muted tnum ms-auto">
            {t("sh.startOdo")}: {fmtNum(state.active.startOdometer, locale, 0)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * While a shift runs, a slim live strip above the tab bar on every other
 * screen — the shift is never out of sight and a trip is always one tap away.
 */
export function DriveStrip() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const { state, open } = useDrive();
  const min = useElapsedMin(state?.active?.startTime);
  if (!state?.active || pathname === "/" || pathname.startsWith("/shifts")) return null;
  return (
    <div className="fixed z-30 inset-x-3 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+10px)] md:inset-x-auto md:end-6 md:bottom-6 md:w-[360px] animate-sheet-in">
      <button type="button" onClick={() => open()} className="w-full hero-surface text-hero-fg rounded-2xl shadow-[var(--shadow-lg)] ps-4 pe-2 h-14 flex items-center gap-3 text-start">
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--hero-accent)] opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-[var(--hero-accent)]" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-bold tnum truncate">
          {fmtClock(min, locale, t)}
          {sep(locale)}
          {t("pl.tripsN", { n: state.tally.trips })}
          {sep(locale)}
          {fmtMoney(state.tally.earnings, locale)}
        </span>
        <span className="h-10 px-3.5 rounded-xl bg-white text-[#064e3b] text-sm font-bold flex items-center gap-1 shrink-0">
          <Icon name="plus" size={16} strokeWidth={2.6} /> {t("drive.trip")}
        </span>
      </button>
    </div>
  );
}

/** The raised centre button of the phone tab bar. */
export function DriveFab() {
  const { t } = useI18n();
  const { state, open } = useDrive();
  const live = !!state?.active;
  return (
    <button type="button" onClick={() => open()} className="flex flex-col items-center justify-end gap-1 pb-1.5 text-[11px] font-bold text-ink" aria-label={live ? t("tr.add") : t("sh.start")}>
      <span className={`-mt-7 w-[58px] h-[58px] rounded-full brand-gradient text-white flex items-center justify-center shadow-[var(--shadow-btn)] ring-[5px] ring-[var(--background)] ${live ? "fab-live" : ""}`}>
        <Icon name={live ? "plus" : "play"} size={live ? 28 : 24} strokeWidth={live ? 2.6 : 2} />
      </span>
      <span className={live ? "text-action" : ""}>{live ? t("drive.trip") : t("drive.fab")}</span>
    </button>
  );
}
