import { describe, expect, it } from "vitest";
import { carFund } from "@/lib/carFund";
import { cngSavings, economyDrift, tankWindows, type FuelUpLite } from "@/lib/fuelInsights";
import { checkRule, minFare, suggestMinPerKm } from "@/lib/acceptRule";

const fill = (odometer: number, quantity: number, fuelType = "PETROL_92", price = 15, fullTank = true): FuelUpLite => ({
  odometer, quantity, fuelType, pricePerUnit: price, totalCost: quantity * price, fullTank, date: new Date(2026, 0, 1, 0, 0, odometer / 100),
});

describe("carFund", () => {
  it("puts wear aside per km and finds the next bill", () => {
    const f = carFund({
      maintPerKm: 0.5, depPerKm: 1, depreciationOn: false, weekKm: 1000, lastWeekKm: 1200, avgWeeklyKm: 1500,
      upcoming: [{ label: "Tyres", kmRemaining: 6000, cost: 8000 }, { label: "Oil", kmRemaining: 900, cost: 1200 }, { label: "Wipers", kmRemaining: 300, cost: 0 }],
    });
    expect(f.thisWeek).toBe(500);
    expect(f.lastWeek).toBe(600);
    expect(f.replacementThisWeek).toBeNull();
    expect(f.nextBill).toMatchObject({ label: "Oil", cost: 1200 });
    expect(f.nextBill!.weeks).toBeCloseTo(0.6);
    expect(f.dueIn8Weeks).toBe(9200);
  });
});

describe("fuel insights", () => {
  it("measures full-to-full windows, folding partial fills in", () => {
    const w = tankWindows([fill(1000, 40), fill(1200, 10, "PETROL_92", 15, false), fill(1500, 30)], "PETROL");
    expect(w).toHaveLength(1);
    expect(w[0].per100).toBeCloseTo(8);
  });

  it("flags consumption that crept up over the last two tanks", () => {
    const ups = [fill(0, 40)];
    let odo = 0;
    for (const q of [40, 40, 40, 40, 48, 48]) ups.push(fill((odo += 500), q));
    const d = economyDrift(tankWindows(ups, "PETROL"))!;
    expect(d.usual).toBeCloseTo(8);
    expect(d.pct).toBeCloseTo(0.2);
    expect(economyDrift(tankWindows(ups.slice(0, 4), "PETROL"))).toBeNull();
  });

  it("prices petrol and gas per km for a dual-fuel car", () => {
    const ups = [fill(0, 40, "PETROL_92", 15), fill(500, 40, "PETROL_92", 15), fill(500, 10, "CNG", 7), fill(600, 10, "CNG", 7)];
    const s = cngSavings(ups)!;
    expect(s.petrolPerKm).toBeCloseTo(1.2);
    expect(s.cngPerKm).toBeCloseTo(0.7);
    expect(s.cngKm).toBeCloseTo(200);
    expect(s.savedSoFar).toBeCloseTo(100);
  });
});

describe("accept rule", () => {
  it("suggests the per-km line from the driver's own numbers", () => {
    // cost 2/km, usual 100/h profit, 25 km/h → 2 + 75/25 = 5
    expect(suggestMinPerKm(2, 100, 25)).toBe(5);
    expect(suggestMinPerKm(2.1, 100, 25)).toBe(5.5);
    expect(suggestMinPerKm(2, null, 25)).toBeNull();
  });
  it("checks an offer against the rule", () => {
    const rule = { minPerKm: 5, maxPickupKm: 3 };
    expect(minFare(rule, 2, 8)).toBe(50);
    expect(checkRule(rule, { fare: 60, pickupKm: 2, tripKm: 8 }).ok).toBe(true);
    expect(checkRule(rule, { fare: 60, pickupKm: 4, tripKm: 8 })).toMatchObject({ ok: false, pickupTooFar: true });
    expect(checkRule(rule, { fare: 40, pickupKm: 2, tripKm: 8 })).toMatchObject({ ok: false, fareTooLow: true });
  });
});
