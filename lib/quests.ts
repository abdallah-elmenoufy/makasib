// Platform quests ("complete 50 trips this week, get EGP 500") — pure
// helpers shared by the server, the Home card and the tests.
//
// Uber does not open its driver API to apps like this one, so Makasib never
// asks the driver to keep a quest up to date by hand:
//   • the quest itself is entered ONCE — from a screenshot of the quest card
//     (parseQuestText) or three numbers, with "same as last week" one tap;
//   • progress is counted from the trips already logged or imported;
//   • the bonus actually paid arrives with the weekly statement import.

export type QuestTier = { trips: number; reward: number };

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٬/g, ",").replace(/٫/g, ".");

/** Tiers from the stored JSON, sorted by trips; garbage → []. */
export function parseTiers(json: string | null | undefined): QuestTier[] {
  try {
    const raw = JSON.parse(json ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((t) => ({ trips: Math.round(Number(t?.trips)), reward: Number(t?.reward) }))
      .filter((t) => t.trips > 0 && t.reward > 0)
      .sort((a, b) => a.trips - b.trips);
  } catch {
    return [];
  }
}

/**
 * Read quest tiers from OCR text of the platform's quest/promotion card.
 * Pairs every "N trips" with the nearest following money amount, in English
 * or Arabic, with Western or Arabic digits. Returns [] when nothing reads —
 * the form then simply starts empty.
 */
export function parseQuestText(text: string): QuestTier[] {
  const t = toLatin(text).replace(/\s+/g, " ");
  const tripRe = /(\d{1,3})\s*(?:trips?|rides?|رحل(?:ة|ات)|مشوار|مشاوير)/gi;
  const moneyRe = /(?:EGP|E£|LE|ج\.?\s?م\.?|جنيه)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:EGP|E£|LE|ج\.?\s?م\.?|جنيه)/gi;
  const trips: { at: number; n: number }[] = [];
  const money: { at: number; v: number }[] = [];
  for (const m of t.matchAll(tripRe)) trips.push({ at: m.index ?? 0, n: Number(m[1]) });
  for (const m of t.matchAll(moneyRe)) money.push({ at: m.index ?? 0, v: Number((m[1] ?? m[2]).replace(/,/g, "")) });
  const tiers: QuestTier[] = [];
  const used = new Set<number>();
  for (const tr of trips) {
    // nearest amount after the trip count, else the nearest before it
    let best = -1;
    let bestDist = Infinity;
    money.forEach((mo, i) => {
      if (used.has(i)) return;
      const d = mo.at >= tr.at ? mo.at - tr.at : (tr.at - mo.at) * 1.5;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best >= 0 && bestDist < 160) {
      used.add(best);
      tiers.push({ trips: tr.n, reward: money[best].v });
    }
  }
  const seen = new Set<number>();
  return tiers.filter((x) => x.trips > 0 && x.reward > 0 && !seen.has(x.trips) && seen.add(x.trips)).sort((a, b) => a.trips - b.trips);
}

export type QuestProgress = {
  tiers: QuestTier[];
  trips: number;
  /** Bonus already locked in by the tiers reached. */
  earned: number;
  next: QuestTier | null;
  tripsToNext: number | null;
  hoursLeft: number;
  /** Hours of driving the next tier needs at this driver's usual pace. */
  hoursNeeded: number | null;
  /** The next tier's extra reward spread over those hours. */
  bonusPerHour: number | null;
  verdict: "done" | "onTrack" | "stretch" | "unlikely" | "ended";
};

/**
 * Where a quest stands and whether the next tier is worth chasing.
 * `tripsPerHour` is the driver's own recent pace (online hours, not just
 * time with a rider); `plannedHoursLeft` caps what is realistic before the
 * deadline (default: a third of the remaining time — nobody drives 24/7).
 */
export function questProgress(
  tiers: QuestTier[],
  trips: number,
  endAt: Date,
  now: Date,
  tripsPerHour: number | null,
  plannedHoursLeft?: number
): QuestProgress {
  const reached = tiers.filter((t) => trips >= t.trips);
  const earned = reached.length ? reached[reached.length - 1].reward : 0;
  const next = tiers.find((t) => trips < t.trips) ?? null;
  const hoursLeft = Math.max(0, (endAt.getTime() - now.getTime()) / 3_600_000);
  const tripsToNext = next ? next.trips - trips : null;
  const hoursNeeded = next && tripsPerHour && tripsPerHour > 0 ? tripsToNext! / tripsPerHour : null;
  const bonusPerHour = next && hoursNeeded && hoursNeeded > 0 ? (next.reward - earned) / hoursNeeded : null;
  const drivable = plannedHoursLeft ?? hoursLeft / 3;
  let verdict: QuestProgress["verdict"];
  if (!next) verdict = "done";
  else if (hoursLeft <= 0) verdict = "ended";
  else if (hoursNeeded == null) verdict = "stretch";
  else if (hoursNeeded <= drivable * 0.8) verdict = "onTrack";
  else if (hoursNeeded <= drivable * 1.3) verdict = "stretch";
  else verdict = "unlikely";
  return { tiers, trips, earned, next, tripsToNext, hoursLeft, hoursNeeded, bonusPerHour, verdict };
}
