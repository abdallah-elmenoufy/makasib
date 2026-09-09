// Service-life model for maintenance items. Pure — no DB, so both the
// analytics cost model (server) and the Maintenance page (client) use the
// same definition of "this part is still in service".
//
// A part logged with a service interval (Maintenance.lifetimeKm) starts
// being consumed at the odometer reading it was fitted at, and is used up
// `lifetimeKm` later. Two things follow, and the app needs both:
//
//  1. The driver wants to SEE how much of the interval is gone — "the brakes
//     have done 2,849 of their 50,000 km" — which is what the bars on the
//     Maintenance page draw.
//  2. The cost model must charge each interval ONCE. Summing cost/lifetimeKm
//     over every record ever logged charges the last oil change forever and
//     then stacks the next one on top of it: after five 8,000 km oil changes
//     the rate reads 5 × 0.19 = 0.94 EGP/km instead of 0.19, and every
//     profit number in the app shrinks with it. Only the newest record in a
//     category is still being consumed; the ones it replaced are done.

export type ServiceItem = {
  id: string;
  category: string;
  date: Date | string;
  odometer: number | null;
  cost: number;
  lifetimeKm: number | null;
};

/** Fraction of the interval at which a part starts being flagged. */
export const DUE_SOON_RATIO = 0.85;

const time = (d: Date | string) => new Date(d).getTime();

export function hasInterval(m: ServiceItem): boolean {
  return m.lifetimeKm != null && m.lifetimeKm > 0;
}

/**
 * The records still being consumed: for every category, the most recent
 * one(s) with a service interval. Same-date records in a category all stay
 * (an oil change and its filter logged together must not cancel each other),
 * only genuinely older ones drop out.
 */
export function inServiceItems<T extends ServiceItem>(items: T[]): T[] {
  const withInterval = items.filter(hasInterval);
  const newest = new Map<string, number>();
  for (const m of withInterval) {
    newest.set(m.category, Math.max(newest.get(m.category) ?? -Infinity, time(m.date)));
  }
  return withInterval.filter((m) => time(m.date) >= (newest.get(m.category) ?? 0));
}

export type ServiceState = "ok" | "dueSoon" | "overdue" | "replaced" | "unknown";

export type ServiceProgress = {
  /** km driven on this part since it was fitted. */
  kmUsed: number | null;
  /** km left before it is due; negative once the interval is exceeded. */
  kmRemaining: number | null;
  /** 0..1 and beyond — deliberately uncapped so overdue is visible. */
  ratio: number | null;
  state: ServiceState;
};

const UNKNOWN: ServiceProgress = { kmUsed: null, kmRemaining: null, ratio: null, state: "unknown" };

/**
 * How far through its service interval a part is. `replaced` means a newer
 * record in the same category has taken over — the bar would be meaningless,
 * so the UI shows the badge instead.
 */
export function serviceProgress(
  item: ServiceItem,
  currentOdo: number,
  isInService = true
): ServiceProgress {
  if (!hasInterval(item)) return UNKNOWN;
  if (!isInService) return { ...UNKNOWN, state: "replaced" };
  if (item.odometer == null || item.odometer <= 0 || currentOdo <= 0) return UNKNOWN;

  const life = item.lifetimeKm!;
  const kmUsed = Math.max(0, currentOdo - item.odometer);
  const ratio = kmUsed / life;
  return {
    kmUsed,
    kmRemaining: life - kmUsed,
    ratio,
    state: ratio >= 1 ? "overdue" : ratio >= DUE_SOON_RATIO ? "dueSoon" : "ok",
  };
}

/** A part is flagged this close to its interval regardless of percentage —
 *  matching the absolute threshold manual reminders already use. */
const DUE_SOON_KM = 500;

export type ServiceDue = {
  /** Namespaced so it can never collide with a real Reminder row's id. */
  id: string;
  maintenanceId: string;
  category: string;
  /** Odometer the part was fitted at, and the one it is due at. */
  fittedOdometer: number;
  dueOdometer: number;
  intervalKm: number;
  kmRemaining: number;
  ratio: number;
  state: "ok" | "dueSoon" | "overdue";
  cost: number;
  date: string;
};

/**
 * Service reminders the driver never has to type.
 *
 * Every maintenance record already carries the two numbers a reminder needs
 * — the odometer it was done at and how long it lasts — so the reminder is
 * just those numbers read back: brakes fitted at 246,170 with a 50,000 km
 * interval are due at 296,170. Deriving rather than writing a Reminder row
 * means there is nothing to keep in sync: edit the service entry and the
 * reminder moves with it, log the next service and the old one retires by
 * itself (`inServiceItems`).
 */
export function serviceReminders(items: ServiceItem[], currentOdo: number): ServiceDue[] {
  if (currentOdo <= 0) return [];
  return inServiceItems(items)
    .filter((m) => m.odometer != null && m.odometer > 0)
    .map((m) => {
      const intervalKm = m.lifetimeKm!;
      const fittedOdometer = m.odometer!;
      const dueOdometer = fittedOdometer + intervalKm;
      const kmRemaining = dueOdometer - currentOdo;
      const ratio = Math.max(0, currentOdo - fittedOdometer) / intervalKm;
      return {
        id: `svc:${m.id}`,
        maintenanceId: m.id,
        category: m.category,
        fittedOdometer,
        dueOdometer,
        intervalKm,
        kmRemaining,
        ratio,
        state:
          kmRemaining <= 0
            ? ("overdue" as const)
            : kmRemaining <= DUE_SOON_KM || ratio >= DUE_SOON_RATIO
              ? ("dueSoon" as const)
              : ("ok" as const),
        cost: m.cost,
        date: new Date(m.date).toISOString(),
      };
    })
    .sort((a, b) => a.kmRemaining - b.kmRemaining);
}

export type MaintenanceRate = {
  /** EGP per km: in-service intervals + all-time average of the rest. */
  perKm: number;
  /** The amortized half on its own, for showing the working. */
  amortizedPerKm: number;
  /** Spend on records with no interval, averaged over totalKm. */
  unamortizedSpend: number;
};

/**
 * The maintenance rate every profit figure in the app is built on. Records
 * with an interval are charged over that interval (once — see
 * `inServiceItems`); records without one fall back to all-time averaging,
 * which is the honest treatment for a one-off repair.
 */
export function maintenanceRatePerKm(items: ServiceItem[], totalKm: number): MaintenanceRate {
  const live = new Set(inServiceItems(items).map((m) => m.id));
  let amortizedPerKm = 0;
  let unamortizedSpend = 0;
  for (const m of items) {
    if (hasInterval(m)) {
      if (live.has(m.id)) amortizedPerKm += m.cost / m.lifetimeKm!;
    } else {
      unamortizedSpend += m.cost;
    }
  }
  return {
    perKm: amortizedPerKm + (totalKm > 0 ? unamortizedSpend / totalKm : 0),
    amortizedPerKm,
    unamortizedSpend,
  };
}
