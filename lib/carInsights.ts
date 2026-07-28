import type { VehicleSummary } from "./vehicleSummary";
import type { ProfileAnalytics } from "./analytics";

export type CarInsight = {
  kind: "bestPerformer" | "idle" | "paidForItself" | "roiProgress" | "negativeProfit";
  vehicleId: string;
  vehicleName: string;
  // interpolation vars for the i18n message template (see lib/i18n/messages.ts)
  vars?: Record<string, string | number>;
};

const MIN_SHIFTS_FOR_COMPARISON = 3;

/**
 * Lean, honest suggestions from the driver's own multi-car data — never a
 * generic or invented benchmark. Each insight only fires when there's
 * enough real data behind it (mirrors the "honest confidence" pattern
 * already used by lib/planner.ts and lib/benchmark.ts).
 */
export function buildCarInsights(
  summaries: VehicleSummary[],
  profile: ProfileAnalytics
): CarInsight[] {
  const insights: CarInsight[] = [];
  const active = summaries.filter((s) => s.vehicle.isActive);

  // 1. Best performer this period — only meaningful with ≥2 cars that both
  // have enough logged shifts to trust the rate.
  if (active.length >= 2) {
    const candidates = profile.perVehicle.filter((a) => a.counts.shifts >= MIN_SHIFTS_FOR_COMPARISON && a.perHour != null);
    if (candidates.length >= 2) {
      const best = candidates.reduce((a, b) => (b.perHour! > a.perHour! ? b : a));
      insights.push({
        kind: "bestPerformer",
        vehicleId: best.vehicle.id,
        vehicleName: best.vehicle.name,
        vars: { perHour: Math.round(best.perHour!) },
      });
    }
  }

  // 2. Idle car — active car with zero shifts logged in the selected period.
  if (active.length >= 2) {
    for (const a of profile.perVehicle) {
      if (a.counts.shifts === 0) {
        insights.push({ kind: "idle", vehicleId: a.vehicle.id, vehicleName: a.vehicle.name });
      }
    }
  }

  // 3 & 4. ROI/payback and negative-true-profit — per owned car with a
  // purchase price and at least some logged history.
  for (const s of active) {
    if (!s.hasRecords) continue;
    if (s.vehicle.purchasePrice != null && s.vehicle.purchasePrice > 0) {
      const pct = (s.trueProfit / s.vehicle.purchasePrice) * 100;
      if (s.trueProfit >= s.vehicle.purchasePrice) {
        insights.push({ kind: "paidForItself", vehicleId: s.vehicle.id, vehicleName: s.vehicle.name });
      } else if (pct > 0) {
        insights.push({
          kind: "roiProgress",
          vehicleId: s.vehicle.id,
          vehicleName: s.vehicle.name,
          vars: { pct: Math.round(pct) },
        });
      }
    }
    if (s.trueProfit < 0 && (s.vehicle.ownership === "OWNED" || s.vehicle.ownership === "INSTALLMENT")) {
      insights.push({
        kind: "negativeProfit",
        vehicleId: s.vehicle.id,
        vehicleName: s.vehicle.name,
        vars: { amount: Math.round(Math.abs(s.trueProfit)) },
      });
    }
  }

  return insights;
}
