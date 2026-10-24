"use client";
import { useMemo } from "react";
import { Card, CardHead } from "./ui";
import { Icon } from "./icons";
import { cngSavings, DRIFT_WARN, economyDrift, tankWindows } from "@/lib/fuelInsights";
import { fmtInt, fmtMoney, fmtNum } from "@/lib/format";

type T = (k: string, vars?: Record<string, string | number>) => string;

/** Consumption creeping up, and (dual-fuel cars) what natural gas is saving. */
export function FuelInsights({ rows, fuelSetup, t, locale }: { rows: any[]; fuelSetup: string | null; t: T; locale: string }) {
  const drift = useMemo(() => {
    for (const g of ["PETROL", "CNG"] as const) {
      const d = economyDrift(tankWindows(rows, g));
      if (d && d.pct >= DRIFT_WARN) return { ...d, unit: g === "CNG" ? t("c.m3") : t("c.liters") };
    }
    return null;
  }, [rows, t]);
  const cng = useMemo(() => (fuelSetup === "DUAL" ? cngSavings(rows) : null), [rows, fuelSetup]);
  const money = (n: number) => fmtMoney(n, locale);

  if (!drift && !(cng && cng.savedPerKm > 0)) return null;
  return (
    <div className="space-y-4 mb-4">
      {drift && (
        <Card className="border-warn/60">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl tint-amber flex items-center justify-center shrink-0">
              <Icon name="fuel" size={22} />
            </span>
            <div className="min-w-0">
              <div className="font-bold text-[17px] leading-snug">{t("fi.driftTitle", { pct: fmtInt(Math.round(drift.pct * 100), locale) })}</div>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                {t("fi.driftBody", { recent: fmtNum(drift.recent, locale), usual: fmtNum(drift.usual, locale), unit: drift.unit })}
              </p>
              <p className="text-sm mt-2 leading-relaxed">{t("fi.driftChecks")}</p>
            </div>
          </div>
        </Card>
      )}
      {cng && cng.savedPerKm > 0 && (
        <Card>
          <CardHead icon="fuel" tint="tint-green" title={t("fi.cngTitle")} sub={t("fi.cngSub")} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted">{t("fi.savedSoFar")}</div>
              <div className="text-[30px] font-bold tnum text-money leading-tight">{fmtMoney(Math.round(cng.savedSoFar), locale)}</div>
              <div className="text-xs text-muted mt-0.5">{t("fi.onGasKm", { km: fmtInt(cng.cngKm, locale) })}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t("fi.per100")}</div>
              <div className="text-[30px] font-bold tnum leading-tight">{money(cng.savedPerKm * 100)}</div>
              <div className="text-xs text-muted mt-0.5">{t("fi.compare", { petrol: money(cng.petrolPerKm), gas: money(cng.cngPerKm) })}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
