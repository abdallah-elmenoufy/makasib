"use client";
import { useEffect, useState } from "react";
import { Card, CardHead, Field, Input } from "./ui";
import { Icon } from "./icons";
import { checkRule, minFare, suggestMinPerKm, type AcceptRule } from "@/lib/acceptRule";
import { fmtMoney, fmtNum } from "@/lib/format";

type T = (k: string, vars?: Record<string, string | number>) => string;

const key = (vehicleId: string) => `acceptRule:${vehicleId}`;
const TRIP_KMS = [5, 10, 15, 25];

/** The rule suggested from all-time analytics: cost per km, profit per hour, trip speed, usual pickup. */
export function suggestedRule(a: any): (AcceptRule & { basis: { costPerKm: number; kmPerHour: number } }) | null {
  if (!a) return null;
  const costPerKm = a.rates.fuelCostPerKm + a.rates.maintCostPerKm + a.rates.depPerKm;
  const drivenMin = (a.time?.tripMin ?? 0) + (a.time?.pickupMin ?? 0);
  const drivenKm = (a.kmSplit?.tripKm ?? 0) + (a.kmSplit?.pickupKm ?? 0);
  const kmPerHour = drivenMin > 0 && drivenKm > 0 ? (drivenKm / drivenMin) * 60 : a.counts.hoursWorked > 0 ? a.kmSplit.shiftKm / a.counts.hoursWorked : null;
  const minPerKm = suggestMinPerKm(costPerKm, a.perHour, kmPerHour);
  if (minPerKm == null || kmPerHour == null) return null;
  const avgPickup = a.counts.trips > 0 && a.kmSplit.pickupKm > 0 ? a.kmSplit.pickupKm / a.counts.trips : null;
  return { minPerKm, maxPickupKm: avgPickup ? Math.max(1, Math.ceil(avgPickup * 1.5 * 2) / 2) : 99, basis: { costPerKm, kmPerHour } };
}

export function useAcceptRule(vehicleId: string | undefined, suggested: AcceptRule | null) {
  const [rule, setRule] = useState<AcceptRule | null>(null);
  useEffect(() => {
    if (!vehicleId) return;
    try {
      const saved = localStorage.getItem(key(vehicleId));
      if (saved) return setRule(JSON.parse(saved));
    } catch {}
    setRule(suggested ? { minPerKm: suggested.minPerKm, maxPickupKm: suggested.maxPickupKm } : null);
  }, [vehicleId, suggested?.minPerKm, suggested?.maxPickupKm]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (r: AcceptRule) => {
    setRule(r);
    try {
      if (vehicleId) localStorage.setItem(key(vehicleId), JSON.stringify(r));
    } catch {}
  };
  return { rule, save };
}

export function AcceptRuleCard({ rule, suggested, onChange, t, locale }: { rule: AcceptRule | null; suggested: ReturnType<typeof suggestedRule>; onChange: (r: AcceptRule) => void; t: T; locale: string }) {
  const [editing, setEditing] = useState(false);
  if (!rule) return null;
  const money = (n: number) => fmtMoney(n, locale);
  const pickupForTable = rule.maxPickupKm < 99 ? Math.min(2, rule.maxPickupKm) : 2;
  return (
    <Card>
      <CardHead
        icon="check"
        tint="tint-green"
        title={t("ar.title")}
        sub={t("ar.sub")}
        actions={
          <button type="button" onClick={() => setEditing((e) => !e)} className="text-sm font-bold text-action whitespace-nowrap">
            {editing ? t("c.done") : t("c.edit")}
          </button>
        }
      />
      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ar.minPerKm")}>
            <Input type="number" step="0.5" inputMode="decimal" value={rule.minPerKm} onChange={(e) => onChange({ ...rule, minPerKm: Number(e.target.value) || 0 })} />
          </Field>
          <Field label={t("ar.maxPickup")}>
            <Input type="number" step="0.5" inputMode="decimal" value={rule.maxPickupKm >= 99 ? "" : rule.maxPickupKm} placeholder="—" onChange={(e) => onChange({ ...rule, maxPickupKm: Number(e.target.value) || 99 })} />
          </Field>
          {suggested && (
            <p className="col-span-2 text-xs text-muted leading-relaxed">
              {t("ar.why", { cost: money(suggested.basis.costPerKm), speed: fmtNum(suggested.basis.kmPerHour, locale, 0), min: money(suggested.minPerKm) })}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="text-[24px] md:text-[28px] font-bold leading-tight">
            {t("ar.ruleLine", { perKm: money(rule.minPerKm) })}
            {rule.maxPickupKm < 99 && <span className="block text-lg text-muted font-bold mt-1">{t("ar.pickupLine", { km: fmtNum(rule.maxPickupKm, locale) })}</span>}
          </div>
          <div className="mt-4">
            <div className="text-xs text-muted mb-2">{t("ar.cheatSheet", { pickup: fmtNum(pickupForTable, locale) })}</div>
            <div className="grid grid-cols-4 gap-2">
              {TRIP_KMS.map((km) => (
                <div key={km} className="rounded-xl bg-surface-2 px-2 py-2.5 text-center">
                  <div className="text-xs text-muted">{t("ar.tripKm", { km: fmtNum(km, locale, 0) })}</div>
                  <div className="text-base font-bold tnum mt-0.5">{fmtMoney(Math.ceil(minFare(rule, pickupForTable, km)), locale)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/** One line under an offer's score: what the driver's own rule says. */
export function RuleVerdict({ rule, offer, t, locale }: { rule: AcceptRule; offer: { fare: number; pickupKm: number; tripKm: number }; t: T; locale: string }) {
  const c = checkRule(rule, offer);
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${c.ok ? "tint-green" : "tint-rose"}`}>
      <Icon name={c.ok ? "check" : "close"} size={18} />
      <span>
        {c.ok ? t("ar.pass", { perKm: fmtMoney(c.perKm, locale) }) : c.pickupTooFar ? t("ar.failPickup", { km: fmtNum(rule.maxPickupKm, locale) }) : t("ar.failFare", { perKm: fmtMoney(c.perKm, locale), min: fmtMoney(rule.minPerKm, locale) })}
      </span>
    </div>
  );
}
