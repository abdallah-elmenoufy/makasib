import { describe, expect, it } from "vitest";
import { parseTrack, positionAt } from "@/lib/tripLocation";

const t0 = Date.UTC(2026, 9, 13, 18, 0, 0);
const track = [
  [t0, 30.0, 31.0],
  [t0 + 60_000, 30.01, 31.01],
  [t0 + 120_000, 30.02, 31.02],
];

describe("GPS track lookup", () => {
  it("parses a stored track and drops malformed points", () => {
    const parsed = parseTrack(JSON.stringify([...track, [1, 2], "x", [t0, 95, 31]]));
    expect(parsed).toHaveLength(3);
    expect(parseTrack(null)).toEqual([]);
    expect(parseTrack("{")).toEqual([]);
  });
  it("returns the nearest fix within tolerance", () => {
    expect(positionAt(track as never, t0 + 70_000)).toEqual({ lat: 30.01, lng: 31.01 });
    expect(positionAt(track as never, t0 + 119_000)).toEqual({ lat: 30.02, lng: 31.02 });
  });
  it("returns null when the nearest fix is more than ten minutes away", () => {
    expect(positionAt(track as never, t0 + 60 * 60_000)).toBeNull();
    expect(positionAt([], t0)).toBeNull();
  });
});
