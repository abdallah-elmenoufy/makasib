import { describe, expect, it } from "vitest";
import { keepOrSell } from "@/lib/keepOrSellRules";

const base = { value: 400_000, monthlyProfit: 12_000, monthlyKm: 5_000, depPerKm: 0.6, maintPerKmRecent: 0.5, maintPerKmBefore: 0.45, parts: [] };

describe("keepOrSell", () => {
  it("keeps a car that earns more than it loses", () => {
    const r = keepOrSell(base);
    expect(r.yearEarnings).toBe(144_000);
    expect(r.yearValueLoss).toBe(36_000);
    expect(r.valueInAYear).toBe(364_000);
    expect(r.verdict).toBe("keep");
  });

  it("counts a part as many times as it falls due within the year", () => {
    const r = keepOrSell({ ...base, parts: [{ label: "OIL", kmRemaining: 1_000, intervalKm: 10_000, cost: 1_500 }, { label: "TYRES", kmRemaining: 80_000, intervalKm: 45_000, cost: 9_000 }] });
    // 60,000 km a year: due at 1k, 11k, 21k, 31k, 41k, 51k → 6 oil changes; tyres not within the year
    expect(r.repairs).toEqual([{ label: "OIL", cost: 1_500, times: 6 }]);
    expect(r.repairsTotal).toBe(9_000);
  });

  it("flags rising maintenance cost per km", () => {
    expect(keepOrSell({ ...base, maintPerKmRecent: 0.7, maintPerKmBefore: 0.5 }).verdict).toBe("watch");
  });

  it("suggests selling when a year's repairs pass half the car's value or it loses money", () => {
    expect(keepOrSell({ ...base, value: 30_000, parts: [{ label: "GEARBOX", kmRemaining: 0, intervalKm: 200_000, cost: 20_000 }] }).verdict).toBe("sell");
    expect(keepOrSell({ ...base, monthlyProfit: 2_000 }).reasons).toContain("losesMoney");
  });
});
