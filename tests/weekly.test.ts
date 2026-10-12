import { describe, expect, it } from "vitest";
import { zoneStats, bestTripOf } from "@/lib/weekly";
import type { Trip } from "@prisma/client";

const trip = (over: Partial<Trip>): Trip =>
  ({
    id: Math.random().toString(36).slice(2),
    vehicleId: "v",
    shiftId: null,
    platform: "UBER",
    startTime: new Date("2026-10-13T18:00:00"),
    endTime: null,
    distanceKm: 10,
    fare: 100,
    commission: 0,
    paymentType: "CASH",
    tip: 0,
    pickupKm: null,
    pickupMin: null,
    durationMin: 20,
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    pickupAddress: null,
    dropoffAddress: null,
    source: "MANUAL",
    notes: null,
    createdAt: new Date(),
    ...over,
  }) as Trip;

describe("zoneStats", () => {
  it("groups by ~1 km grid cell when coordinates exist and names the cell by its commonest label", () => {
    const trips = [
      trip({ pickupLat: 30.051, pickupLng: 31.341, pickupAddress: "Nasr City EG" }),
      trip({ pickupLat: 30.049, pickupLng: 31.339, pickupAddress: "Nasr City EG", fare: 200 }),
      trip({ pickupLat: 29.96, pickupLng: 31.26, pickupAddress: "Maadi EG" }),
    ];
    const z = zoneStats(trips, "pickup");
    expect(z[0].trips).toBe(2);
    expect(z[0].label).toBe("Nasr City");
    expect(z[0].avgNet).toBe(150);
    expect(z[0].perMin).toBeCloseTo(300 / 40, 6);
    expect(z[1].label).toBe("Maadi");
  });
  it("falls back to the address label when there are no coordinates", () => {
    const trips = [trip({ pickupAddress: "Dokki EG" }), trip({ pickupAddress: "dokki" }), trip({ pickupAddress: null })];
    const z = zoneStats(trips, "pickup");
    expect(z).toHaveLength(1);
    expect(z[0].trips).toBe(2);
  });
});

describe("bestTripOf", () => {
  it("prefers net per minute once durations are known", () => {
    const quick = trip({ fare: 60, durationMin: 6 });
    const long = trip({ fare: 300, durationMin: 90 });
    const mid = trip({ fare: 120, durationMin: 20 });
    expect(bestTripOf([quick, long, mid])!.net).toBe(60);
  });
  it("falls back to raw net with no durations", () => {
    expect(bestTripOf([trip({ fare: 60, durationMin: null }), trip({ fare: 300, durationMin: null })])!.net).toBe(300);
  });
  it("is null for no trips", () => {
    expect(bestTripOf([])).toBeNull();
  });
});
