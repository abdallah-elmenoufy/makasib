import { prisma } from "./db";
import type { Vehicle, Shift, Trip, FuelUp, Reminder } from "@prisma/client";
import { estimateDepPerKm, depreciationBasis } from "./depreciation";
import { maintenanceRatePerKm, serviceReminders, type ServiceItem } from "./maintenance";
import { weekRange, weekKey, WEEK_START_HOUR } from "./week";

export type Period = "today" | "week" | "lastWeek" | "month" | "all";

/**
 * Period boundaries. "today" and "week" follow Uber's clock (lib/week.ts): a
 * pay day runs 04:00 → 04:00 and the pay week opens Monday 04:00, so what the
 * dashboard calls "this week" is exactly the week Uber will pay out.
 */
export function periodRange(p: Period, now = new Date()): { from: Date; to: Date } | null {
  if (p === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), WEEK_START_HOUR);
    if (now.getTime() < from.getTime()) from.setDate(from.getDate() - 1);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }
  if (p === "week") {
    const w = weekRange(0, now);
    return { from: w.start, to: w.end };
  }
  if (p === "lastWeek") {
    const w = weekRange(-1, now);
    return { from: w.start, to: w.end };
  }
  if (p === "month") return { from: new Date(now.getTime() - 30 * 86_400_000), to: new Date(now.getTime() + WEEK_MS_SAFETY) };
  return null;
}

const WEEK_MS_SAFETY = 7 * 86_400_000;

export function periodStart(p: Period): Date | null {
  return periodRange(p)?.from ?? null;
}

/** Net money a trip put in the driver's hand: earnings + cash tip. */
export function tripNet(t: Pick<Trip, "fare" | "commission" | "tip">): number {
  return t.fare - (t.commission ?? 0) + t.tip;
}

/** Minutes the rider was on board — the logged duration, else start→end. */
export function tripMinutes(t: Pick<Trip, "durationMin" | "startTime" | "endTime">): number {
  if (t.durationMin != null && t.durationMin > 0) return t.durationMin;
  if (t.endTime) return Math.max(0, (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60_000);
  return 0;
}

// Net-first: entries store the driver's net earnings, so no fee is ever
// estimated. commission is only the explicit cash-reconciliation delta
// (cash collected − net earnings) recorded on cash trips.
export const DEFAULT_COMMISSION_PCT: Record<string, number> = {
  UBER: 0,
  CAREEM: 0,
  INDRIVE: 0,
  BOLT: 0,
  OTHER: 0,
};

export async function getCommissionPcts(): Promise<Record<string, number>> {
  const row = await prisma.setting.findUnique({ where: { key: "commissionPcts" } });
  if (!row) return { ...DEFAULT_COMMISSION_PCT };
  try {
    return { ...DEFAULT_COMMISSION_PCT, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_COMMISSION_PCT };
  }
}

export function tripCommission(trip: Trip, pcts: Record<string, number>): number {
  if (trip.commission != null) return trip.commission;
  const pct = pcts[trip.platform] ?? 0;
  return (trip.fare * pct) / 100;
}

/** Latest known odometer from any source (shifts, fuel-ups, maintenance). */
export async function getLatestOdometer(vehicleId: string): Promise<number> {
  const [veh, sh, fu, mn] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    prisma.shift.findFirst({ where: { vehicleId }, orderBy: { startTime: "desc" } }),
    prisma.fuelUp.findFirst({ where: { vehicleId }, orderBy: { odometer: "desc" } }),
    prisma.maintenance.findFirst({
      where: { vehicleId, odometer: { not: null } },
      orderBy: { odometer: "desc" },
    }),
  ]);
  return Math.max(
    veh?.initialOdometer ?? 0,
    sh?.endOdometer ?? sh?.startOdometer ?? 0,
    fu?.odometer ?? 0,
    mn?.odometer ?? 0
  );
}

export type FuelEconomy = {
  fuelGroup: "PETROL" | "CNG";
  unit: "L" | "m3";
  distanceKm: number; // ALL km in the measured tank windows — the honest denominator
  workKm: number; // the shift-driven portion of distanceKm
  quantity: number;
  spend: number;
  per100: number; // units per 100 km — true consumption
  kmPerUnit: number;
  costPerKm: number; // fuel cost per km actually driven
  workSharePct: number; // what fraction of measured driving was on shift
};

/** Merge completed shifts' [startOdometer, endOdometer] ranges so overlaps
 *  aren't double-counted. */
function mergedShiftRanges(shifts: Shift[]): [number, number][] {
  const ranges = shifts
    .filter((s) => s.endOdometer != null && s.endOdometer > s.startOdometer)
    .map((s): [number, number] => [s.startOdometer, s.endOdometer!])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Km actually driven on a logged shift within [fromOdo, toOdo]. */
function shiftKmInRange(ranges: [number, number][], fromOdo: number, toOdo: number): number {
  let km = 0;
  for (const [s, e] of ranges) {
    const overlapStart = Math.max(s, fromOdo);
    const overlapEnd = Math.min(e, toOdo);
    if (overlapEnd > overlapStart) km += overlapEnd - overlapStart;
  }
  return km;
}

/**
 * Consumption from consecutive FULL-TANK fill-ups per fuel group.
 *
 * The denominator is EVERY km driven in the tank window, not just the
 * shift-driven portion. This is not a scope choice, it's arithmetic: the
 * tank was burned by all the driving between the two fill-ups, so dividing
 * all of that fuel by only the shift km inflates apparent consumption by
 * exactly 1/workShare (a driver whose driving is ~56% shifts sees ~8 L/100km
 * reported as ~14.5 — a real bug this replaces). Fuel economy is a physical
 * property of the car; the engine doesn't know which km were paid.
 *
 * Attributing fuel COST to work is a separate step and still uses shift km:
 * `costPerKm` here is per km actually driven, and getAnalytics multiplies it
 * by shift km so personal driving is never charged to the business.
 *
 * For dual-fuel cars this is an approximation since both fuels share km.
 */
export function fuelEconomy(fuelUps: FuelUp[], shifts: Shift[]): FuelEconomy[] {
  const groups: { key: "PETROL" | "CNG"; unit: "L" | "m3" }[] = [
    { key: "PETROL", unit: "L" },
    { key: "CNG", unit: "m3" },
  ];
  const shiftRanges = mergedShiftRanges(shifts);
  const out: FuelEconomy[] = [];
  for (const g of groups) {
    const ups = fuelUps
      .filter((f) => (g.key === "CNG" ? f.fuelType === "CNG" : f.fuelType.startsWith("PETROL")))
      .sort((a, b) => a.odometer - b.odometer);
    let dist = 0;
    let workDist = 0;
    let qty = 0;
    let spend = 0;
    // anchor windows on consecutive FULL tanks, but a partial fill-up
    // sitting between two fulls still counts toward that window's fuel —
    // skipping it (the old behavior) both broke the whole chain on a
    // single partial fill and silently dropped that fuel from the total
    let lastFullIdx = -1;
    for (let i = 0; i < ups.length; i++) {
      if (!ups[i].fullTank) continue;
      if (lastFullIdx >= 0 && ups[i].odometer > ups[lastFullIdx].odometer) {
        const windowKm = ups[i].odometer - ups[lastFullIdx].odometer;
        let windowQty = 0;
        let windowSpend = 0;
        for (let j = lastFullIdx + 1; j <= i; j++) {
          windowQty += ups[j].quantity;
          windowSpend += ups[j].totalCost;
        }
        dist += windowKm;
        workDist += shiftKmInRange(shiftRanges, ups[lastFullIdx].odometer, ups[i].odometer);
        qty += windowQty;
        spend += windowSpend;
      }
      lastFullIdx = i;
    }
    if (dist > 0 && qty > 0) {
      out.push({
        fuelGroup: g.key,
        unit: g.unit,
        distanceKm: dist,
        workKm: workDist,
        quantity: qty,
        spend,
        per100: (qty / dist) * 100,
        kmPerUnit: dist / qty,
        costPerKm: spend / dist,
        workSharePct: dist > 0 ? (workDist / dist) * 100 : 0,
      });
    }
  }
  return out;
}

/**
 * One row in the "what needs attention" list, flattened so a reminder the
 * driver typed and one derived from their service log render identically —
 * the driver does not care which of the two it came from, only when it is due.
 */
export type ReminderStatus = {
  id: string;
  /** Manual reminders carry their own title; service ones carry a category. */
  title: string | null;
  category: string | null;
  source: "manual" | "service";
  /** changeNow: a part at 90%+ of its interval (service reminders only). */
  state: "overdue" | "changeNow" | "dueSoon" | "ok";
  kmRemaining: number | null;
  daysRemaining: number | null;
  dueOdometer: number | null;
  /** Service reminders only: the interval and how much of it is used up. */
  intervalKm: number | null;
  ratio: number | null;
  maintenanceId: string | null;
  /** Service reminders only: what the part cost last time, to prefill "I changed it". */
  lastCost: number | null;
};

const bySeverity = (a: ReminderStatus, b: ReminderStatus) => {
  const rank = { overdue: 0, changeNow: 1, dueSoon: 2, ok: 3 } as const;
  if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
  return (a.kmRemaining ?? Infinity) - (b.kmRemaining ?? Infinity);
};

export function reminderStatuses(
  reminders: Reminder[],
  currentOdo: number,
  maintenance: ServiceItem[] = []
): ReminderStatus[] {
  const now = Date.now();
  const manual: ReminderStatus[] = reminders
    .filter((r) => r.active)
    .map((r) => {
      const kmRemaining = r.dueOdometer != null ? r.dueOdometer - currentOdo : null;
      const daysRemaining =
        r.dueDate != null ? Math.ceil((new Date(r.dueDate).getTime() - now) / 86_400_000) : null;
      let state: ReminderStatus["state"] = "ok";
      if ((kmRemaining != null && kmRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) {
        state = "overdue";
      } else if (
        (kmRemaining != null && kmRemaining <= 500) ||
        (daysRemaining != null && daysRemaining <= 7)
      ) {
        state = "dueSoon";
      }
      return {
        id: r.id,
        title: r.title,
        category: null,
        source: "manual" as const,
        state,
        kmRemaining,
        daysRemaining,
        dueOdometer: r.dueOdometer,
        intervalKm: r.repeatKm,
        ratio: null,
        maintenanceId: null,
        lastCost: null,
      };
    });

  // free reminders: every serviced part with an interval already knows when
  // it is next due, so nothing here was typed twice (see lib/maintenance.ts)
  const derived: ReminderStatus[] = serviceReminders(maintenance, currentOdo).map((s) => ({
    id: s.id,
    title: null,
    category: s.category,
    source: "service" as const,
    state: s.state,
    kmRemaining: s.kmRemaining,
    daysRemaining: null,
    dueOdometer: s.dueOdometer,
    intervalKm: s.intervalKm,
    ratio: s.ratio,
    maintenanceId: s.maintenanceId,
    lastCost: s.cost,
  }));

  return [...manual, ...derived].sort(bySeverity);
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

/** A named period, or an exact window (income statements, month and year views). */
export type PeriodOrRange = Period | { from: Date; to: Date };

export async function getAnalytics(vehicleId: string, period: PeriodOrRange) {
  const range = typeof period === "string" ? periodRange(period) : period;
  const from = range?.from ?? null;
  const dateFilter = range ? { gte: range.from, lt: range.to } : undefined;

  const [vehicle, shifts, trips, cashTips, fuelUpsAll, maintAll, expenses, reminders, pcts] =
    await Promise.all([
      prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } }),
      prisma.shift.findMany({
        where: { vehicleId, ...(dateFilter ? { startTime: dateFilter } : {}) },
        orderBy: { startTime: "asc" },
      }),
      prisma.trip.findMany({
        where: { vehicleId, ...(dateFilter ? { startTime: dateFilter } : {}) },
      }),
      prisma.cashTip.findMany({
        where: { vehicleId, ...(dateFilter ? { date: dateFilter } : {}) },
      }),
      prisma.fuelUp.findMany({ where: { vehicleId }, orderBy: { odometer: "asc" } }),
      prisma.maintenance.findMany({ where: { vehicleId } }),
      prisma.expense.findMany({
        where: { vehicleId, ...(dateFilter ? { date: dateFilter } : {}) },
      }),
      prisma.reminder.findMany({ where: { vehicleId } }),
      getCommissionPcts(),
    ]);

  // ---- All-time per-km cost rates (stable amortization basis) ----
  const allShifts = await prisma.shift.findMany({ where: { vehicleId } });
  const odoReadings: number[] = [vehicle.initialOdometer];
  for (const s of allShifts) {
    odoReadings.push(s.startOdometer);
    if (s.endOdometer != null) odoReadings.push(s.endOdometer);
  }
  for (const f of fuelUpsAll) odoReadings.push(f.odometer);
  for (const m of maintAll) if (m.odometer != null) odoReadings.push(m.odometer);
  const positive = odoReadings.filter((n) => n > 0);
  const totalKmAllTime =
    positive.length >= 2 ? Math.max(...positive) - Math.min(...positive) : 0;

  const fuelSpendAllTime = fuelUpsAll.reduce((s, f) => s + f.totalCost, 0);
  const maintSpendAllTime = maintAll.reduce((s, m) => s + m.cost, 0);

  // Fuel: prefer the rate measured across complete full-to-full tank windows
  // (see fuelEconomy) — it's per km actually driven and ignores the partial
  // trailing tank. Falls back to all-time spend ÷ all-time km before there
  // are two full tanks to measure between.
  const economy = fuelEconomy(fuelUpsAll, allShifts);
  const measuredFuelCostPerKm =
    economy.length > 0
      ? economy.reduce((s, e) => s + e.spend, 0) / economy.reduce((s, e) => s + e.distanceKm, 0)
      : null;
  const fuelCostPerKm =
    measuredFuelCostPerKm ?? (totalKmAllTime > 0 ? fuelSpendAllTime / totalKmAllTime : 0);

  // Maintenance: each item with a service interval (lifetimeKm) is amortized
  // over that interval — a 4,000 EGP brake job good for 50,000 km costs
  // 0.08 EGP/km, it does not blow a hole in whichever week it was paid.
  // Only the newest record per category is charged: an interval is paid for
  // once, not stacked on every earlier one (see lib/maintenance.ts).
  // Items without an interval keep the all-time averaging.
  const maintCostPerKm = maintenanceRatePerKm(maintAll, totalKmAllTime).perKm;

  const depPerKm = estimateDepPerKm(vehicle);

  // ---- Period shift stats ----
  const completed = shifts.filter((s) => s.endOdometer != null && s.endTime != null);
  const shiftKm = completed.reduce((s, x) => s + (x.endOdometer! - x.startOdometer), 0);
  const hoursWorked = completed.reduce(
    (s, x) => s + (new Date(x.endTime!).getTime() - new Date(x.startTime).getTime()) / 3_600_000,
    0
  );
  const shiftDays = new Set(completed.map((s) => new Date(s.startTime).toDateString())).size;
  // ---- Time split: online (shift) minutes → with a rider / driving to one / idle ----
  const onlineMin = hoursWorked * 60;
  const tripMin = trips.reduce((s, t) => s + tripMinutes(t), 0);
  const pickupMinTotal = trips.reduce((s, t) => s + (t.pickupMin ?? 0), 0);
  const idleMin = Math.max(0, onlineMin - tripMin - pickupMinTotal);
  // calendar span the driving is spread over, so a rate can be expressed per
  // week without pretending every day in the period was a working day
  const shiftTimes = completed.map((s) => new Date(s.startTime).getTime());
  const daysActive =
    shiftTimes.length >= 2
      ? Math.max(1, (Math.max(...shiftTimes) - Math.min(...shiftTimes)) / 86_400_000)
      : shiftTimes.length;

  // ---- Earnings ----
  const fares = trips.reduce((s, t) => s + t.fare, 0);
  const commission = trips.reduce((s, t) => s + tripCommission(t, pcts), 0);
  const tripTips = trips.reduce((s, t) => s + t.tip, 0);
  // platform promotions/quests/boosts arrive as BONUS rows: income like a
  // tip, but shown on their own line
  const bonuses = cashTips.filter((t) => t.kind === "BONUS").reduce((s, t) => s + t.amount, 0);
  const standaloneTips = cashTips.filter((t) => t.kind !== "BONUS").reduce((s, t) => s + t.amount, 0);
  const tips = tripTips + standaloneTips;
  const gross = fares + tips + bonuses;
  const netRevenue = fares - commission + tips + bonuses;

  // ---- Allocated costs (work share) ----
  const allocFuel = fuelCostPerKm * shiftKm;
  const allocMaint = maintCostPerKm * shiftKm;
  const allocDep = depPerKm * shiftKm;
  const workExpenses = expenses.filter((e) => e.isWork).reduce((s, e) => s + e.amount, 0);

  let ownershipCost = 0;
  if (vehicle.ownership === "RENTED" && vehicle.dailyRentalFee) {
    ownershipCost = vehicle.dailyRentalFee * shiftDays;
  } else if (vehicle.ownership === "TARGET" && vehicle.targetOwnerShare) {
    ownershipCost = (fares * vehicle.targetOwnerShare) / 100;
  }

  const trueProfit = netRevenue - allocFuel - allocMaint - allocDep - workExpenses - ownershipCost;
  // Money actually in hand this period. Depreciation is a real cost but not a
  // cash outflow — a driver deciding whether tonight was worth driving needs
  // to see both, not have the cash number silently reduced by an accrual.
  const cashProfit = netRevenue - allocFuel - allocMaint - workExpenses - ownershipCost;

  // ---- Km split ----
  const tripKm = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const deadKm = Math.max(0, shiftKm - tripKm);
  // dead km attributable to driving toward riders (from request-card imports)
  const pickupKm = Math.min(
    deadKm,
    trips.reduce((s, t) => s + (t.pickupKm ?? 0), 0)
  );
  const cruisingKm = Math.max(0, deadKm - pickupKm);
  // total km covered by the period = odometer span of period events
  const periodOdo: number[] = [];
  for (const s of shifts) {
    periodOdo.push(s.startOdometer);
    if (s.endOdometer != null) periodOdo.push(s.endOdometer);
  }
  for (const f of fuelUpsAll) if (!from || new Date(f.date) >= from) periodOdo.push(f.odometer);
  const periodPositive = periodOdo.filter((n) => n > 0);
  const periodTotalKm =
    periodPositive.length >= 2 ? Math.max(...periodPositive) - Math.min(...periodPositive) : shiftKm;
  const personalKm = Math.max(0, periodTotalKm - shiftKm);

  // ---- Daily profit trend (last 14 days, independent of selected period) ----
  const since = new Date(Date.now() - 14 * 86_400_000);
  const [trendShifts, trendTrips, trendTipsRows, trendExpenses] = await Promise.all([
    prisma.shift.findMany({ where: { vehicleId, startTime: { gte: since } } }),
    prisma.trip.findMany({ where: { vehicleId, startTime: { gte: since } } }),
    prisma.cashTip.findMany({ where: { vehicleId, date: { gte: since } } }),
    prisma.expense.findMany({ where: { vehicleId, date: { gte: since }, isWork: true } }),
  ]);
  const days: { date: string; profit: number; gross: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d.getTime() + 86_400_000);
    const inDay = (x: Date | string) => new Date(x) >= d && new Date(x) < next;
    const dTrips = trendTrips.filter((t) => inDay(t.startTime));
    const dShifts = trendShifts.filter((s) => inDay(s.startTime) && s.endOdometer != null);
    const dKm = dShifts.reduce((s, x) => s + (x.endOdometer! - x.startOdometer), 0);
    const dFares = dTrips.reduce((s, t) => s + t.fare, 0);
    const dComm = dTrips.reduce((s, t) => s + tripCommission(t, pcts), 0);
    const dTips =
      dTrips.reduce((s, t) => s + t.tip, 0) +
      trendTipsRows.filter((t) => inDay(t.date)).reduce((s, t) => s + t.amount, 0);
    const dExp = trendExpenses.filter((e) => inDay(e.date)).reduce((s, e) => s + e.amount, 0);
    let dOwn = 0;
    if (vehicle.ownership === "RENTED" && vehicle.dailyRentalFee && dShifts.length > 0) {
      dOwn = vehicle.dailyRentalFee;
    } else if (vehicle.ownership === "TARGET" && vehicle.targetOwnerShare) {
      dOwn = (dFares * vehicle.targetOwnerShare) / 100;
    }
    const dProfit =
      dFares - dComm + dTips - (fuelCostPerKm + maintCostPerKm + depPerKm) * dKm - dExp - dOwn;
    const pad = (n: number) => String(n).padStart(2, "0");
    days.push({
      // local date label — toISOString would shift late-evening days to UTC
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      profit: Math.round(dProfit * 100) / 100,
      gross: Math.round((dFares + dTips) * 100) / 100,
    });
  }

  const currentOdo = await getLatestOdometer(vehicleId);

  return {
    vehicle,
    period,
    currentOdo,
    totalKmAllTime,
    rates: { fuelCostPerKm, maintCostPerKm, depPerKm },
    counts: { shifts: completed.length, trips: trips.length, hoursWorked, shiftDays, daysActive },
    time: {
      onlineMin,
      tripMin,
      pickupMin: pickupMinTotal,
      idleMin,
      // share of online time spent with a rider on board
      utilizationPct: onlineMin > 0 ? (tripMin / onlineMin) * 100 : null,
      perTripMin: trips.length > 0 && tripMin > 0 ? tripMin / trips.length : null,
    },
    earnings: { fares, commission, tips, bonuses, gross, netRevenue },
    costs: {
      // commission kept for the cash panel; NOT a cost row — earnings are net
      commission,
      fuel: allocFuel,
      maintenance: allocMaint,
      depreciation: allocDep,
      workExpenses,
      ownership: ownershipCost,
      total: allocFuel + allocMaint + allocDep + workExpenses + ownershipCost,
    },
    trueProfit,
    cashProfit,
    perHour: hoursWorked > 0 ? trueProfit / hoursWorked : null,
    perKm: shiftKm > 0 ? trueProfit / shiftKm : null,
    kmSplit: { shiftKm, tripKm, deadKm, pickupKm, cruisingKm, personalKm, periodTotalKm },
    fuelEconomy: economy,
    depreciationBasis: depreciationBasis(vehicle),
    reminders: reminderStatuses(reminders, currentOdo, maintAll),
    trend: days,
  };
}

export type ProfileAnalytics = Awaited<ReturnType<typeof getProfileAnalytics>>;

/**
 * Whole-driver-profile view: every active car's analytics for the period,
 * aggregated into fleet totals plus the per-car breakdown that produced
 * them. Weighted perHour/perKm (totals ÷ totals, not an average of ratios)
 * so a car with a handful of hours doesn't skew the fleet rate.
 */
export async function getProfileAnalytics(period: Period) {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true } });
  const perVehicle = await Promise.all(vehicles.map((v) => getAnalytics(v.id, period)));

  const sum = (f: (a: Analytics) => number) => perVehicle.reduce((s, a) => s + f(a), 0);

  const hoursWorked = sum((a) => a.counts.hoursWorked);
  const shiftKm = sum((a) => a.kmSplit.shiftKm);
  const trueProfit = sum((a) => a.trueProfit);

  return {
    period,
    perVehicle,
    totals: {
      earnings: {
        fares: sum((a) => a.earnings.fares),
        commission: sum((a) => a.earnings.commission),
        tips: sum((a) => a.earnings.tips),
        bonuses: sum((a) => a.earnings.bonuses),
        gross: sum((a) => a.earnings.gross),
        netRevenue: sum((a) => a.earnings.netRevenue),
      },
      costs: {
        commission: sum((a) => a.costs.commission),
        fuel: sum((a) => a.costs.fuel),
        maintenance: sum((a) => a.costs.maintenance),
        depreciation: sum((a) => a.costs.depreciation),
        workExpenses: sum((a) => a.costs.workExpenses),
        ownership: sum((a) => a.costs.ownership),
        total: sum((a) => a.costs.total),
      },
      trueProfit,
      perHour: hoursWorked > 0 ? trueProfit / hoursWorked : null,
      perKm: shiftKm > 0 ? trueProfit / shiftKm : null,
      counts: {
        shifts: sum((a) => a.counts.shifts),
        trips: sum((a) => a.counts.trips),
        hoursWorked,
        shiftDays: sum((a) => a.counts.shiftDays),
      },
      kmSplit: {
        shiftKm,
        tripKm: sum((a) => a.kmSplit.tripKm),
        deadKm: sum((a) => a.kmSplit.deadKm),
        pickupKm: sum((a) => a.kmSplit.pickupKm),
        cruisingKm: sum((a) => a.kmSplit.cruisingKm),
        personalKm: sum((a) => a.kmSplit.personalKm),
      },
    },
  };
}

// A trip's timestamp (from an odometer-photo shift, OCR'd request card, or
// earnings-activity screenshot) rarely lines up to the second with the
// shift window it actually belongs to — the driver may start driving a
// couple minutes before taking the start photo, or OCR misreads a clock
// digit. A strict boundary match left real trips permanently orphaned even
// though a shift genuinely covering them existed. Tolerating a few minutes
// on either edge fixes that without meaningfully risking a wrong shift.
const SHIFT_MATCH_TOLERANCE_MS = 15 * 60 * 1000;

/** Attach a trip to the shift whose window contains its start time (within
 *  tolerance) — the closest shift wins when more than one qualifies. */
export async function matchTripToShift(
  vehicleId: string,
  startTime: Date
): Promise<string | null> {
  const t = startTime.getTime();
  const candidates = await prisma.shift.findMany({
    where: {
      vehicleId,
      startTime: { lte: new Date(t + SHIFT_MATCH_TOLERANCE_MS) },
      OR: [{ endTime: null }, { endTime: { gte: new Date(t - SHIFT_MATCH_TOLERANCE_MS) } }],
    },
  });
  if (candidates.length === 0) return null;
  const distance = (s: (typeof candidates)[number]) => {
    const start = s.startTime.getTime();
    const end = s.endTime ? s.endTime.getTime() : Infinity;
    if (t >= start && t <= end) return 0; // inside the actual window — always wins
    return t < start ? start - t : t - end;
  };
  return candidates.sort((a, b) => distance(a) - distance(b))[0].id;
}

export type WeekStat = { weekStart: string; hours: number; profit: number; metGoal: boolean };
export type StreakResult = {
  weeklyHoursGoal: number | null;
  weeklyProfitGoal: number | null;
  thisWeek: { hours: number; profit: number };
  currentStreak: number;
  longestStreak: number;
  weeks: WeekStat[]; // oldest first, most recent (in-progress) week last
};

/**
 * Weekly streak vs. the driver's own goal (Vehicle.weeklyHoursGoal /
 * weeklyProfitGoal) — no goal set means nothing to compare against, so the
 * card stays hidden rather than showing a hollow 0%. Weeks are Uber pay weeks
 * (Monday 04:00 → Monday 04:00, lib/week.ts). The in-progress current week is
 * shown live but excluded from the streak count itself — it can still be met
 * before the week ends.
 */
export async function getStreak(vehicleId: string, weeksBack = 12): Promise<StreakResult | null> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return null;
  if (vehicle.weeklyHoursGoal == null && vehicle.weeklyProfitGoal == null) {
    return {
      weeklyHoursGoal: null,
      weeklyProfitGoal: null,
      thisWeek: { hours: 0, profit: 0 },
      currentStreak: 0,
      longestStreak: 0,
      weeks: [],
    };
  }

  const all = await getAnalytics(vehicleId, "all");
  const { fuelCostPerKm, maintCostPerKm, depPerKm } = all.rates;

  const weeks: WeekStat[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const { start, end } = weekRange(-i);
    const [shifts, trips, tips, expenses] = await Promise.all([
      prisma.shift.findMany({
        where: { vehicleId, startTime: { gte: start, lt: end }, endOdometer: { not: null }, endTime: { not: null } },
      }),
      prisma.trip.findMany({ where: { vehicleId, startTime: { gte: start, lt: end } } }),
      prisma.cashTip.findMany({ where: { vehicleId, date: { gte: start, lt: end } } }),
      prisma.expense.findMany({ where: { vehicleId, date: { gte: start, lt: end }, isWork: true } }),
    ]);
    const hours = shifts.reduce(
      (s, x) => s + (new Date(x.endTime!).getTime() - new Date(x.startTime).getTime()) / 3_600_000,
      0
    );
    const km = shifts.reduce((s, x) => s + (x.endOdometer! - x.startOdometer), 0);
    const fares = trips.reduce((s, t) => s + t.fare, 0);
    const commission = trips.reduce((s, t) => s + (t.commission ?? 0), 0);
    const tripTips = trips.reduce((s, t) => s + t.tip, 0);
    const standaloneTips = tips.reduce((s, t) => s + t.amount, 0);
    const workExp = expenses.reduce((s, e) => s + e.amount, 0);
    let ownershipCost = 0;
    if (vehicle.ownership === "RENTED" && vehicle.dailyRentalFee) {
      const days = new Set(shifts.map((s) => new Date(s.startTime).toDateString())).size;
      ownershipCost = vehicle.dailyRentalFee * days;
    } else if (vehicle.ownership === "TARGET" && vehicle.targetOwnerShare) {
      ownershipCost = (fares * vehicle.targetOwnerShare) / 100;
    }
    const profit =
      fares - commission + tripTips + standaloneTips - (fuelCostPerKm + maintCostPerKm + depPerKm) * km - workExp - ownershipCost;

    const metHours = vehicle.weeklyHoursGoal == null || hours >= vehicle.weeklyHoursGoal;
    const metProfit = vehicle.weeklyProfitGoal == null || profit >= vehicle.weeklyProfitGoal;
    weeks.push({
      weekStart: weekKey(start),
      hours: Math.round(hours * 10) / 10,
      profit: Math.round(profit * 100) / 100,
      metGoal: metHours && metProfit,
    });
  }

  const completedWeeks = weeks.slice(0, -1);
  let currentStreak = 0;
  for (let i = completedWeeks.length - 1; i >= 0; i--) {
    if (completedWeeks[i].metGoal) currentStreak++;
    else break;
  }
  let longestStreak = 0;
  let run = 0;
  for (const w of completedWeeks) {
    if (w.metGoal) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  }

  const thisWeek = weeks[weeks.length - 1];
  return {
    weeklyHoursGoal: vehicle.weeklyHoursGoal,
    weeklyProfitGoal: vehicle.weeklyProfitGoal,
    thisWeek: { hours: thisWeek.hours, profit: thisWeek.profit },
    currentStreak,
    longestStreak,
    weeks,
  };
}

export type PlatformStat = {
  platform: string;
  trips: number;
  netRevenue: number; // fare - commission + tip, i.e. what actually landed in hand
  avgNet: number;
  hours: number; // shift hours weighted by this platform's share of trip revenue in that shift
};

/**
 * Revenue-side breakdown by platform (Trip.platform — UBER/CAREEM/INDRIVE/
 * BOLT/OTHER), for drivers who run more than one app at once. Costs
 * (fuel/maintenance/depreciation) aren't split by platform since a shift's
 * driving isn't attributable to one app — only the earnings side is honest
 * to report per platform; "hours" here is an approximation (each shift's
 * hours split across platforms by revenue share), shown as a rough busyness
 * signal, not a profit-per-platform claim.
 */
export async function getPlatformBreakdown(vehicleId: string, period: Period): Promise<PlatformStat[]> {
  const range = periodRange(period);
  const dateFilter = range ? { gte: range.from, lt: range.to } : undefined;
  const [trips, shifts] = await Promise.all([
    prisma.trip.findMany({ where: { vehicleId, ...(dateFilter ? { startTime: dateFilter } : {}) } }),
    prisma.shift.findMany({
      where: { vehicleId, ...(dateFilter ? { startTime: dateFilter } : {}), endTime: { not: null } },
    }),
  ]);

  const hoursByShift: Record<string, number> = {};
  for (const s of shifts) {
    hoursByShift[s.id] = (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 3_600_000;
  }
  const revenueByShift: Record<string, number> = {};
  for (const t of trips) {
    if (!t.shiftId) continue;
    revenueByShift[t.shiftId] = (revenueByShift[t.shiftId] ?? 0) + (t.fare - (t.commission ?? 0) + t.tip);
  }

  const byPlatform: Record<string, { trips: number; netRevenue: number; hours: number }> = {};
  for (const t of trips) {
    const net = t.fare - (t.commission ?? 0) + t.tip;
    byPlatform[t.platform] ??= { trips: 0, netRevenue: 0, hours: 0 };
    byPlatform[t.platform].trips++;
    byPlatform[t.platform].netRevenue += net;
    if (t.shiftId && hoursByShift[t.shiftId] && revenueByShift[t.shiftId] > 0) {
      byPlatform[t.platform].hours += hoursByShift[t.shiftId] * (net / revenueByShift[t.shiftId]);
    }
  }

  return Object.entries(byPlatform)
    .map(([platform, v]) => ({
      platform,
      trips: v.trips,
      netRevenue: Math.round(v.netRevenue * 100) / 100,
      avgNet: v.trips > 0 ? Math.round((v.netRevenue / v.trips) * 100) / 100 : 0,
      hours: Math.round(v.hours * 10) / 10,
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue);
}
