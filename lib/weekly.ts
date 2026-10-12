import { prisma } from "./db";
import type { Vehicle, Shift, Trip, CashTip, Expense, FuelUp } from "@prisma/client";
import { getAnalytics, tripNet, tripMinutes } from "./analytics";
import { weekRange, weekKey, overlapMs, payDayIndex, WEEK_MS, type WeekRange } from "./week";

// Weekly analytics on Uber's pay week (lib/week.ts).
//
// Scope, deliberately: the driver's own money (net earnings, tips) and the
// car's running costs. Cash settlement with the platform (what a cash trip
// collected vs. what Uber keeps) is Uber's own ledger and is not computed or
// shown anywhere in the app.
//
// Every number here is bucketed Monday 04:00 → Monday 04:00 so a week in this
// app is the week on the driver's Uber statement. Shifts that straddle the
// boundary are split by time, and their km pro-rated by that same split, so
// nothing is counted twice and nothing falls between two weeks.

export type ZoneStat = {
  key: string;
  label: string;
  trips: number;
  net: number;
  avgNet: number;
  /** EGP per minute on trips from this zone — null until durations exist. */
  perMin: number | null;
  lat: number | null;
  lng: number | null;
};

export type TripHighlight = {
  id: string;
  startTime: string;
  net: number;
  distanceKm: number | null;
  durationMin: number | null;
  perKm: number | null;
  perMin: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  platform: string;
};

export type DayStat = {
  /** 0 = Monday … 6 = Sunday, in pay-week order. */
  index: number;
  date: string;
  trips: number;
  net: number;
  profit: number;
  onlineMin: number;
  km: number;
};

export type LengthBucket = { bucket: "short" | "medium" | "long"; trips: number; net: number; km: number; perKm: number | null };

export type WeekSummary = {
  key: string;
  start: string;
  end: string;
  isCurrent: boolean;
  /** 0..1 for the current week, 1 for a closed one. */
  progress: number;
  counts: { shifts: number; trips: number; shiftDays: number; cashTrips: number; cardTrips: number };
  earnings: {
    fares: number;
    tips: number;
    netRevenue: number;
    cardNet: number;
    cashNet: number;
  };
  costs: { fuel: number; maintenance: number; depreciation: number; workExpenses: number; ownership: number; total: number };
  trueProfit: number;
  cashProfit: number;
  rates: {
    profitPerHour: number | null;
    profitPerKm: number | null;
    profitPerTrip: number | null;
    netPerHour: number | null;
    netPerTripHour: number | null;
    netPerKm: number | null;
    netPerTrip: number | null;
    kmPerHour: number | null;
  };
  time: {
    onlineMin: number;
    tripMin: number;
    pickupMin: number;
    idleMin: number;
    utilizationPct: number | null;
    avgTripMin: number | null;
    avgPickupMin: number | null;
  };
  km: {
    shiftKm: number;
    tripKm: number;
    pickupKm: number;
    cruisingKm: number;
    deadKm: number;
    personalKm: number;
    totalKm: number;
    avgTripKm: number | null;
    /** pickup km per trip km — how much unpaid driving each paid km costs */
    pickupRatio: number | null;
    deadSharePct: number | null;
  };
  platforms: { platform: string; trips: number; net: number }[];
  days: DayStat[];
  hours: { hour: number; trips: number; net: number }[];
  bestTrip: TripHighlight | null;
  bestDay: DayStat | null;
  bestHour: { hour: number; trips: number; net: number } | null;
  pickupZones: ZoneStat[];
  dropoffZones: ZoneStat[];
  lengthBuckets: LengthBucket[];
  fuel: { fillUps: number; quantity: number; spend: number };
  expensesByCategory: { category: string; amount: number }[];
  goals: { hoursGoal: number | null; profitGoal: number | null; metHours: boolean | null; metProfit: boolean | null };
};

export type WeekDelta = {
  profit: number | null;
  netRevenue: number | null;
  trips: number | null;
  onlineMin: number | null;
  profitPerHour: number | null;
  shiftKm: number | null;
  utilizationPct: number | null;
};

export type WeeklyReport = {
  vehicleId: string;
  generatedAt: string;
  rates: { fuelCostPerKm: number; maintCostPerKm: number; depPerKm: number; depreciationEnabled: boolean };
  weeks: WeekSummary[];
  current: WeekSummary;
  previous: WeekSummary | null;
  /** The most recently closed week — what the "week closed" recap shows. */
  lastClosed: WeekSummary | null;
  /** Last week's figures at the same elapsed point — the honest pace comparison. */
  previousAtSamePoint: { netRevenue: number; trueProfit: number; trips: number; onlineMin: number } | null;
  projection: { trueProfit: number; netRevenue: number; trips: number } | null;
  best: { byProfit: string | null; byPerHour: string | null; byNet: string | null; byTrips: string | null };
  deltaVsPrevious: WeekDelta;
  deltaVsBest: WeekDelta;
  allTime: { pickupZones: ZoneStat[]; dropoffZones: ZoneStat[]; bestTrip: TripHighlight | null; weeksWithData: number };
  msUntilClose: number;
};

type Rates = { fuelCostPerKm: number; maintCostPerKm: number; depPerKm: number };

type Rows = { shifts: Shift[]; trips: Trip[]; tips: CashTip[]; expenses: Expense[]; fuelUps: FuelUp[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : null);

// ---- Zones -----------------------------------------------------------------

/** ~1.1 km cells — coarse enough to group a neighbourhood, fine enough to tell two apart. */
const GRID = 0.01;

function normalizeAddress(a: string | null): string | null {
  if (!a) return null;
  const s = a
    .replace(/\s+(EG|AE|SA)\s*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  return s.length >= 3 ? s : null;
}

function zoneKeyFor(lat: number | null, lng: number | null, address: string | null): { key: string; label: string | null; lat: number | null; lng: number | null } | null {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const la = Math.round(lat / GRID) * GRID;
    const ln = Math.round(lng / GRID) * GRID;
    return { key: `g:${la.toFixed(2)},${ln.toFixed(2)}`, label: normalizeAddress(address), lat: la, lng: ln };
  }
  const norm = normalizeAddress(address);
  if (norm) return { key: `a:${norm.toLowerCase()}`, label: norm, lat: null, lng: null };
  return null;
}

export function zoneStats(trips: Trip[], side: "pickup" | "dropoff", limit = 8): ZoneStat[] {
  const acc = new Map<string, { trips: number; net: number; min: number; labels: Map<string, number>; lat: number | null; lng: number | null }>();
  for (const t of trips) {
    const z =
      side === "pickup"
        ? zoneKeyFor(t.pickupLat, t.pickupLng, t.pickupAddress)
        : zoneKeyFor(t.dropoffLat, t.dropoffLng, t.dropoffAddress);
    if (!z) continue;
    const e = acc.get(z.key) ?? { trips: 0, net: 0, min: 0, labels: new Map(), lat: z.lat, lng: z.lng };
    e.trips++;
    e.net += tripNet(t);
    e.min += tripMinutes(t);
    if (z.label) e.labels.set(z.label, (e.labels.get(z.label) ?? 0) + 1);
    acc.set(z.key, e);
  }
  return [...acc.entries()]
    .map(([key, e]) => {
      const label =
        [...e.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        (e.lat != null && e.lng != null ? `${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}` : key.slice(2));
      return {
        key,
        label,
        trips: e.trips,
        net: r2(e.net),
        avgNet: r2(e.net / e.trips),
        perMin: e.min > 0 ? r2(e.net / e.min) : null,
        lat: e.lat,
        lng: e.lng,
      };
    })
    .sort((a, b) => b.trips - a.trips || b.net - a.net)
    .slice(0, limit);
}

function highlight(t: Trip): TripHighlight {
  const net = tripNet(t);
  const mins = tripMinutes(t);
  return {
    id: t.id,
    startTime: new Date(t.startTime).toISOString(),
    net: r2(net),
    distanceKm: t.distanceKm,
    durationMin: mins > 0 ? r2(mins) : null,
    perKm: t.distanceKm && t.distanceKm > 0 ? r2(net / t.distanceKm) : null,
    perMin: mins > 0 ? r2(net / mins) : null,
    pickupAddress: t.pickupAddress,
    dropoffAddress: t.dropoffAddress,
    platform: t.platform,
  };
}

export function bestTripOf(trips: Trip[]): TripHighlight | null {
  if (trips.length === 0) return null;
  // "best" = the one that paid most for its time, falling back to raw net
  // when durations are unknown — a long expensive trip isn't automatically good
  const withTime = trips.filter((t) => tripMinutes(t) >= 3);
  const pool = withTime.length >= 3 ? withTime : trips;
  const score = (t: Trip) => (withTime.length >= 3 ? tripNet(t) / tripMinutes(t) : tripNet(t));
  return highlight(pool.reduce((a, b) => (score(b) > score(a) ? b : a)));
}

// ---- One week --------------------------------------------------------------

function summarizeWeek(range: WeekRange, rows: Rows, vehicle: Vehicle, rates: Rates, now: Date): WeekSummary {
  const { start, end } = range;
  const isCurrent = now >= start && now < end;
  const progress = isCurrent ? Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / WEEK_MS)) : now >= end ? 1 : 0;

  const inRange = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= start.getTime() && t < end.getTime();
  };

  // shifts: split by time overlap so a shift across Monday 04:00 lands in both weeks
  let onlineMin = 0;
  let shiftKm = 0;
  let shiftCount = 0;
  const shiftDays = new Set<string>();
  const dayOnline = Array(7).fill(0) as number[];
  const dayKm = Array(7).fill(0) as number[];
  for (const s of rows.shifts) {
    if (s.endTime == null || s.endOdometer == null) continue;
    const total = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    if (total <= 0) continue;
    const ov = overlapMs(s.startTime, s.endTime, start, end);
    if (ov <= 0) continue;
    const share = ov / total;
    const km = (s.endOdometer - s.startOdometer) * share;
    onlineMin += ov / 60_000;
    shiftKm += km;
    shiftCount++;
    // attribute to the pay day the shift (portion) started on
    const from = new Date(Math.max(new Date(s.startTime).getTime(), start.getTime()));
    shiftDays.add(`${from.getFullYear()}-${from.getMonth()}-${from.getDate()}`);
    const di = payDayIndex(from);
    dayOnline[di] += ov / 60_000;
    dayKm[di] += km;
  }

  const trips = rows.trips.filter((t) => inRange(t.startTime));
  const tips = rows.tips.filter((t) => inRange(t.date));
  const expenses = rows.expenses.filter((e) => inRange(e.date));
  const fuelUps = rows.fuelUps.filter((f) => inRange(f.date));

  const fares = trips.reduce((s, t) => s + t.fare, 0);
  const commission = trips.reduce((s, t) => s + (t.commission ?? 0), 0);
  const tripTips = trips.reduce((s, t) => s + t.tip, 0);
  const standaloneTips = tips.reduce((s, t) => s + t.amount, 0);
  const netRevenue = fares - commission + tripTips + standaloneTips;
  const cashTrips = trips.filter((t) => t.paymentType === "CASH");
  const cardTrips = trips.filter((t) => t.paymentType !== "CASH");

  const allocFuel = rates.fuelCostPerKm * shiftKm;
  const allocMaint = rates.maintCostPerKm * shiftKm;
  const allocDep = rates.depPerKm * shiftKm;
  const workExpenses = expenses.filter((e) => e.isWork).reduce((s, e) => s + e.amount, 0);
  let ownership = 0;
  if (vehicle.ownership === "RENTED" && vehicle.dailyRentalFee) ownership = vehicle.dailyRentalFee * shiftDays.size;
  else if (vehicle.ownership === "TARGET" && vehicle.targetOwnerShare) ownership = (fares * vehicle.targetOwnerShare) / 100;
  const costTotal = allocFuel + allocMaint + allocDep + workExpenses + ownership;
  const trueProfit = netRevenue - costTotal;
  const cashProfit = trueProfit + allocDep;

  // time split
  const tripMin = trips.reduce((s, t) => s + tripMinutes(t), 0);
  const pickupMin = trips.reduce((s, t) => s + (t.pickupMin ?? 0), 0);
  const idleMin = Math.max(0, onlineMin - tripMin - pickupMin);
  const tripsWithMin = trips.filter((t) => tripMinutes(t) > 0).length;
  const tripsWithPickupMin = trips.filter((t) => t.pickupMin != null).length;

  // km split
  const tripKm = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const deadKm = Math.max(0, shiftKm - tripKm);
  const pickupKm = Math.min(deadKm, trips.reduce((s, t) => s + (t.pickupKm ?? 0), 0));
  const cruisingKm = Math.max(0, deadKm - pickupKm);
  // odometer span of the week's events, for personal km
  const odo: number[] = [];
  for (const s of rows.shifts) {
    if (inRange(s.startTime)) {
      odo.push(s.startOdometer);
      if (s.endOdometer != null) odo.push(s.endOdometer);
    }
  }
  for (const f of fuelUps) odo.push(f.odometer);
  const pos = odo.filter((n) => n > 0);
  const totalKm = pos.length >= 2 ? Math.max(Math.max(...pos) - Math.min(...pos), shiftKm) : shiftKm;
  const personalKm = Math.max(0, totalKm - shiftKm);
  const tripsWithKm = trips.filter((t) => t.distanceKm != null && t.distanceKm > 0);

  // per-day and per-hour
  const dayTrips = Array(7).fill(0) as number[];
  const dayNet = Array(7).fill(0) as number[];
  const hourTrips = Array(24).fill(0) as number[];
  const hourNet = Array(24).fill(0) as number[];
  for (const t of trips) {
    const di = payDayIndex(t.startTime);
    const net = tripNet(t);
    dayTrips[di]++;
    dayNet[di] += net;
    const h = new Date(t.startTime).getHours();
    hourTrips[h]++;
    hourNet[h] += net;
  }
  for (const tp of tips) dayNet[payDayIndex(tp.date)] += tp.amount;
  const costPerKm = rates.fuelCostPerKm + rates.maintCostPerKm + rates.depPerKm;
  const days: DayStat[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayExp = expenses
      .filter((e) => e.isWork && payDayIndex(e.date) === i)
      .reduce((s, e) => s + e.amount, 0);
    return {
      index: i,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      trips: dayTrips[i],
      net: r2(dayNet[i]),
      profit: r2(dayNet[i] - costPerKm * dayKm[i] - dayExp),
      onlineMin: r2(dayOnline[i]),
      km: r2(dayKm[i]),
    };
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, trips: hourTrips[h], net: r2(hourNet[h]) }));
  const activeDays = days.filter((d) => d.trips > 0 || d.onlineMin > 0);
  const bestDay = activeDays.length > 0 ? activeDays.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
  const activeHours = hours.filter((h) => h.trips > 0);
  const bestHour = activeHours.length > 0 ? activeHours.reduce((a, b) => (b.net > a.net ? b : a)) : null;

  // platforms
  const byPlatform = new Map<string, { trips: number; net: number }>();
  for (const t of trips) {
    const e = byPlatform.get(t.platform) ?? { trips: 0, net: 0 };
    e.trips++;
    e.net += tripNet(t);
    byPlatform.set(t.platform, e);
  }

  // trip length buckets (km)
  const bucketOf = (km: number): LengthBucket["bucket"] => (km < 5 ? "short" : km < 15 ? "medium" : "long");
  const buckets: Record<LengthBucket["bucket"], { trips: number; net: number; km: number }> = {
    short: { trips: 0, net: 0, km: 0 },
    medium: { trips: 0, net: 0, km: 0 },
    long: { trips: 0, net: 0, km: 0 },
  };
  for (const t of tripsWithKm) {
    const b = buckets[bucketOf(t.distanceKm!)];
    b.trips++;
    b.net += tripNet(t);
    b.km += t.distanceKm!;
  }

  const byCat = new Map<string, number>();
  for (const e of expenses) if (e.isWork) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);

  const hoursGoal = vehicle.weeklyHoursGoal ?? null;
  const profitGoal = vehicle.weeklyProfitGoal ?? null;

  return {
    key: weekKey(start),
    start: start.toISOString(),
    end: end.toISOString(),
    isCurrent,
    progress,
    counts: { shifts: shiftCount, trips: trips.length, shiftDays: shiftDays.size, cashTrips: cashTrips.length, cardTrips: cardTrips.length },
    earnings: {
      fares: r2(fares),
      tips: r2(tripTips + standaloneTips),
      netRevenue: r2(netRevenue),
      cardNet: r2(cardTrips.reduce((s, t) => s + tripNet(t), 0)),
      cashNet: r2(cashTrips.reduce((s, t) => s + tripNet(t), 0)),
    },
    costs: {
      fuel: r2(allocFuel),
      maintenance: r2(allocMaint),
      depreciation: r2(allocDep),
      workExpenses: r2(workExpenses),
      ownership: r2(ownership),
      total: r2(costTotal),
    },
    trueProfit: r2(trueProfit),
    cashProfit: r2(cashProfit),
    rates: {
      profitPerHour: safeDiv(trueProfit, onlineMin / 60),
      profitPerKm: safeDiv(trueProfit, shiftKm),
      profitPerTrip: safeDiv(trueProfit, trips.length),
      netPerHour: safeDiv(netRevenue, onlineMin / 60),
      netPerTripHour: safeDiv(netRevenue, tripMin / 60),
      netPerKm: safeDiv(netRevenue, shiftKm),
      netPerTrip: safeDiv(netRevenue, trips.length),
      kmPerHour: safeDiv(shiftKm, onlineMin / 60),
    },
    time: {
      onlineMin: r2(onlineMin),
      tripMin: r2(tripMin),
      pickupMin: r2(pickupMin),
      idleMin: r2(idleMin),
      utilizationPct: onlineMin > 0 ? r2((tripMin / onlineMin) * 100) : null,
      avgTripMin: safeDiv(tripMin, tripsWithMin),
      avgPickupMin: safeDiv(pickupMin, tripsWithPickupMin),
    },
    km: {
      shiftKm: r2(shiftKm),
      tripKm: r2(tripKm),
      pickupKm: r2(pickupKm),
      cruisingKm: r2(cruisingKm),
      deadKm: r2(deadKm),
      personalKm: r2(personalKm),
      totalKm: r2(totalKm),
      avgTripKm: safeDiv(tripKm, tripsWithKm.length),
      pickupRatio: tripKm > 0 && pickupKm > 0 ? r2(pickupKm / tripKm) : null,
      deadSharePct: shiftKm > 0 ? r2((deadKm / shiftKm) * 100) : null,
    },
    platforms: [...byPlatform.entries()].map(([platform, v]) => ({ platform, trips: v.trips, net: r2(v.net) })).sort((a, b) => b.net - a.net),
    days,
    hours,
    bestTrip: bestTripOf(trips),
    bestDay,
    bestHour,
    pickupZones: zoneStats(trips, "pickup", 5),
    dropoffZones: zoneStats(trips, "dropoff", 5),
    lengthBuckets: (["short", "medium", "long"] as const).map((bucket) => ({
      bucket,
      trips: buckets[bucket].trips,
      net: r2(buckets[bucket].net),
      km: r2(buckets[bucket].km),
      perKm: safeDiv(buckets[bucket].net, buckets[bucket].km),
    })),
    fuel: {
      fillUps: fuelUps.length,
      quantity: r2(fuelUps.reduce((s, f) => s + f.quantity, 0)),
      spend: r2(fuelUps.reduce((s, f) => s + f.totalCost, 0)),
    },
    expensesByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount: r2(amount) })).sort((a, b) => b.amount - a.amount),
    goals: {
      hoursGoal,
      profitGoal,
      metHours: hoursGoal != null ? onlineMin / 60 >= hoursGoal : null,
      metProfit: profitGoal != null ? trueProfit >= profitGoal : null,
    },
  };
}

function delta(a: WeekSummary | null, b: WeekSummary | null): WeekDelta {
  const d = (x: number | null | undefined, y: number | null | undefined) => (x != null && y != null ? r2(x - y) : null);
  if (!a || !b) return { profit: null, netRevenue: null, trips: null, onlineMin: null, profitPerHour: null, shiftKm: null, utilizationPct: null };
  return {
    profit: d(a.trueProfit, b.trueProfit),
    netRevenue: d(a.earnings.netRevenue, b.earnings.netRevenue),
    trips: d(a.counts.trips, b.counts.trips),
    onlineMin: d(a.time.onlineMin, b.time.onlineMin),
    profitPerHour: d(a.rates.profitPerHour, b.rates.profitPerHour),
    shiftKm: d(a.km.shiftKm, b.km.shiftKm),
    utilizationPct: d(a.time.utilizationPct, b.time.utilizationPct),
  };
}

const hasData = (w: WeekSummary) => w.counts.trips > 0 || w.counts.shifts > 0;

/**
 * The last `weeksBack` pay weeks (current one last), plus the comparisons a
 * driver actually asks for: vs. last week, vs. my best week, and "am I ahead
 * of where I was at this point last week?".
 */
export async function getWeeklyReport(vehicleId: string, weeksBack = 12, now = new Date()): Promise<WeeklyReport> {
  const n = Math.max(1, Math.min(52, Math.round(weeksBack)));
  const oldest = weekRange(-(n - 1), now);
  const current = weekRange(0, now);

  const [all, vehicle, shifts, trips, tips, expenses, fuelUps, allTrips] = await Promise.all([
    getAnalytics(vehicleId, "all"),
    prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } }),
    // a shift that started before the window can still overlap its first week
    prisma.shift.findMany({
      where: { vehicleId, OR: [{ startTime: { gte: new Date(oldest.start.getTime() - 2 * 86_400_000) } }, { endTime: null }] },
      orderBy: { startTime: "asc" },
    }),
    prisma.trip.findMany({ where: { vehicleId, startTime: { gte: oldest.start, lt: current.end } } }),
    prisma.cashTip.findMany({ where: { vehicleId, date: { gte: oldest.start, lt: current.end } } }),
    prisma.expense.findMany({ where: { vehicleId, date: { gte: oldest.start, lt: current.end } } }),
    prisma.fuelUp.findMany({ where: { vehicleId, date: { gte: oldest.start, lt: current.end } } }),
    prisma.trip.findMany({ where: { vehicleId } }),
  ]);

  const rates: Rates = all.rates;
  const rows: Rows = { shifts, trips, tips, expenses, fuelUps };

  const weeks: WeekSummary[] = [];
  for (let i = n - 1; i >= 0; i--) weeks.push(summarizeWeek(weekRange(-i, now), rows, vehicle, rates, now));

  const cur = weeks[weeks.length - 1];
  const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  const closed = weeks.filter((w) => !w.isCurrent && hasData(w));
  const lastClosed = closed.length > 0 ? closed[closed.length - 1] : null;

  const pick = (f: (w: WeekSummary) => number | null) => {
    const c = closed.filter((w) => f(w) != null);
    if (c.length === 0) return null;
    return c.reduce((a, b) => (f(b)! > f(a)! ? b : a)).key;
  };
  const best = {
    byProfit: pick((w) => w.trueProfit),
    byPerHour: pick((w) => w.rates.profitPerHour),
    byNet: pick((w) => w.earnings.netRevenue),
    byTrips: pick((w) => w.counts.trips),
  };
  const bestWeek = best.byProfit ? weeks.find((w) => w.key === best.byProfit) ?? null : null;

  // same elapsed point last week — the honest "am I ahead?" answer
  let previousAtSamePoint: WeeklyReport["previousAtSamePoint"] = null;
  if (prev && cur.progress >= 0.05) {
    const prevStart = new Date(prev.start);
    const cutoff = new Date(prevStart.getTime() + cur.progress * WEEK_MS);
    const partial = summarizeWeek(
      { start: prevStart, end: cutoff, key: prev.key },
      rows,
      vehicle,
      rates,
      new Date(cutoff.getTime() + 1)
    );
    previousAtSamePoint = {
      netRevenue: partial.earnings.netRevenue,
      trueProfit: partial.trueProfit,
      trips: partial.counts.trips,
      onlineMin: partial.time.onlineMin,
    };
  }

  // straight-line pace projection, only once enough of the week has happened
  const projection =
    cur.progress >= 0.2 && hasData(cur)
      ? {
          trueProfit: r2(cur.trueProfit / cur.progress),
          netRevenue: r2(cur.earnings.netRevenue / cur.progress),
          trips: Math.round(cur.counts.trips / cur.progress),
        }
      : null;

  return {
    vehicleId,
    generatedAt: now.toISOString(),
    rates: { ...rates, depreciationEnabled: all.depreciationBasis.enabled },
    weeks,
    current: cur,
    previous: prev,
    lastClosed,
    previousAtSamePoint,
    projection,
    best,
    deltaVsPrevious: delta(cur, prev),
    deltaVsBest: delta(cur, bestWeek),
    allTime: {
      pickupZones: zoneStats(allTrips, "pickup", 10),
      dropoffZones: zoneStats(allTrips, "dropoff", 10),
      bestTrip: bestTripOf(allTrips),
      weeksWithData: weeks.filter(hasData).length,
    },
    msUntilClose: Math.max(0, current.end.getTime() - now.getTime()),
  };
}
