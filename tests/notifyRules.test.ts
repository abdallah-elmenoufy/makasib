import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, dueNotes, type VehicleSnap } from "@/lib/notifyRules";

const base: VehicleSnap = {
  vehicleId: "v1",
  carName: "Corolla",
  lastClosed: null,
  reminders: [],
  target: null,
  quests: [],
  activeShift: null,
  nextBest: null,
};
const noon = new Date(2026, 9, 26, 12, 0); // Monday

describe("dueNotes", () => {
  it("recaps the week that just closed, only for two days", () => {
    const snap = { ...base, lastClosed: { key: "2026-10-19", end: new Date(2026, 9, 26, 4).toISOString(), trueProfit: 4200, trips: 61, profitPerHour: 88 } };
    const [n] = dueNotes([snap], DEFAULT_PREFS, "en", noon);
    expect(n.key).toBe("week:v1:2026-10-19");
    expect(n.title).toContain("4,200");
    expect(dueNotes([snap], DEFAULT_PREFS, "en", new Date(2026, 9, 29, 12))).toHaveLength(0);
  });

  it("alerts a part at 90% but not at 80%, and keys by state", () => {
    const r = { key: "svc:m1", label: "Engine oil", source: "service" as const, kmRemaining: 400, daysRemaining: null };
    expect(dueNotes([{ ...base, reminders: [{ ...r, state: "dueSoon" }] }], DEFAULT_PREFS, "en", noon)).toHaveLength(0);
    const [n] = dueNotes([{ ...base, reminders: [{ ...r, state: "changeNow" }] }], DEFAULT_PREFS, "en", noon);
    expect(n.key).toBe("svc:m1:changeNow");
    expect(n.body).toContain("400 km left");
  });

  it("nudges at 4, 10 and 12 hours on a shift, even at night", () => {
    const at = (h: number) => ({ ...base, activeShift: { id: "s1", startTime: new Date(noon.getTime() - h * 3_600_000).toISOString() } });
    expect(dueNotes([at(3)], DEFAULT_PREFS, "en", noon)).toHaveLength(0);
    expect(dueNotes([at(4.5)], DEFAULT_PREFS, "en", noon)[0].key).toBe("shift:s1:4");
    expect(dueNotes([at(11)], DEFAULT_PREFS, "en", noon)[0].key).toBe("shift:s1:10");
    const night = new Date(2026, 9, 27, 1, 0);
    const s = { ...base, activeShift: { id: "s1", startTime: new Date(night.getTime() - 12.5 * 3_600_000).toISOString() } };
    expect(dueNotes([s], DEFAULT_PREFS, "en", night).map((n) => n.key)).toEqual(["shift:s1:12"]);
  });

  it("stays quiet at night and respects switched-off topics", () => {
    const snap = { ...base, target: { reached: true, today: 1100, target: 1000 } };
    expect(dueNotes([snap], DEFAULT_PREFS, "en", new Date(2026, 9, 26, 23, 30))).toHaveLength(0);
    expect(dueNotes([snap], { ...DEFAULT_PREFS, target: false }, "en", noon)).toHaveLength(0);
    expect(dueNotes([snap], DEFAULT_PREFS, "en", noon)[0].key).toBe("target:v1:2026-10-26");
  });

  it("tells a quest is close, in Arabic digits for Arabic", () => {
    const snap = { ...base, quests: [{ id: "q1", platform: "UBER", tripsToNext: 2, nextReward: 300, endAt: new Date(2026, 9, 27).toISOString(), verdict: "onTrack" }] };
    const [n] = dueNotes([snap], DEFAULT_PREFS, "ar", noon);
    expect(n.key).toBe("quest:q1:near:300");
    expect(n.title).toContain("٢");
  });

  it("names the car when the driver has more than one", () => {
    const a = { ...base, target: { reached: true, today: 1100, target: 1000 } };
    const b = { ...a, vehicleId: "v2", carName: "Elantra" };
    expect(dueNotes([a, b], DEFAULT_PREFS, "en", noon).map((n) => n.title.split(" · ")[0])).toEqual(["Corolla", "Elantra"]);
  });
});
