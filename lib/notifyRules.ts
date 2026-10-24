import { translate, type Locale } from "@/lib/i18n/messages";
import { fmtInt, fmtMoney } from "@/lib/format";

// Which phone notifications are due, as a pure function of a snapshot of
// each car's state — so the rules are testable without a database or a
// push service. lib/notify.ts gathers the snapshot and does the sending.

export type NotifyPrefs = { week: boolean; service: boolean; target: boolean; quest: boolean; shift: boolean; bestHour: boolean };
export const DEFAULT_PREFS: NotifyPrefs = { week: true, service: true, target: true, quest: true, shift: true, bestHour: true };

export type VehicleSnap = {
  vehicleId: string;
  carName: string;
  lastClosed: { key: string; end: string; trueProfit: number; trips: number; profitPerHour: number | null } | null;
  reminders: { key: string; label: string; source: "manual" | "service"; state: "overdue" | "changeNow" | "dueSoon" | "ok"; kmRemaining: number | null; daysRemaining: number | null }[];
  target: { reached: boolean; today: number; target: number } | null;
  quests: { id: string; platform: string; tripsToNext: number | null; nextReward: number | null; endAt: string; verdict: string }[];
  activeShift: { id: string; startTime: string } | null;
  nextBest: { hour: number; avgNet: number } | null;
};

export type Note = { key: string; title: string; body: string; url: string; urgent?: boolean };

/** No buzzing at night, except for the driver who is out driving right now. */
export const QUIET_FROM = 23;
export const QUIET_TO = 8;
export const isQuiet = (d: Date) => d.getHours() >= QUIET_FROM || d.getHours() < QUIET_TO;

const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const SHIFT_MARKS = [4, 10, 12] as const;

export function dueNotes(snaps: VehicleSnap[], prefs: NotifyPrefs, locale: Locale, now: Date): Note[] {
  const t = (k: string, v?: Record<string, string | number>) => translate(locale, k, v);
  const money = (n: number) => fmtMoney(Math.round(n), locale);
  const many = snaps.length > 1;
  const out: Note[] = [];
  for (const s of snaps) {
    const head = (title: string) => (many ? `${s.carName} · ${title}` : title);
    const v = s.vehicleId;

    if (prefs.week && s.lastClosed && s.lastClosed.trips > 0 && now.getTime() - new Date(s.lastClosed.end).getTime() < 2 * 86_400_000) {
      const w = s.lastClosed;
      out.push({
        key: `week:${v}:${w.key}`,
        title: head(t("ntf.week.title", { profit: money(w.trueProfit) })),
        body: w.profitPerHour != null
          ? t("ntf.week.body", { trips: fmtInt(w.trips, locale), perHour: money(w.profitPerHour) })
          : t("ntf.week.bodyNoHours", { trips: fmtInt(w.trips, locale) }),
        url: "/weeks",
      });
    }

    if (prefs.service) {
      for (const r of s.reminders) {
        const loud = r.source === "service" ? r.state === "changeNow" || r.state === "overdue" : r.state === "dueSoon" || r.state === "overdue";
        if (!loud) continue;
        const over = r.state === "overdue";
        const left =
          r.kmRemaining != null
            ? t(over ? "ntf.svc.kmOver" : "ntf.svc.kmLeft", { km: fmtInt(Math.abs(r.kmRemaining), locale) })
            : r.daysRemaining != null
              ? t(over ? "ntf.svc.daysOver" : "ntf.svc.daysLeft", { days: fmtInt(Math.abs(r.daysRemaining), locale) })
              : "";
        out.push({
          key: `${r.key}:${r.state}`,
          title: head(t(r.source === "service" ? "ntf.svc.title" : "ntf.rem.title", { item: r.label })),
          body: [left, t(r.source === "service" ? "ntf.svc.body" : "ntf.rem.body")].filter(Boolean).join(" · "),
          url: r.source === "service" ? "/" : "/reminders",
        });
      }
    }

    if (prefs.target && s.target?.reached && s.target.target > 0) {
      out.push({
        key: `target:${v}:${day(now)}`,
        title: head(t("ntf.target.title")),
        body: t("ntf.target.body", { amount: money(s.target.today) }),
        url: "/",
      });
    }

    if (prefs.quest) {
      for (const q of s.quests) {
        const msLeft = new Date(q.endAt).getTime() - now.getTime();
        if (msLeft <= 0 || q.tripsToNext == null || q.nextReward == null) continue;
        const platform = t(`pf.${q.platform}`);
        if (q.tripsToNext <= 3) {
          out.push({
            key: `quest:${q.id}:near:${q.nextReward}`,
            title: head(t("ntf.quest.nearTitle", { n: fmtInt(q.tripsToNext, locale), reward: money(q.nextReward) })),
            body: t("ntf.quest.nearBody", { platform }),
            url: "/",
          });
        } else if (msLeft < 6 * 3_600_000 && q.verdict !== "unlikely") {
          out.push({
            key: `quest:${q.id}:closing`,
            title: head(t("ntf.quest.closingTitle", { platform })),
            body: t("ntf.quest.closingBody", { n: fmtInt(q.tripsToNext, locale), reward: money(q.nextReward) }),
            url: "/",
          });
        }
      }
    }

    if (prefs.shift && s.activeShift) {
      const hours = (now.getTime() - new Date(s.activeShift.startTime).getTime()) / 3_600_000;
      const mark = [...SHIFT_MARKS].reverse().find((m) => hours >= m);
      // a shift left open by mistake shouldn't nag forever
      if (mark && hours < 16) {
        out.push({
          key: `shift:${s.activeShift.id}:${mark}`,
          title: head(t(`ntf.shift.${mark}.title`)),
          body: t(`ntf.shift.${mark}.body`),
          url: "/",
          urgent: true,
        });
      }
    }

    if (prefs.bestHour && !s.activeShift && s.nextBest && s.nextBest.hour === (now.getHours() + 1) % 24) {
      out.push({
        key: `best:${v}:${day(now)}`,
        title: head(t("ntf.best.title", { hour: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { hour: "numeric", hour12: true }).format(new Date(2026, 0, 1, s.nextBest.hour)) })),
        body: t("ntf.best.body", { amount: money(s.nextBest.avgNet) }),
        url: "/plan",
      });
    }
  }
  return isQuiet(now) ? out.filter((n) => n.urgent) : out;
}
