import { describe, expect, it } from "vitest";
import { startOdometerGuess, suggestEndOdometer } from "@/lib/odometer";

describe("suggestEndOdometer", () => {
  it("prefers measured GPS distance", () => {
    expect(suggestEndOdometer({ id: "a", startOdometer: 1000, gpsKm: 87.4 }, [], [])).toEqual({ value: 1087, basis: "gps" });
  });

  it("returns null with nothing to go on", () => {
    expect(suggestEndOdometer({ id: "a", startOdometer: 1000 }, [], [])).toBeNull();
  });

  it("uses raw trip + pickup km when there is no history", () => {
    const trips = [{ shiftId: "a", distanceKm: 10, pickupKm: 2 }, { shiftId: "a", distanceKm: 8 }];
    expect(suggestEndOdometer({ id: "a", startOdometer: 1000 }, trips, [])).toEqual({ value: 1020, basis: "trips" });
  });

  it("scales by the driver's own shift/trip ratio, clamped to 2.5", () => {
    const trips = [
      { shiftId: "a", distanceKm: 20 },
      { shiftId: "old", distanceKm: 50 },
    ];
    const completed = [{ id: "old", startOdometer: 0, endOdometer: 75 }];
    expect(suggestEndOdometer({ id: "a", startOdometer: 1000 }, trips, completed)).toEqual({ value: 1030, basis: "ratio" });
    const wild = [{ id: "old", startOdometer: 0, endOdometer: 500 }];
    expect(suggestEndOdometer({ id: "a", startOdometer: 1000 }, trips, wild)?.value).toBe(1050);
  });
});

describe("startOdometerGuess", () => {
  it("takes the higher of last end and the car's initial reading", () => {
    expect(startOdometerGuess(45230.4, 40000)).toBe(45230);
    expect(startOdometerGuess(null, 40000)).toBe(40000);
    expect(startOdometerGuess(null, 0)).toBeNull();
  });
});
