import { prisma } from "./db";
import { getAnalytics } from "./analytics";

/**
 * "What do I need to make today?"
 *
 * Every other screen in the app looks backwards. This one is the only number
 * a driver can act on before they turn the key, and it is built entirely from
 * their own history — no generic target, no invented benchmark:
 *
 *   cost per hour  = (fuel + maintenance + depreciation per km) × your km/h
 *   break-even     = cost per hour × the hours you plan to drive
 *                    + the fixed cost of putting the car on the road today
 *   target         = your own usual hourly rate over those same hours, or
 *                    your weekly goal split across the days you work
 *
 * Median, not mean, for "typical": one 900 EGP private job should not move
 * the bar the driver is asked to clear every day.
 */

export type DailyTarget = {
  plannedHours: number;
  /** Whether plannedHours came from the caller or from the driver's history. */
  plannedHoursSource: "requested" | "typical";
  kmPerHour: number | null;
  costPerKm: number;
  costPerHour: number | null;
  /** Costs owed for the day before a single km is driven (rental, average
   *  daily running expenses). Not km-dependent. */
  fixedDailyCost: number;
  breakEvenRevenue: number;
  /** Median net revenue per hour on the days this driver actually worked. */
  typicalHourly: number | null;
  /** That rate over the hours planned — a normal day of this length. */
  typicalDayRevenue: number | null;
  /** Break-even plus the daily share of Vehicle.weeklyProfitGoal, if set. */
  goalDayRevenue: number | null;
  targetRevenue: number;
  targetSource: "goal" | "typical" | "breakEven";
  today: {
    netRevenue: number;
    cashProfit: number;
    hours: number;
    km: number;
    trips: number;
  };
  /** Net revenue per hour needed across the hours still left in the plan. */
  perHourNeeded: number | null;
  hoursLeft: number;
  /** False while there is too little history to state a rate honestly. */
  hasBasis: boolean;
};

const dayKey = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function getDailyTarget(vehicleId: string, requestedHours?: number): Promise<DailyTarget> {
  const [all, today, shifts, trips, cashTips] = await Promise.all([
    getAnalytics(vehicleId, "all"),
    getAnalytics(vehicleId, "today"),
    prisma.shift.findMany({
      where: { vehicleId, endTime: { not: null }, endOdometer: { not: null } },
    }),
    prisma.trip.findMany({ where: { vehicleId } }),
    prisma.cashTip.findMany({ where: { vehicleId } }),
  ]);

  // ---- what a working day has historically looked like ----
  const workDays = new Set(shifts.map((s) => dayKey(s.startTime)));
  const revenueByDay = new Map<string, number>();
  const hoursByDay = new Map<string, number>();
  for (const s of shifts) {
    const k = dayKey(s.startTime);
    const h = (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 3_600_000;
    hoursByDay.set(k, (hoursByDay.get(k) ?? 0) + h);
  }
  for (const t of trips) {
    const k = dayKey(t.startTime);
    if (!workDays.has(k)) continue;
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + (t.fare - (t.commission ?? 0) + t.tip));
  }
  for (const tip of cashTips) {
    const k = dayKey(tip.date);
    if (!workDays.has(k)) continue;
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + tip.amount);
  }

  const typicalHours = median([...hoursByDay.values()]) ?? 4;
  // a rate, not a fixed daily figure: the target has to answer the hours the
  // driver actually plans to do, so a 6-hour day is not held to the bar a
  // 2-hour day set. Days under half an hour are excluded — dividing a real
  // fare by a rounding error invents an enormous hourly rate.
  const hourlyByDay: number[] = [];
  for (const [day, revenue] of revenueByDay) {
    const hours = hoursByDay.get(day);
    if (hours != null && hours >= 0.5) hourlyByDay.push(revenue / hours);
  }
  const typicalHourly = median(hourlyByDay);

  // ---- rates ----
  const { fuelCostPerKm, maintCostPerKm, depPerKm } = all.rates;
  const costPerKm = fuelCostPerKm + maintCostPerKm + depPerKm;
  const kmPerHour =
    all.counts.hoursWorked > 0 ? all.kmSplit.shiftKm / all.counts.hoursWorked : null;
  const costPerHour = kmPerHour != null ? costPerKm * kmPerHour : null;

  const plannedHours =
    requestedHours != null && Number.isFinite(requestedHours) && requestedHours > 0
      ? requestedHours
      : Math.max(1, Math.round(typicalHours * 2) / 2);

  // ---- fixed costs of putting the car on the road today ----
  const workingDays = Math.max(1, all.counts.shiftDays);
  const avgDailyExpenses = all.costs.workExpenses / workingDays;
  const vehicle = all.vehicle;
  const rental =
    vehicle.ownership === "RENTED" && vehicle.dailyRentalFee ? vehicle.dailyRentalFee : 0;
  const fixedDailyCost = rental + avgDailyExpenses;

  const variableCost = (costPerHour ?? 0) * plannedHours;
  // TARGET cars owe the owner a share of revenue, so break-even is the point
  // where what is left after that share covers the running costs
  const ownerShare =
    vehicle.ownership === "TARGET" && vehicle.targetOwnerShare
      ? Math.min(0.95, vehicle.targetOwnerShare / 100)
      : 0;
  const breakEvenRevenue = (variableCost + fixedDailyCost) / (1 - ownerShare);

  // ---- the bar to aim at ----
  const typicalDayRevenue = typicalHourly != null ? typicalHourly * plannedHours : null;
  const weeksWorked = all.counts.daysActive > 0 ? all.counts.daysActive / 7 : 0;
  const daysPerWeek = weeksWorked > 0 ? Math.max(1, all.counts.shiftDays / weeksWorked) : null;
  const goalDayRevenue =
    vehicle.weeklyProfitGoal != null && vehicle.weeklyProfitGoal > 0 && daysPerWeek != null
      ? breakEvenRevenue + vehicle.weeklyProfitGoal / daysPerWeek
      : null;

  let targetRevenue = breakEvenRevenue;
  let targetSource: DailyTarget["targetSource"] = "breakEven";
  if (goalDayRevenue != null) {
    targetRevenue = goalDayRevenue;
    targetSource = "goal";
  } else if (typicalDayRevenue != null && typicalDayRevenue > breakEvenRevenue) {
    targetRevenue = typicalDayRevenue;
    targetSource = "typical";
  }

  const todayHours = today.counts.hoursWorked;
  const hoursLeft = Math.max(0, plannedHours - todayHours);
  const remaining = Math.max(0, targetRevenue - today.earnings.netRevenue);

  return {
    plannedHours,
    plannedHoursSource: requestedHours != null && requestedHours > 0 ? "requested" : "typical",
    kmPerHour,
    costPerKm,
    costPerHour,
    fixedDailyCost,
    breakEvenRevenue,
    typicalHourly,
    typicalDayRevenue,
    goalDayRevenue,
    targetRevenue,
    targetSource,
    today: {
      netRevenue: today.earnings.netRevenue,
      cashProfit: today.cashProfit,
      hours: todayHours,
      km: today.kmSplit.shiftKm,
      trips: today.counts.trips,
    },
    perHourNeeded: hoursLeft > 0 ? remaining / hoursLeft : null,
    hoursLeft,
    hasBasis: kmPerHour != null && all.counts.shifts >= 3,
  };
}
