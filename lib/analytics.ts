import { prisma } from "./db";
import type { Vehicle, Shift, Trip, FuelUp, Reminder } from "@prisma/client";

export type Period = "today" | "week" | "month" | "all";

export function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "week") return new Date(now.getTime() - 7 * 86_400_000);
  if (p === "month") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

export const DEFAULT_COMMISSION_PCT: Record<string, number> = {
  UBER: 25,
  CAREEM: 25,
  INDRIVE: 12,
  BOLT: 20,
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

/**
 * Consumption from consecutive FULL-TANK fill-ups per fuel group.
 * For dual-fuel cars this is an approximation since both fuels share km.
 */
export function fuelEconomy(fuelUps: FuelUp[]): FuelEconomy[] {
  const groups: { key: "PETROL" | "CNG"; unit: "L" | "m3" }[] = [
    { key: "PETROL", unit: "L" },
    { key: "CNG", unit: "m3" },
  ];
  const out: FuelEconomy[] = [];
  for (const g of groups) {
    const ups = fuelUps
      .filter((f) => (g.key === "CNG" ? f.fuelType === "CNG" : f.fuelType.startsWith("PETROL")))
      .sort((a, b) => a.odometer - b.odometer);
    let dist = 0;
    let qty = 0;
    let spend = ups.reduce((s, f) => s + f.totalCost, 0);
    for (let i = 1; i < ups.length; i++) {
      // distance since previous fill is "paid for" by the current fill's quantity
      if (ups[i].fullTank && ups[i - 1].fullTank && ups[i].odometer > ups[i - 1].odometer) {
        dist += ups[i].odometer - ups[i - 1].odometer;
        qty += ups[i].quantity;
      }
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
        costPerKm:
          // cost/km from the same full-to-full windows
          qty > 0 ? (ups.filter((u) => u.fullTank).length > 1 ? spendOverWindows(ups) / dist : spend / dist) : 0,
      });
    }
  }
  return out;
}

function spendOverWindows(ups: FuelUp[]): number {
  let spend = 0;
  for (let i = 1; i < ups.length; i++) {
    if (ups[i].fullTank && ups[i - 1].fullTank && ups[i].odometer > ups[i - 1].odometer) {
      spend += ups[i].totalCost;
    }
  }
  return spend;
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
  const odoReadings: number[] = [vehicle.initialOdometer];
  for (const s of await prisma.shift.findMany({ where: { vehicleId } })) {
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
  const depPerKm = vehicle.depreciationPerKm ?? 0;

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

  // ---- Cash reconciliation per platform ----
  const platforms = [...new Set(trips.map((t) => t.platform))];
  const cashByPlatform = platforms.map((p) => {
    const pt = trips.filter((t) => t.platform === p);
    const oweToPlatform = pt
      .filter((t) => t.paymentType === "CASH")
      .reduce((s, t) => s + tripCommission(t, pcts), 0);
    const platformOwes = pt
      .filter((t) => t.paymentType === "CARD")
      .reduce((s, t) => s + (t.fare - tripCommission(t, pcts)), 0);
    return { platform: p, oweToPlatform, platformOwes, net: platformOwes - oweToPlatform };
  });
  const cashTotals = {
    oweToPlatform: cashByPlatform.reduce((s, x) => s + x.oweToPlatform, 0),
    platformOwes: cashByPlatform.reduce((s, x) => s + x.platformOwes, 0),
    net: cashByPlatform.reduce((s, x) => s + x.net, 0),
  };

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
      commission,
      fuel: allocFuel,
      maintenance: allocMaint,
      depreciation: allocDep,
      workExpenses,
      ownership: ownershipCost,
      total: commission + allocFuel + allocMaint + allocDep + workExpenses + ownershipCost,
    },
    trueProfit,
    perHour: hoursWorked > 0 ? trueProfit / hoursWorked : null,
    perKm: shiftKm > 0 ? trueProfit / shiftKm : null,
    kmSplit: { shiftKm, tripKm, deadKm, personalKm, periodTotalKm },
    fuelEconomy: fuelEconomy(fuelUpsAll),
    cash: { byPlatform: cashByPlatform, totals: cashTotals },
    reminders: reminderStatuses(reminders, currentOdo),
    trend: days,
  };
}

/** Attach a trip to the shift whose time window contains its start time. */
export async function matchTripToShift(
  vehicleId: string,
  startTime: Date
): Promise<string | null> {
  const shift = await prisma.shift.findFirst({
    where: {
      vehicleId,
      startTime: { lte: startTime },
      OR: [{ endTime: null }, { endTime: { gte: startTime } }],
    },
    orderBy: { startTime: "desc" },
  });
  return shift?.id ?? null;
}
