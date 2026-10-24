// Fuel-up insights that need the fill-up history, not just the averages:
// whether consumption has drifted up lately (a dragging brake, a clogged
// air filter, soft tyres all show here first), and what natural gas saves a
// dual-fuel car. Pure — runs on the fuel page and in the notification check.

export type FuelUpLite = { odometer: number; fuelType: string; quantity: number; totalCost: number; pricePerUnit: number; fullTank: boolean; date: string | Date };
export type TankWindow = { toOdometer: number; km: number; qty: number; spend: number; per100: number };

const isCng = (t: string) => t === "CNG";

/** Consumption per full-to-full window, oldest first (same rule as lib/analytics fuelEconomy). */
export function tankWindows(ups: FuelUpLite[], group: "PETROL" | "CNG"): TankWindow[] {
  const list = ups.filter((u) => (group === "CNG" ? isCng(u.fuelType) : !isCng(u.fuelType))).sort((a, b) => a.odometer - b.odometer);
  const out: TankWindow[] = [];
  let last = -1;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].fullTank) continue;
    if (last >= 0 && list[i].odometer > list[last].odometer) {
      let qty = 0;
      let spend = 0;
      for (let j = last + 1; j <= i; j++) {
        qty += list[j].quantity;
        spend += list[j].totalCost;
      }
      const km = list[i].odometer - list[last].odometer;
      // a window under 80 km is mostly measurement noise (a top-up not marked partial)
      if (km >= 80 && qty > 0) out.push({ toOdometer: list[i].odometer, km, qty, spend, per100: (qty / km) * 100 });
    }
    last = i;
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const DRIFT_WARN = 0.12;

export type EconomyDrift = { recent: number; usual: number; pct: number; sinceOdometer: number } | null;

/**
 * The last two tanks against the driver's usual (median of the tanks
 * before). Null until there are at least three earlier tanks to compare
 * with — a warning needs a baseline, not a guess.
 */
export function economyDrift(windows: TankWindow[]): EconomyDrift {
  if (windows.length < 5) return null;
  const recent = windows.slice(-2);
  const before = windows.slice(-12, -2);
  const usual = median(before.map((w) => w.per100));
  const r = (recent[0].qty + recent[1].qty) / (recent[0].km + recent[1].km) * 100;
  if (usual <= 0) return null;
  return { recent: r, usual, pct: r / usual - 1, sinceOdometer: recent[0].toOdometer - recent[0].km };
}

export type CngSavings = {
  petrolPerKm: number;
  cngPerKm: number;
  savedPerKm: number;
  /** km run on gas, from measured gas tanks' consumption. */
  cngKm: number;
  savedSoFar: number;
} | null;

/** Dual-fuel only: both fuels' cost per km at today's prices, and what gas has saved. */
export function cngSavings(ups: FuelUpLite[]): CngSavings {
  const p = tankWindows(ups, "PETROL");
  const c = tankWindows(ups, "CNG");
  if (p.length === 0 || c.length === 0) return null;
  const latest = (g: "PETROL" | "CNG") =>
    ups.filter((u) => (g === "CNG" ? isCng(u.fuelType) : !isCng(u.fuelType))).sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.pricePerUnit ?? 0;
  const pPer = p.reduce((s, w) => s + w.qty, 0) / p.reduce((s, w) => s + w.km, 0);
  const cPer = c.reduce((s, w) => s + w.qty, 0) / c.reduce((s, w) => s + w.km, 0);
  const petrolPerKm = pPer * latest("PETROL");
  const cngPerKm = cPer * latest("CNG");
  const gasQty = ups.filter((u) => isCng(u.fuelType)).reduce((s, u) => s + u.quantity, 0);
  const cngKm = cPer > 0 ? gasQty / cPer : 0;
  const savedPerKm = petrolPerKm - cngPerKm;
  return { petrolPerKm, cngPerKm, savedPerKm, cngKm, savedSoFar: Math.max(0, savedPerKm) * cngKm };
}
