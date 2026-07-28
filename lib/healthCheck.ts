import "server-only";
import { reconcileAllVehicles } from "./analytics";

let lastRun = 0;

/**
 * Cheap lazy scheduler (same pattern as lib/purge.ts's photo purge):
 * piggybacks on normal traffic, runs at most every 2h, sweeps every
 * vehicle's orphaned trips back onto a covering shift. This is the "keeps
 * checking on its own" half of trip/shift reconciliation — the other half
 * (reconcileShiftTrips) fires immediately on every shift create/update, but
 * this periodic sweep catches anything that still slips through (e.g. a
 * trip imported after the fact whose timestamp only barely missed a
 * shift's tolerance window at the time).
 */
export function maybeReconcileTrips(): void {
  const now = Date.now();
  if (now - lastRun < 2 * 3_600_000) return;
  lastRun = now;
  reconcileAllVehicles()
    .then((n) => n > 0 && console.log(`health check: reconciled ${n} orphaned trip(s)`))
    .catch((e) => console.error("trip/shift health check failed:", e));
}
