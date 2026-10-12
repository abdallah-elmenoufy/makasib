import { describe, expect, it } from "vitest";
import { depreciationBasis, DEFAULT_MILEAGE_SENSITIVITY_PCT, estimateCurrentValue } from "@/lib/depreciation";
import type { Vehicle } from "@prisma/client";

const base = (over: Partial<Vehicle> = {}): Vehicle =>
  ({
    id: "v",
    name: "car",
    make: null,
    model: null,
    year: 2019,
    plate: null,
    carModelId: null,
    fuelSetup: "DUAL",
    ownership: "OWNED",
    purchasePrice: 420_000,
    estimatedValue: 620_000,
    monthlyInstallment: null,
    dailyRentalFee: null,
    targetOwnerShare: null,
    depreciationPerKm: null,
    depreciationMethod: "MILEAGE",
    depreciationEnabled: true,
    mileageSensitivityPct: null,
    lifetimeKm: null,
    initialOdometer: 120_000,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    weeklyHoursGoal: null,
    weeklyProfitGoal: null,
    ...over,
  }) as Vehicle;

describe("depreciation methods", () => {
  it("MILEAGE charges the resale penalty on today's value", () => {
    const b = depreciationBasis(base());
    expect(b.method).toBe("MILEAGE");
    expect(b.perKm).toBeCloseTo((620_000 * (DEFAULT_MILEAGE_SENSITIVITY_PCT / 100)) / 10_000, 6);
    expect(b.source).toBe("estimated");
  });
  it("sensitivity is tunable per car", () => {
    expect(depreciationBasis(base({ mileageSensitivityPct: 2 })).perKm).toBeCloseTo(1.24, 6);
  });
  it("LIFETIME spreads the purchase price over the remaining life", () => {
    const b = depreciationBasis(base({ depreciationMethod: "LIFETIME" }));
    expect(b.perKm).toBeCloseTo((420_000 * 0.85) / (400_000 - 120_000), 6);
    expect(b.lifetimePerKm).toBe(b.perKm);
  });
  it("MANUAL uses the typed figure", () => {
    expect(depreciationBasis(base({ depreciationMethod: "MANUAL", depreciationPerKm: 0.4 })).perKm).toBe(0.4);
  });
  it("a legacy manual figure without a method is still honoured", () => {
    const v = base({ depreciationPerKm: 0.9 });
    (v as { depreciationMethod?: string }).depreciationMethod = undefined;
    expect(depreciationBasis(v).method).toBe("MANUAL");
    expect(depreciationBasis(v).perKm).toBe(0.9);
  });
  it("the switch zeroes the charged rate but keeps the raw one visible", () => {
    const b = depreciationBasis(base({ depreciationEnabled: false }));
    expect(b.perKm).toBe(0);
    expect(b.rawPerKm).toBeGreaterThan(0);
    expect(b.enabled).toBe(false);
  });
  it("no price at all means no depreciation", () => {
    const b = depreciationBasis(base({ purchasePrice: null, estimatedValue: null }));
    expect(b.perKm).toBe(0);
    expect(b.source).toBe("none");
  });
  it("current value ages the purchase price when no estimate is typed", () => {
    const v = base({ estimatedValue: null, year: new Date().getFullYear() - 2 });
    expect(estimateCurrentValue(v)).toBeCloseTo(420_000 * 0.85 * 0.85, 2);
  });
});
