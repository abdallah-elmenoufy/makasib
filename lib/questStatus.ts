import "server-only";
import { prisma } from "@/lib/db";
import { parseTiers, questProgress, type QuestProgress, type QuestTier } from "@/lib/quests";

export type QuestStatus = {
  id: string;
  platform: string;
  startAt: string;
  endAt: string;
  tiers: QuestTier[];
  progress: QuestProgress;
  /** Bonus income the weekly statement recorded inside the quest window (+1 day). */
  paid: number;
};

/** The driver's own pace over the last four weeks: trips per online hour. */
async function tripsPerHour(vehicleId: string, platform: string, now: Date): Promise<number | null> {
  const since = new Date(now.getTime() - 28 * 86_400_000);
  const [shifts, trips] = await Promise.all([
    prisma.shift.findMany({ where: { vehicleId, startTime: { gte: since }, endTime: { not: null } }, select: { startTime: true, endTime: true } }),
    prisma.trip.count({ where: { vehicleId, platform, startTime: { gte: since } } }),
  ]);
  const hours = shifts.reduce((s, sh) => s + (sh.endTime!.getTime() - sh.startTime.getTime()) / 3_600_000, 0);
  return hours >= 3 && trips > 0 ? trips / hours : null;
}

/**
 * Quests running now plus any that ended in the last three days (so the
 * driver sees the result), newest first, and the most recent quest of all
 * for the "same as last week" shortcut.
 */
export async function getQuestStatus(vehicleId: string, now = new Date()) {
  const recent = await prisma.quest.findMany({
    where: { vehicleId, endAt: { gte: new Date(now.getTime() - 3 * 86_400_000) }, startAt: { lte: now } },
    orderBy: { startAt: "desc" },
  });
  const last = await prisma.quest.findFirst({ where: { vehicleId }, orderBy: { startAt: "desc" } });
  const out: QuestStatus[] = [];
  for (const q of recent) {
    const tiers = parseTiers(q.tiers);
    const [trips, pace, bonus] = await Promise.all([
      prisma.trip.count({ where: { vehicleId, platform: q.platform, startTime: { gte: q.startAt, lt: q.endAt } } }),
      tripsPerHour(vehicleId, q.platform, now),
      prisma.cashTip.aggregate({ where: { vehicleId, kind: "BONUS", date: { gte: q.startAt, lt: new Date(q.endAt.getTime() + 86_400_000) } }, _sum: { amount: true } }),
    ]);
    out.push({
      id: q.id,
      platform: q.platform,
      startAt: q.startAt.toISOString(),
      endAt: q.endAt.toISOString(),
      tiers,
      progress: questProgress(tiers, trips, q.endAt, now, pace),
      paid: bonus._sum.amount ?? 0,
    });
  }
  return {
    quests: out,
    last: last ? { platform: last.platform, tiers: parseTiers(last.tiers), lengthMs: last.endAt.getTime() - last.startAt.getTime() } : null,
  };
}
