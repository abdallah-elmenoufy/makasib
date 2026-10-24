import "server-only";
import { prisma } from "@/lib/db";
import { getLatestOdometer, reminderStatuses } from "@/lib/analytics";
import { getWeeklyReport } from "@/lib/weekly";
import { getDailyTarget } from "@/lib/target";
import { getQuestStatus } from "@/lib/questStatus";
import { getDriveState } from "@/lib/drive";
import { getNowSuggestion } from "@/lib/now";
import { sendPush } from "@/lib/push";
import { translate, type Locale } from "@/lib/i18n/messages";
import { DEFAULT_PREFS, dueNotes, type NotifyPrefs, type VehicleSnap } from "@/lib/notifyRules";

/** At most this many per run, so the first run after subscribing doesn't flood the phone. */
const PER_RUN = 3;

export async function getNotifyPrefs(): Promise<NotifyPrefs> {
  const row = await prisma.setting.findUnique({ where: { key: "notify.prefs" } });
  try {
    return { ...DEFAULT_PREFS, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function getNotifyLocale(): Promise<Locale> {
  const row = await prisma.setting.findUnique({ where: { key: "notify.locale" } });
  return row?.value === "en" ? "en" : "ar";
}

async function snapshot(v: { id: string; name: string }, now: Date): Promise<VehicleSnap> {
  const [report, target, quests, drive, best, rems, maint, odo] = await Promise.all([
    getWeeklyReport(v.id, 2, now),
    getDailyTarget(v.id).catch(() => null),
    getQuestStatus(v.id, now),
    getDriveState(v.id),
    getNowSuggestion(v.id, now).catch(() => null),
    prisma.reminder.findMany({ where: { vehicleId: v.id } }),
    prisma.maintenance.findMany({ where: { vehicleId: v.id } }),
    getLatestOdometer(v.id),
  ]);
  const rowById = new Map(rems.map((r) => [r.id, r]));
  const locale = await getNotifyLocale();
  const w = report.lastClosed;
  return {
    vehicleId: v.id,
    carName: v.name,
    lastClosed: w ? { key: w.key, end: w.end, trueProfit: w.trueProfit, trips: w.counts.trips, profitPerHour: w.rates.profitPerHour } : null,
    reminders: reminderStatuses(rems, odo, maint).map((r) => {
      const row = rowById.get(r.id);
      // a renewed paper has a new due date, so it may notify again
      const due = row ? `${row.dueDate?.toISOString() ?? ""}|${row.dueOdometer ?? ""}` : "";
      return {
        key: r.source === "service" ? r.id : `rem:${r.id}:${due}`,
        label: r.title ?? translate(locale, `mn.cat.${r.category}`),
        source: r.source,
        state: r.state,
        kmRemaining: r.kmRemaining,
        daysRemaining: r.daysRemaining,
      };
    }),
    target: target && target.hasBasis ? { reached: target.today.netRevenue >= target.targetRevenue, today: target.today.netRevenue, target: target.targetRevenue } : null,
    quests: quests.quests.map((q) => ({
      id: q.id,
      platform: q.platform,
      tripsToNext: q.progress.tripsToNext,
      nextReward: q.progress.next?.reward ?? null,
      endAt: q.endAt,
      verdict: q.progress.verdict,
    })),
    activeShift: drive.active ? { id: drive.active.id, startTime: drive.active.startTime } : null,
    nextBest: best?.enoughData && best.nextBest ? { hour: best.nextBest.hour, avgNet: best.nextBest.avgNet } : null,
  };
}

let running = false;

/** Work out what is due, send what hasn't been sent, remember it. Safe to call often. */
export async function runNotifications(now = new Date()): Promise<{ due: number; sent: number }> {
  if (running) return { due: 0, sent: 0 };
  running = true;
  try {
    if ((await prisma.pushSubscription.count()) === 0) return { due: 0, sent: 0 };
    const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
    const snaps = await Promise.all(vehicles.map((v) => snapshot(v, now)));
    const locale = await getNotifyLocale();
    const notes = dueNotes(snaps, await getNotifyPrefs(), locale, now);
    const seen = new Set((await prisma.notifyLog.findMany({ where: { key: { in: notes.map((n) => n.key) } }, select: { key: true } })).map((r) => r.key));
    const fresh = notes.filter((n) => !seen.has(n.key)).slice(0, PER_RUN);
    let sent = 0;
    for (const n of fresh) {
      const r = await sendPush({ title: n.title, body: n.body, url: n.url, tag: n.key, lang: locale, dir: locale === "ar" ? "rtl" : "ltr" });
      // logged even if no device took it, so a dead subscription can't cause a retry storm
      await prisma.notifyLog.upsert({ where: { key: n.key }, create: { key: n.key, sentAt: now }, update: {} });
      sent += r.sent > 0 ? 1 : 0;
    }
    await prisma.notifyLog.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - 60 * 86_400_000) } } });
    return { due: notes.length, sent };
  } finally {
    running = false;
  }
}

/** Started once per server process from instrumentation.ts. */
export function startNotifyScheduler(everyMs = 5 * 60_000) {
  const g = globalThis as unknown as { __makasibNotify?: NodeJS.Timeout };
  if (g.__makasibNotify) return;
  const tick = () => runNotifications().catch((e) => console.error("notifications", e));
  g.__makasibNotify = setInterval(tick, everyMs);
  g.__makasibNotify.unref?.();
  setTimeout(tick, 30_000).unref?.();
}
