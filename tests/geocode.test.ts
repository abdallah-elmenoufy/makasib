import { describe, expect, it } from "vitest";
import { normalizeQuery, parseNominatim } from "@/lib/geocode";

describe("geocoding helpers", () => {
  it("normalizes labels so near-duplicates share a cache key", () => {
    expect(normalizeQuery("Nasr City EG")).toBe("nasr city");
    expect(normalizeQuery("  6th of October   EG ")).toBe("6th of october");
    expect(normalizeQuery("Maadi, Cairo")).toBe("maadi, cairo");
  });
  it("parses a Nominatim hit and rejects empty or malformed answers", () => {
    expect(parseNominatim([{ lat: "30.05", lon: "31.34", display_name: "Nasr City, Cairo, Egypt" }])).toEqual({ lat: 30.05, lng: 31.34, label: "Nasr City, Cairo" });
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim([{ lat: "x", lon: "y" }])).toBeNull();
    expect(parseNominatim({})).toBeNull();
  });
});
