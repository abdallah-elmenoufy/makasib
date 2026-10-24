"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { useVehicle } from "./VehicleProvider";
import { emitChanged, useOnChanged } from "./dataBus";
import { Badge, Btn, Card, CardHead, Modal } from "./ui";
import { Icon } from "./icons";
import { fmtInt, fmtMoney, fmtNum, localizeDigits, sep, toLocalInput } from "@/lib/format";
import { parseQuestText, type QuestTier } from "@/lib/quests";
import { weekRange } from "@/lib/week";

type QuestStatus = {
  id: string;
  platform: string;
  startAt: string;
  endAt: string;
  tiers: QuestTier[];
  paid: number;
  progress: {
    trips: number;
    earned: number;
    next: QuestTier | null;
    tripsToNext: number | null;
    hoursLeft: number;
    hoursNeeded: number | null;
    bonusPerHour: number | null;
    verdict: "done" | "onTrack" | "stretch" | "unlikely" | "ended";
  };
};
type StatusResponse = { quests: QuestStatus[]; last: { platform: string; tiers: QuestTier[]; lengthMs: number } | null };

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];

function useQuestStatus() {
  const { vehicle } = useVehicle();
  const [data, setData] = useState<StatusResponse | null>(null);
  const load = useCallback(() => {
    if (!vehicle?.id) return;
    fetch(`/api/quest-status?vehicleId=${vehicle.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [vehicle?.id]);
  useEffect(load, [load]);
  useOnChanged(load);
  return { data, vehicleId: vehicle?.id ?? null };
}

function timeLeft(hours: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  return d > 0 ? t("wk.closesInDays", { d, h }) : t("wk.closesInHours", { h, m: Math.floor((hours * 60) % 60) });
}

/** Quest progress on Home: one bar with a mark per tier, and whether the next tier is worth chasing. */
export function QuestCard() {
  const { t, locale } = useI18n();
  const { data, vehicleId } = useQuestStatus();
  const [adding, setAdding] = useState<null | "form" | "screenshot">(null);
  const [hidden, setHidden] = useState(false);
  const weekKey = weekRange(0).key;
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("questPromptHidden") === weekKey);
    } catch {}
  }, [weekKey]);
  if (!data || !vehicleId) return null;
  const money = (n: number) => fmtMoney(n, locale);

  const repeatLast = async () => {
    if (!data.last) return;
    const w = weekRange(0);
    await fetch("/api/quests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, platform: data.last.platform, startAt: w.start.toISOString(), endAt: w.end.toISOString(), tiers: JSON.stringify(data.last.tiers) }),
    });
    emitChanged();
  };

  if (data.quests.length === 0) {
    if (hidden) return null;
    return (
      <Card>
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl tint-amber flex items-center justify-center shrink-0">
            <Icon name="trophy" size={22} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold">{t("quest.promptTitle")}</div>
            <p className="text-xs text-muted mt-0.5">{t("quest.promptSub")}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {data.last && (
                <Btn size="sm" onClick={repeatLast}>
                  <Icon name="check" size={15} strokeWidth={2.5} /> {t("quest.sameAsLast", { n: data.last.tiers[data.last.tiers.length - 1]?.trips ?? 0, v: money(data.last.tiers[data.last.tiers.length - 1]?.reward ?? 0) })}
                </Btn>
              )}
              <Btn size="sm" variant="secondary" onClick={() => setAdding("screenshot")}>
                <Icon name="camera" size={15} /> {t("quest.fromScreenshot")}
              </Btn>
              <Btn size="sm" variant="secondary" onClick={() => setAdding("form")}>
                {t("quest.typeIt")}
              </Btn>
              <button
                type="button"
                onClick={() => {
                  setHidden(true);
                  try {
                    localStorage.setItem("questPromptHidden", weekKey);
                  } catch {}
                }}
                className="text-xs font-bold text-muted px-2"
              >
                {t("quest.noQuest")}
              </button>
            </div>
          </div>
        </div>
        {adding && <QuestSheet vehicleId={vehicleId} startWith={adding} last={data.last} onClose={() => setAdding(null)} />}
      </Card>
    );
  }

  return (
    <>
      {data.quests.map((q) => (
        <QuestProgressCard key={q.id} q={q} />
      ))}
    </>
  );
}

function QuestProgressCard({ q }: { q: QuestStatus }) {
  const { t, locale } = useI18n();
  const money = (n: number) => fmtMoney(n, locale);
  const p = q.progress;
  const top = q.tiers[q.tiers.length - 1]?.trips ?? 1;
  const scale = Math.max(top, p.trips);
  const verdictTone = { done: "good", onTrack: "good", stretch: "warn", unlikely: "bad", ended: "neutral" } as const;
  const ended = p.verdict === "ended" || new Date(q.endAt).getTime() <= Date.now();
  const remove = async () => {
    await fetch(`/api/quests/${q.id}`, { method: "DELETE" });
    emitChanged();
  };
  return (
    <Card>
      <CardHead
        icon="trophy"
        tint="tint-amber"
        title={t("quest.title", { platform: t(`pf.${q.platform}`) })}
        sub={ended ? t("quest.endedSub") : timeLeft(p.hoursLeft, t)}
        actions={<Badge tone={verdictTone[p.verdict]}>{t(`quest.verdict.${p.verdict}`)}</Badge>}
      />
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[40px] font-bold display leading-none tnum">
            {fmtInt(p.trips, locale)}
            <span className="text-lg text-muted font-bold"> / {fmtInt(top, locale)}</span>
          </div>
          <div className="text-sm font-bold mt-1.5">
            {p.next ? t("quest.toNext", { n: p.tripsToNext ?? 0, v: money(p.next.reward) }) : t("quest.allDone", { v: money(p.earned) })}
          </div>
        </div>
        <div className="text-end">
          <div className="text-xs font-bold text-muted">{t("quest.lockedIn")}</div>
          <div className="text-2xl font-bold display text-money">{money(p.earned)}</div>
        </div>
      </div>
      {/* one bar, a mark per tier */}
      <div className="relative mt-5 mb-14 mx-6" dir="ltr">
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--gold) 18%, var(--surface-2))" }}>
          <div className="h-full rounded-full brand-gradient transition-[width] duration-700" style={{ width: `${Math.min(100, (p.trips / scale) * 100)}%` }} />
        </div>
        {q.tiers.map((tier) => {
          const reached = p.trips >= tier.trips;
          return (
            <div key={tier.trips} className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: `${(tier.trips / scale) * 100}%` }}>
              <span className={`w-5 h-5 -mt-1 rounded-full border-2 flex items-center justify-center ${reached ? "bg-[var(--gold)] border-[var(--gold)] text-white" : "bg-sheet border-[var(--gold)]"}`}>
                {reached && <Icon name="check" size={11} strokeWidth={3} />}
              </span>
              <span className="text-[11px] font-bold mt-1 whitespace-nowrap tnum">{localizeDigits(tier.trips, locale)}</span>
              <span className="text-[10px] text-muted whitespace-nowrap tnum">{money(tier.reward)}</span>
            </div>
          );
        })}
      </div>
      {p.next && !ended && p.hoursNeeded != null && (
        <p className="text-sm text-ink-500 mt-2">
          {t("quest.pace", { h: fmtNum(p.hoursNeeded, locale), v: money(p.bonusPerHour ?? 0) })}
        </p>
      )}
      {ended && (
        <p className="text-sm mt-2">
          {q.paid > 0 ? <span className="font-bold text-money">{t("quest.paid", { v: money(q.paid) })}</span> : <span className="text-muted">{t("quest.awaitStatement")}</span>}
        </p>
      )}
      <button type="button" onClick={remove} className="text-xs font-bold text-muted mt-3 underline underline-offset-4">
        {t("quest.remove")}
      </button>
    </Card>
  );
}

/** One line inside the drive sheet: "Quest 34/50 · 16 to go". */
export function QuestMini() {
  const { t, locale } = useI18n();
  const { data } = useQuestStatus();
  const q = data?.quests.find((x) => new Date(x.endAt).getTime() > Date.now());
  if (!q) return null;
  const p = q.progress;
  const top = q.tiers[q.tiers.length - 1]?.trips ?? 0;
  return (
    <div className="rounded-2xl tint-amber px-4 py-3 flex items-center gap-3">
      <Icon name="trophy" size={18} />
      <span className="text-sm font-bold flex-1 min-w-0 truncate tnum">
        {t("quest.mini", { n: fmtInt(p.trips, locale), of: fmtInt(top, locale) })}
        {p.next && (
          <>
            {sep(locale)}
            {t("quest.toNext", { n: p.tripsToNext ?? 0, v: fmtMoney(p.next.reward, locale) })}
          </>
        )}
      </span>
    </div>
  );
}

/** Enter a quest once: from a screenshot of the quest card, or by typing the tiers. */
function QuestSheet({ vehicleId, startWith, last, onClose }: { vehicleId: string; startWith: "form" | "screenshot"; last: StatusResponse["last"]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const w = weekRange(0);
  const [platform, setPlatform] = useState(last?.platform ?? "UBER");
  const [tiers, setTiers] = useState<{ trips: string; reward: string }[]>(
    last?.tiers.length ? last.tiers.map((x) => ({ trips: String(x.trips), reward: String(x.reward) })) : [{ trips: "", reward: "" }]
  );
  const [start, setStart] = useState(toLocalInput(w.start));
  const [end, setEnd] = useState(toLocalInput(w.end));
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const fromShot = async (file: File) => {
    setReading(true);
    setReadMsg("");
    try {
      const { ocrScreenshot } = await import("@/lib/ocr");
      const text = await ocrScreenshot(file);
      const found = parseQuestText(text);
      if (found.length) {
        setTiers(found.map((x) => ({ trips: String(x.trips), reward: String(x.reward) })));
        setReadMsg(t("quest.readOk", { n: found.length }));
      } else setReadMsg(t("quest.readNone"));
    } catch {
      setReadMsg(t("quest.readNone"));
    }
    setReading(false);
  };

  const valid = tiers.map((x) => ({ trips: Number(x.trips), reward: Number(x.reward) })).filter((x) => x.trips > 0 && x.reward > 0);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid.length) return;
    setBusy(true);
    const res = await fetch("/api/quests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, platform, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), tiers: JSON.stringify(valid) }),
    });
    setBusy(false);
    if (res.ok) {
      emitChanged();
      onClose();
    }
  };
  const box = "w-full h-12 rounded-xl bg-paper border border-line/60 focus:border-action focus:outline-none px-3 text-lg font-bold tnum";

  return (
    <Modal open onClose={onClose} title={t("quest.addTitle")}>
      <form onSubmit={save} className="space-y-4">
        <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong hover:border-action px-4 h-14 cursor-pointer">
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && fromShot(e.target.files[0])} autoFocus={startWith === "screenshot"} />
          <span className="w-9 h-9 rounded-xl tint-amber flex items-center justify-center shrink-0">
            <Icon name="camera" size={18} />
          </span>
          <span className="text-sm font-bold">{reading ? t("act.reading") : t("quest.readShot")}</span>
        </label>
        {readMsg && <p className="text-xs text-muted -mt-2">{readMsg}</p>}
        <div>
          <span className="block text-sm font-bold mb-2">{t("quest.tiers")}</span>
          <div className="space-y-2">
            {tiers.map((row, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center">
                <input type="number" inputMode="numeric" placeholder={t("quest.tripsPh")} value={row.trips} onChange={(e) => setTiers(tiers.map((r, j) => (j === i ? { ...r, trips: e.target.value } : r)))} className={box} aria-label={t("quest.tripsPh")} autoFocus={startWith === "form" && i === 0} />
                <input type="number" inputMode="decimal" placeholder={t("quest.rewardPh")} value={row.reward} onChange={(e) => setTiers(tiers.map((r, j) => (j === i ? { ...r, reward: e.target.value } : r)))} className={box} aria-label={t("quest.rewardPh")} />
                <button type="button" onClick={() => setTiers(tiers.length > 1 ? tiers.filter((_, j) => j !== i) : tiers)} className="w-10 h-10 rounded-full text-muted hover:text-loss" aria-label={t("c.delete")}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setTiers([...tiers, { trips: "", reward: "" }])} className="mt-2 text-sm font-bold text-action">
            + {t("quest.addTier")}
          </button>
          <p className="text-xs text-muted mt-1">{t("quest.tiersHint")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("tr.platform")}</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full h-12 rounded-xl bg-paper px-3 text-[15px] font-bold">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {t(`pf.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("quest.starts")}</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full h-12 rounded-xl bg-paper px-3 text-sm tnum" />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-ink-500 mb-1.5">{t("quest.ends")}</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full h-12 rounded-xl bg-paper px-3 text-sm tnum" />
          </label>
        </div>
        <p className="text-xs text-muted">{t("quest.countHint")}</p>
        <Btn type="submit" variant="big" disabled={busy || valid.length === 0}>
          <Icon name="check" size={20} strokeWidth={2.5} /> {t("quest.save")}
        </Btn>
      </form>
    </Modal>
  );
}
