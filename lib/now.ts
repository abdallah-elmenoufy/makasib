import { prisma } from "./db";
import { tripNet, tripMinutes } from "./analytics";
import { zoneStats, type ZoneStat } from "./weekly";

// "Where should I go right now?"
//
// The planner answers WHEN (weekday × hour heatmap) and the weekly report
// answers WHERE (pickup zones), each over all time. This joins the two for
// the moment the driver is actually sitting in the car: trips that started
// around this hour on this kind of day (weekday vs. Egypt's Fri/Sat weekend),
// over the last weeks, ranked by what each pickup area paid. Honest gating:
// nothing is suggested until the window holds a real sample.

export const NOW_WEEKS_BACK = 8;
const HOUR_WINDOW = 1; // ± hours around now
const MIN_TRIPS_FOR_SUGGESTION = 5;
const MIN_TRIPS_PER_ZONE = 2;

export type NowSuggestion = {
  hour: number;
  isWeekend: boolean;
  sampleTrips: number;
  enoughData: boolean;
  /** Net per hour-with-rider this slot usually pays, from the sample. */
  netPerTripHour: number | null;
  avgNetPerTrip: number | null;
  zones: ZoneStat[];
  /** The best of the coming hours today (net per trip), so the driver can time a break. */
  nextBest: { hour: number; avgNet: number; trips: number } | null;
};

const isWeekendDay = (d: Date) => d.getDay() === 5 || d.getDay() === 6;
const hourDist = (a: number, b: number) => Math.min(Math.abs(a - b), 24 - Math.abs(a - b));

export async function getNowSuggestion(vehicleId: string, now = new Date()): Promise<NowSuggestion> {
  const since = new Date(now.getTime() - NOW_WEEKS_BACK * 7 * 86_400_000);
  const trips = await prisma.trip.findMany({ where: { vehicleId, startTime: { gte: since } } });
  const hour = now.getHours();
  const weekend = isWeekendDay(now);

  const sameKind = trips.filter((t) => isWeekendDay(new Date(t.startTime)) === weekend);
  const pool = sameKind.length >= MIN_TRIPS_FOR_SUGGESTION * 2 ? sameKind : trips;
  const inWindow = pool.filter((t) => hourDist(new Date(t.startTime).getHours(), hour) <= HOUR_WINDOW);

  const net = inWindow.reduce((s, t) => s + tripNet(t), 0);
  const mins = inWindow.reduce((s, t) => s + tripMinutes(t), 0);
  const enough = inWindow.length >= MIN_TRIPS_FOR_SUGGESTION;

  // best upcoming hour in the next 6, by average net per trip, same pool
  let nextBest: NowSuggestion["nextBest"] = null;
  for (let h = 1; h <= 6; h++) {
    const hh = (hour + h) % 24;
    const slot = pool.filter((t) => new Date(t.startTime).getHours() === hh);
    if (slot.length < MIN_TRIPS_PER_ZONE) continue;
    const avg = slot.reduce((s, t) => s + tripNet(t), 0) / slot.length;
    if (!nextBest || avg > nextBest.avgNet) nextBest = { hour: hh, avgNet: Math.round(avg * 100) / 100, trips: slot.length };
  }

  return {
    hour,
    isWeekend: weekend,
    sampleTrips: inWindow.length,
    enoughData: enough,
    netPerTripHour: enough && mins > 0 ? Math.round((net / mins) * 60 * 100) / 100 : null,
    avgNetPerTrip: enough ? Math.round((net / inWindow.length) * 100) / 100 : null,
    zones: enough
      ? zoneStats(inWindow, "pickup", 3)
          .filter((z) => z.trips >= MIN_TRIPS_PER_ZONE)
          .sort((a, b) => b.avgNet * Math.sqrt(b.trips) - a.avgNet * Math.sqrt(a.trips))
      : [],
    nextBest,
  };
}
