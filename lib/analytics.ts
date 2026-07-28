import { prisma } from "./db";
import type { Vehicle, Shift, Trip, FuelUp, Reminder } from "@prisma/client";
import { estimateDepPerKm, annualizedKm } from "./depreciation";

export type Period = "today" | "week" | "month" | "all";

export function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "week") return new Date(now.getTime() - 7 * 86_400_000);
  if (p === "month") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
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
  distanceKm: number;
  quantity: number;
  spend: number;
  per100: number; // units per 100 km
  kmPerUnit: number;
  costPerKm: number;
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
 * Consumption from consecutive FULL-TANK fill-ups per fuel group, counting
 * only the shift-km portion of each fill-to-fill odometer window — Makasib
 * tracks ride-hailing profitability, not personal driving, so a tank burned
 * partly on personal trips must not make the car look more fuel-efficient
 * (or cheaper per km) for work than it really is.
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
        const windowShiftKm = shiftKmInRange(shiftRanges, ups[lastFullIdx].odometer, ups[i].odometer);
        if (windowShiftKm > 0) {
          let windowQty = 0;
          let windowSpend = 0;
          for (let j = lastFullIdx + 1; j <= i; j++) {
            windowQty += ups[j].quantity;
            windowSpend += ups[j].totalCost;
          }
          dist += windowShiftKm;
          qty += windowQty;
          spend += windowSpend;
        }
      }
      lastFullIdx = i;
    }
    if (dist > 0 && qty > 0) {
      out.push({
        fuelGroup: g.key,
        unit: g.unit,
        distanceKm: dist,
        quantity: qty,
        spend,
        per100: (qty / dist) * 100,
        kmPerUnit: dist / qty,
        costPerKm: spend / dist,
      });
    }
  }
  return out;
}

export type ReminderStatus = {
  reminder: Reminder;
  state: "overdue" | "dueSoon" | "ok";
  kmRemaining: number | null;
  daysRemaining: number | null;
};

export function reminderStatuses(reminders: Reminder[], currentOdo: number): ReminderStatus[] {
  const now = Date.now();
  return reminders
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
      return { reminder: r, state, kmRemaining, daysRemaining };
    })
    .sort((a, b) => (a.state === "overdue" ? -1 : a.state === "dueSoon" && b.state === "ok" ? -1 : 1));
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export async function getAnalytics(vehicleId: string, period: Period) {
  const from = periodStart(period);
  const dateFilter = from ? { gte: from } : undefined;

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
  const fuelCostPerKm = totalKmAllTime > 0 ? fuelSpendAllTime / totalKmAllTime : 0;
  const maintCostPerKm = totalKmAllTime > 0 ? maintSpendAllTime / totalKmAllTime : 0;
  const depPerKm = estimateDepPerKm(
    vehicle,
    annualizedKm(totalKmAllTime, vehicle.createdAt)
  );

  // ---- Period shift stats ----
  const completed = shifts.filter((s) => s.endOdometer != null && s.endTime != null);
  const shiftKm = completed.reduce((s, x) => s + (x.endOdometer! - x.startOdometer), 0);
  const hoursWorked = completed.reduce(
    (s, x) => s + (new Date(x.endTime!).getTime() - new Date(x.startTime).getTime()) / 3_600_000,
    0
  );
  const shiftDays = new Set(completed.map((s) => new Date(s.startTime).toDateString())).size;

  // ---- Earnings ----
  const fares = trips.reduce((s, t) => s + t.fare, 0);
  const commission = trips.reduce((s, t) => s + tripCommission(t, pcts), 0);
  const tripTips = trips.reduce((s, t) => s + t.tip, 0);
  const standaloneTips = cashTips.reduce((s, t) => s + t.amount, 0);
  const tips = tripTips + standaloneTips;
  const gross = fares + tips;
  const netRevenue = fares - commission + tips;

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
    counts: { shifts: completed.length, trips: trips.length, hoursWorked, shiftDays },
    earnings: { fares, commission, tips, gross, netRevenue },
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
    perHour: hoursWorked > 0 ? trueProfit / hoursWorked : null,
    perKm: shiftKm > 0 ? trueProfit / shiftKm : null,
    kmSplit: { shiftKm, tripKm, deadKm, pickupKm, cruisingKm, personalKm, periodTotalKm },
    fuelEconomy: fuelEconomy(fuelUpsAll, allShifts),
    reminders: reminderStatuses(reminders, currentOdo),
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

/**
 * Sweep orphaned trips (shiftId null — e.g. logged before their shift
 * existed, or left behind when a shift was deleted and later re-created)
 * into a shift whose time window now covers them (within tolerance). Runs
 * after every shift create/update so the two sides of the app stay in sync
 * without the driver having to manually re-link anything.
 */
export async function reconcileShiftTrips(vehicleId: string, shiftId: string): Promise<number> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return 0;
  const { count } = await prisma.trip.updateMany({
    where: {
      vehicleId,
      shiftId: null,
      startTime: {
        gte: new Date(shift.startTime.getTime() - SHIFT_MATCH_TOLERANCE_MS),
        ...(shift.endTime ? { lte: new Date(shift.endTime.getTime() + SHIFT_MATCH_TOLERANCE_MS) } : {}),
      },
    },
    data: { shiftId },
  });
  return count;
}

/**
 * Full data-health sweep for one vehicle: every orphaned trip (shiftId
 * null) gets one more chance at matchTripToShift's tolerant window. Unlike
 * reconcileShiftTrips (triggered by a specific shift changing), this is the
 * "check everything, not just what just changed" pass — the periodic
 * health check and the manual "run now" button both call this.
 */
export async function reconcileOrphanTrips(vehicleId: string): Promise<number> {
  const orphans = await prisma.trip.findMany({ where: { vehicleId, shiftId: null } });
  let fixed = 0;
  for (const trip of orphans) {
    const shiftId = await matchTripToShift(vehicleId, trip.startTime);
    if (shiftId) {
      await prisma.trip.update({ where: { id: trip.id }, data: { shiftId } });
      fixed++;
    }
  }
  return fixed;
}

/** Same sweep across every vehicle — used by the lazy periodic health check. */
export async function reconcileAllVehicles(): Promise<number> {
  const vehicles = await prisma.vehicle.findMany({ select: { id: true } });
  let total = 0;
  for (const v of vehicles) total += await reconcileOrphanTrips(v.id);
  return total;
}
