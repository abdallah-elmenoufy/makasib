// Odometer helpers shared by the server (lib/drive.ts) and the tests.
// Pure functions: no database, no clock.

export type OdoShift = { id: string; startOdometer: number; endOdometer?: number | null; gpsKm?: number | null };
export type OdoTrip = { shiftId?: string | null; distanceKm?: number | null; pickupKm?: number | null };
export type EndOdoSuggestion = { value: number; basis: "gps" | "ratio" | "trips" };

/**
 * Best guess at the end-odometer so the driver can confirm a number instead
 * of squinting at the dash while parked.
 *
 * Priority is by how much the source actually knows:
 *  1. GPS distance recorded during the shift — measured, not inferred.
 *  2. Trip km + pickup km, scaled up by this driver's own historical ratio
 *     of shift km to trip km. That ratio captures their cruising/dead km
 *     habit, and self-corrects as they log more shifts.
 *  3. Raw trip km + pickup km — a floor, since cruising is never negative.
 * Returns null when there's nothing to base a guess on: a wrong prefill is
 * worse than an empty box, because odometer readings drive every km cost.
 */
export function suggestEndOdometer(active: OdoShift, trips: OdoTrip[], completed: OdoShift[]): EndOdoSuggestion | null {
  if (active.gpsKm && active.gpsKm > 0) {
    return { value: Math.round(active.startOdometer + active.gpsKm), basis: "gps" };
  }
  const kmOf = (shiftId: string) =>
    trips.filter((tr) => tr.shiftId === shiftId).reduce((s, tr) => s + (tr.distanceKm ?? 0) + (tr.pickupKm ?? 0), 0);

  const tripKm = kmOf(active.id);
  if (tripKm <= 0) return null;

  // historical shiftKm / tripKm across completed shifts that have both
  let histShift = 0;
  let histTrip = 0;
  for (const s of completed) {
    const k = kmOf(s.id);
    if (k > 0 && s.endOdometer != null) {
      histShift += s.endOdometer - s.startOdometer;
      histTrip += k;
    }
  }
  // clamp: a ratio below 1 would mean driving less than the trips themselves
  const ratio = histTrip > 0 ? Math.min(Math.max(histShift / histTrip, 1), 2.5) : null;
  return ratio
    ? { value: Math.round(active.startOdometer + tripKm * ratio), basis: "ratio" }
    : { value: Math.round(active.startOdometer + tripKm), basis: "trips" };
}

/**
 * The reading a new shift most likely starts from: where the last shift
 * ended (the car was parked), else the car's starting odometer. Never lower
 * than any reading already on record.
 */
export function startOdometerGuess(lastEnd: number | null | undefined, initial: number | null | undefined): number | null {
  const v = Math.max(lastEnd ?? 0, initial ?? 0);
  return v > 0 ? Math.round(v) : null;
}
