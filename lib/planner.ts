import { prisma } from "./db";

// "Plan your day!" — statistics over every logged trip and shift.
// Phase 1 answers WHEN to drive from the driver's own history; phase 2 will
// aggregate anonymized data across drivers server-side (same shapes, bigger n).
// WHERE to drive needs pickup locations, which no current source carries
// reliably — planned for the mobile phase (GPS at trip match time).

export type PlanCell = {
  dow: number; // 0=Sun … 6=Sat
  hour: number; // 0-23
  hours: number; // hours worked in this bucket (from shifts)
  trips: number;
  earnings: number; // net + tips
  ratePerHour: number | null; // null when hours below threshold
};

export type PlanSlot = {
  dow: number;
  hour: number;
  ratePerHour: number;
  trips: number;
  hours: number;
};

export type SeasonStat = {
  season: "ramadan" | "summer" | "school";
  hours: number;
  trips: number;
  earnings: number;
  ratePerHour: number | null;
};

const MIN_HOURS_FOR_RATE = 1; // don't show a rate from a 20-minute sample
const MIN_TRIPS_FOR_SLOT = 3;

// Egypt seasons. Ramadan spans are approximate (hijri calendar) — good enough
// for behavioral stats; extend this table over time.
const RAMADAN: [string, string][] = [
  ["2025-03-01", "2025-03-30"],
  ["2026-02-17", "2026-03-19"],
  ["2027-02-07", "2027-03-08"],
  ["2028-01-27", "2028-02-25"],
];

export function seasonOf(d: Date): SeasonStat["season"] {
  const iso = d.toISOString().slice(0, 10);
  for (const [start, end] of RAMADAN) if (iso >= start && iso <= end) return "ramadan";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 6 && day >= 15) || m === 7 || m === 8 || m === 9) return "summer";
  return "school";
}

export type Plan = Awaited<ReturnType<typeof getPlan>>;

export async function getPlan(vehicleId: string) {
  return getPlanForVehicles([vehicleId]);
}

const MIN_COMMUNITY_DRIVERS = 3;

/**
 * Same statistics, pooled across every OTHER active vehicle in the database
 * — the "community" version of the when-to-drive heatmap. Same honesty rule
 * as lib/benchmark.ts: a real aggregation, gated behind a minimum driver
 * count so a thin sample doesn't masquerade as a confident community signal.
 */
export async function getCommunityPlan(excludeVehicleId?: string) {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
  const ids = vehicles.map((v) => v.id).filter((id) => id !== excludeVehicleId);
  if (ids.length < MIN_COMMUNITY_DRIVERS) {
    return { enoughDrivers: false as const, driverCount: ids.length };
  }
  const plan = await getPlanForVehicles(ids);
  return { ...plan, enoughDrivers: true as const, driverCount: ids.length };
}

async function getPlanForVehicles(vehicleIds: string[]) {
  const [shifts, trips, tips] = await Promise.all([
    prisma.shift.findMany({
      where: { vehicleId: { in: vehicleIds }, endTime: { not: null } },
      orderBy: { startTime: "asc" },
    }),
    prisma.trip.findMany({ where: { vehicleId: { in: vehicleIds } }, orderBy: { startTime: "asc" } }),
    prisma.cashTip.findMany({ where: { vehicleId: { in: vehicleIds } } }),
  ]);

  // ---- hours worked per weekday×hour bucket (shift time distributed) ----
  const hoursGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const seasonHours: Record<SeasonStat["season"], number> = { ramadan: 0, summer: 0, school: 0 };
  for (const s of shifts) {
    let cursor = new Date(s.startTime);
    const end = new Date(s.endTime!);
    // cap runaway shifts at 24h to keep a corrupt entry from skewing stats
    if (end.getTime() - cursor.getTime() > 24 * 3_600_000) continue;
    while (cursor < end) {
      const hourEnd = new Date(cursor);
      hourEnd.setMinutes(60, 0, 0);
      const sliceEnd = hourEnd < end ? hourEnd : end;
      const frac = (sliceEnd.getTime() - cursor.getTime()) / 3_600_000;
      hoursGrid[cursor.getDay()][cursor.getHours()] += frac;
      seasonHours[seasonOf(cursor)] += frac;
      cursor = sliceEnd;
    }
  }

  // ---- earnings (net + tips) per bucket ----
  const earnGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const tripGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const seasonEarn: Record<SeasonStat["season"], number> = { ramadan: 0, summer: 0, school: 0 };
  const seasonTrips: Record<SeasonStat["season"], number> = { ramadan: 0, summer: 0, school: 0 };
  for (const t of trips) {
    const d = new Date(t.startTime);
    const net = t.fare - (t.commission ?? 0) + t.tip;
    earnGrid[d.getDay()][d.getHours()] += net;
    tripGrid[d.getDay()][d.getHours()] += 1;
    seasonEarn[seasonOf(d)] += net;
    seasonTrips[seasonOf(d)] += 1;
  }
  for (const tp of tips) {
    const d = new Date(tp.date);
    earnGrid[d.getDay()][d.getHours()] += tp.amount;
    seasonEarn[seasonOf(d)] += tp.amount;
  }

  const cells: PlanCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const hours = hoursGrid[dow][hour];
      const earnings = earnGrid[dow][hour];
      cells.push({
        dow,
        hour,
        hours: Math.round(hours * 100) / 100,
        trips: tripGrid[dow][hour],
        earnings: Math.round(earnings * 100) / 100,
        ratePerHour: hours >= MIN_HOURS_FOR_RATE ? earnings / hours : null,
      });
    }
  }

  const topSlots: PlanSlot[] = cells
    .filter((c) => c.ratePerHour != null && c.trips >= MIN_TRIPS_FOR_SLOT)
    .map((c) => ({
      dow: c.dow,
      hour: c.hour,
      ratePerHour: c.ratePerHour!,
      trips: c.trips,
      hours: c.hours,
    }))
    .sort((a, b) => b.ratePerHour - a.ratePerHour)
    .slice(0, 5);

  // ---- median minutes between consecutive trip starts, per hour of day ----
  const gapsByHour: number[][] = Array.from({ length: 24 }, () => []);
  const tripsByShift = new Map<string, typeof trips>();
  for (const t of trips) {
    if (!t.shiftId) continue;
    if (!tripsByShift.has(t.shiftId)) tripsByShift.set(t.shiftId, []);
    tripsByShift.get(t.shiftId)!.push(t);
  }
  for (const list of tripsByShift.values()) {
    for (let i = 1; i < list.length; i++) {
      const prev = new Date(list[i - 1].startTime);
      const gapMin = (new Date(list[i].startTime).getTime() - prev.getTime()) / 60_000;
      if (gapMin > 0 && gapMin < 240) gapsByHour[prev.getHours()].push(gapMin);
    }
  }
  const median = (xs: number[]) => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const gaps = gapsByHour.map((xs, hour) => ({
    hour,
    medianGapMin: median(xs) != null ? Math.round(median(xs)!) : null,
    samples: xs.length,
  }));

  const seasons: SeasonStat[] = (["ramadan", "summer", "school"] as const).map((season) => ({
    season,
    hours: Math.round(seasonHours[season] * 10) / 10,
    trips: seasonTrips[season],
    earnings: Math.round(seasonEarn[season] * 100) / 100,
    ratePerHour:
      seasonHours[season] >= MIN_HOURS_FOR_RATE ? seasonEarn[season] / seasonHours[season] : null,
  }));

  return {
    cells,
    topSlots,
    gaps,
    seasons,
    totals: {
      shifts: shifts.length,
      trips: trips.length,
      hours: Math.round(Object.values(seasonHours).reduce((a, b) => a + b, 0) * 10) / 10,
    },
    // honest-confidence flag: the page shows a "still learning" note under this
    enoughData: trips.length >= 30 && shifts.length >= 8,
  };
}
