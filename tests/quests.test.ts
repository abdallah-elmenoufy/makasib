import { describe, expect, it } from "vitest";
import { parseQuestText, parseTiers, questProgress } from "@/lib/quests";

describe("parseQuestText", () => {
  it("reads English tiers", () => {
    expect(parseQuestText("Quest  Mon 4:00 AM - Mon 4:00 AM\nComplete 30 trips EGP 200\nComplete 50 trips EGP 500")).toEqual([
      { trips: 30, reward: 200 },
      { trips: 50, reward: 500 },
    ]);
  });
  it("reads Arabic with Arabic digits and amounts before or after", () => {
    expect(parseQuestText("أكمل ٤٠ رحلة واحصل على ٣٥٠ ج.م\nأكمل ٦٠ رحلة واحصل على ٧٠٠ جنيه")).toEqual([
      { trips: 40, reward: 350 },
      { trips: 60, reward: 700 },
    ]);
    expect(parseQuestText("Get EGP 1,200 for 80 trips")).toEqual([{ trips: 80, reward: 1200 }]);
  });
  it("returns nothing for unrelated text", () => {
    expect(parseQuestText("Earnings EGP 87.50 Cash collected")).toEqual([]);
  });
});

describe("questProgress", () => {
  const tiers = parseTiers(JSON.stringify([{ trips: 50, reward: 500 }, { trips: 30, reward: 200 }]));
  const now = new Date("2026-10-15T12:00:00");
  const end = new Date("2026-10-19T04:00:00"); // ~88h left
  it("locks in reached tiers and estimates the next one", () => {
    const p = questProgress(tiers, 34, end, now, 2);
    expect(p.earned).toBe(200);
    expect(p.next).toEqual({ trips: 50, reward: 500 });
    expect(p.tripsToNext).toBe(16);
    expect(p.hoursNeeded).toBe(8);
    expect(p.bonusPerHour).toBe(37.5);
    expect(p.verdict).toBe("onTrack");
  });
  it("says when it is out of reach or finished", () => {
    expect(questProgress(tiers, 5, new Date("2026-10-15T20:00:00"), now, 1.5).verdict).toBe("unlikely");
    expect(questProgress(tiers, 50, end, now, 2).verdict).toBe("done");
    expect(questProgress(tiers, 10, now, now, 2).verdict).toBe("ended");
  });
});
