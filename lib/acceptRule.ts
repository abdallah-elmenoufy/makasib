// A personal accept rule: two numbers a driver can hold in their head for
// the ten seconds an offer is on screen — "at least EGP X per km, counting
// the drive to the pickup" and "no pickups further than Y km". Suggested
// from the driver's own costs and earnings; theirs to change.

export type AcceptRule = { minPerKm: number; maxPickupKm: number };

/**
 * The fare per km at which an offer still earns 75% of the driver's usual
 * profit per hour — the same line the offer score draws between "ok" and
 * "bad". Needs the driver's cost per km, profit per hour, and the speed of
 * their trips (pickup included). Rounded up to the next half pound.
 */
export function suggestMinPerKm(costPerKm: number, profitPerHour: number | null, kmPerHour: number | null): number | null {
  if (profitPerHour == null || profitPerHour <= 0 || kmPerHour == null || kmPerHour <= 0) return null;
  return Math.ceil((costPerKm + (0.75 * profitPerHour) / kmPerHour) * 2) / 2;
}

/** The smallest fare the rule accepts for a given pickup + trip. */
export const minFare = (rule: AcceptRule, pickupKm: number, tripKm: number) => rule.minPerKm * (pickupKm + tripKm);

export function checkRule(rule: AcceptRule, offer: { fare: number; pickupKm: number; tripKm: number }): { ok: boolean; perKm: number; pickupTooFar: boolean; fareTooLow: boolean } {
  const km = offer.pickupKm + offer.tripKm;
  const perKm = km > 0 ? offer.fare / km : 0;
  const pickupTooFar = offer.pickupKm > rule.maxPickupKm;
  const fareTooLow = perKm < rule.minPerKm;
  return { ok: !pickupTooFar && !fareTooLow, perKm, pickupTooFar, fareTooLow };
}
