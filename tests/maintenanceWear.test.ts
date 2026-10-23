import { describe, expect, it } from "vitest";
import { serviceProgress, serviceReminders, wearState, inServiceItems } from "@/lib/maintenance";

const item = (id: string, category: string, odometer: number, lifetimeKm: number, date = "2026-01-01") => ({ id, category, date, odometer, cost: 300, lifetimeKm });

describe("wearState", () => {
  it("is amber from 80%, red from 90%, overdue from 100%", () => {
    expect(wearState(0.79)).toBe("ok");
    expect(wearState(0.8)).toBe("dueSoon");
    expect(wearState(0.89)).toBe("dueSoon");
    expect(wearState(0.9)).toBe("changeNow");
    expect(wearState(0.99)).toBe("changeNow");
    expect(wearState(1)).toBe("overdue");
  });
});

describe("service alerts", () => {
  it("flags parts by share of life used (listed by km left)", () => {
    const items = [item("oil", "OIL", 100_000, 5_000), item("brakes", "BRAKES", 58_500, 50_000), item("air", "AIR_FILTER", 104_200, 10_000)];
    const due = serviceReminders(items, 104_100);
    expect(due.map((d) => [d.category, d.state])).toEqual([
      ["OIL", "dueSoon"], // 4,100 of 5,000 → 82%, 900 km left
      ["BRAKES", "changeNow"], // 45,600 of 50,000 → 91%, 4,400 km left
      ["AIR_FILTER", "ok"],
    ]);
  });

  it("clears once the part is logged as changed: the new record restarts at zero", () => {
    const old = item("oil1", "OIL", 100_000, 5_000, "2026-01-01");
    const fresh = item("oil2", "OIL", 104_600, 5_000, "2026-03-01");
    expect(serviceProgress(old, 104_700).state).toBe("changeNow");
    const live = inServiceItems([old, fresh]);
    expect(live.map((m) => m.id)).toEqual(["oil2"]);
    const due = serviceReminders([old, fresh], 104_700);
    expect(due).toHaveLength(1);
    expect(due[0].state).toBe("ok");
    expect(Math.round(due[0].ratio * 100)).toBe(2);
  });
});
