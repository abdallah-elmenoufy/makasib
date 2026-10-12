import { describe, expect, it } from "vitest";
import { weekStartFor, weekEndFor, weekKey, weekRange, parseWeekKey, payDayIndex, payDayKey, overlapMs, weekProgress } from "@/lib/week";

// 2026-10-12 is a Monday. All times local.
const at = (s: string) => new Date(s);

describe("Uber pay week boundaries (Monday 04:00)", () => {
  it("Monday before 04:00 still belongs to the previous week", () => {
    expect(weekKey(weekStartFor(at("2026-10-12T03:59:59")))).toBe("2026-10-05");
  });
  it("Monday at exactly 04:00 opens a new week", () => {
    expect(weekKey(weekStartFor(at("2026-10-12T04:00:00")))).toBe("2026-10-12");
  });
  it("Sunday night and the following Monday 02:00 are the same week", () => {
    expect(weekKey(weekStartFor(at("2026-10-18T23:30:00")))).toBe("2026-10-12");
    expect(weekKey(weekStartFor(at("2026-10-19T02:00:00")))).toBe("2026-10-12");
  });
  it("week end is exclusive and exactly seven days of wall clock later", () => {
    const start = weekStartFor(at("2026-10-14T12:00:00"));
    const end = weekEndFor(start);
    expect(end.getDay()).toBe(1);
    expect(end.getHours()).toBe(4);
    expect(weekKey(weekStartFor(new Date(end.getTime() - 1)))).toBe("2026-10-12");
    expect(weekKey(weekStartFor(end))).toBe("2026-10-19");
  });
  it("weekRange offsets by whole weeks", () => {
    const now = at("2026-10-14T12:00:00");
    expect(weekRange(0, now).key).toBe("2026-10-12");
    expect(weekRange(-1, now).key).toBe("2026-10-05");
    expect(weekRange(-4, now).key).toBe("2026-09-14");
  });
  it("parseWeekKey snaps a mid-week date to its Monday and rejects garbage", () => {
    expect(weekKey(parseWeekKey("2026-10-15")!)).toBe("2026-10-12");
    expect(parseWeekKey("2026-10-12")!.getHours()).toBe(4);
    expect(parseWeekKey("nope")).toBeNull();
  });
});

describe("pay days inside the week", () => {
  it("a 02:00 Tuesday trip is Monday's work", () => {
    expect(payDayIndex(at("2026-10-13T02:00:00"))).toBe(0);
    expect(payDayKey(at("2026-10-13T02:00:00"))).toBe("2026-10-12");
  });
  it("Sunday 23:00 is day 6", () => {
    expect(payDayIndex(at("2026-10-18T23:00:00"))).toBe(6);
  });
});

describe("overlap and progress", () => {
  it("clips a shift straddling the boundary", () => {
    const start = weekStartFor(at("2026-10-12T05:00:00"));
    const end = weekEndFor(start);
    // shift 2026-10-19 02:00 → 06:00 overlaps the first week by 2h
    expect(overlapMs(at("2026-10-19T02:00:00"), at("2026-10-19T06:00:00"), start, end)).toBe(2 * 3_600_000);
  });
  it("progress is 0 at open and ~0.5 mid-week", () => {
    expect(weekProgress(at("2026-10-12T04:00:00"))).toBe(0);
    expect(weekProgress(at("2026-10-15T16:00:00"))).toBeCloseTo(0.5, 2);
  });
});
