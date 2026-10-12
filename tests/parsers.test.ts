import { describe, expect, it } from "vitest";
import { parseEarningsActivityText } from "@/lib/earningsActivity";
import { looksLikeTripRequest, parseTripRequestText } from "@/lib/tripRequest";

describe("Earnings Activity OCR parser", () => {
  it("reads a card with time, product, duration, distance and addresses", () => {
    const text = ["Mon, Oct 12", "EGP 91.43 6:42 PM", "UberX · 18 min · 7.2 km", "Nasr City EG", "Heliopolis EG"].join("\n");
    const trips = parseEarningsActivityText(text, 2026);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ date: "2026-10-12", time: "18:42", earnings: 91.43, durationMin: 18, distanceKm: 7.2, pickupAddress: "Nasr City EG", dropoffAddress: "Heliopolis EG" });
  });
  it("recovers a dropped decimal in the amount", () => {
    const trips = parseEarningsActivityText("EGP9143 6:42 PM\nUberX · 18 min · 7.2 km", 2026);
    expect(trips[0].earnings).toBe(91.43);
  });
});

describe("trip request card parser", () => {
  it("detects and parses an offer card", () => {
    const text = ["11:20", "EGP 143.50", "Net of Service Fee", "4 mins (1.6 km) away", "Street 9, Maadi", "22 mins (9.4 km) trip", "Zamalek", "Cash payment", "Accept"].join("\n");
    expect(looksLikeTripRequest(text)).toBe(true);
    const r = parseTripRequestText(text)!;
    expect(r).toMatchObject({ fare: 143.5, isCash: true, pickupMin: 4, pickupKm: 1.6, tripMin: 22, tripKm: 9.4, clock: "11:20" });
    expect(r.pickupAddress).toContain("Maadi");
  });
});
