"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Empty, Modal } from "./ui";
import { fmtInt, fmtMoney, fmtNum } from "@/lib/format";

const TONE = { keep: "tint-green", watch: "tint-amber", sell: "tint-rose" } as const;

/** "Keep or sell?" for one car, in a sheet — see lib/keepOrSellRules.ts. */
export function KeepOrSellSheet({ vehicleId, name, onClose }: { vehicleId: string | null; name: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    if (!vehicleId) return;
    fetch(`/api/keep-sell?vehicleId=${vehicleId}`).then((r) => (r.ok ? r.json() : null)).then(setD);
  }, [vehicleId]);
  const money = (n: number) => fmtMoney(Math.round(n), locale);

  return (
    <Modal open={!!vehicleId} onClose={onClose} title={t("ks.title", { car: name })}>
      {!d ? (
        <Empty>{t("inc.loading")}</Empty>
      ) : d.monthlyProfit == null ? (
        <Empty>{t("ks.notEnough")}</Empty>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl px-4 py-4 ${TONE[d.verdict as keyof typeof TONE]}`}>
            <div className="text-xl font-bold">{t(`ks.verdict.${d.verdict}`)}</div>
            <ul className="text-sm mt-1.5 space-y-1 leading-relaxed">
              {d.reasons.map((r: string) => (
                <li key={r}>{t(`ks.reason.${r}`, { pct: fmtInt(Math.round((d.maintRise ?? 0) * 100), locale) })}</li>
              ))}
            </ul>
          </div>

          <div className="text-sm font-bold">{t("ks.nextYear")}</div>
          <div className="space-y-2.5 text-sm">
            <Row label={t("ks.earns")} sub={t("ks.earnsSub", { m: fmtNum(d.months, locale, 1), km: fmtInt(d.monthlyKm, locale) })} value={money(d.yearEarnings)} tone="text-money" />
            {d.yearValueLoss != null && <Row label={t("ks.loses")} sub={t("ks.losesSub")} value={`− ${money(d.yearValueLoss)}`} tone="text-loss" />}
            {d.yearValueLoss != null && <Row label={t("ks.net")} value={money(d.yearEarnings - d.yearValueLoss)} strong />}
          </div>

          {d.value != null && (
            <div className="rounded-2xl bg-surface-2 px-4 py-3 text-sm leading-relaxed">
              {t("ks.valueNow", { v: money(d.value) })}
              {d.valueInAYear != null && <> {t("ks.valueLater", { v: money(d.valueInAYear) })}</>}
              {d.valueIsEstimate && <div className="text-xs text-muted mt-1">{t("ks.valueEstimate")}</div>}
            </div>
          )}

          {d.repairs.length > 0 && (
            <div>
              <div className="text-sm font-bold mb-1.5">{t("ks.repairs", { total: money(d.repairsTotal) })}</div>
              <div className="space-y-1 text-sm">
                {d.repairs.map((r: any) => (
                  <div key={r.label} className="flex justify-between gap-3">
                    <span>{t(`mn.cat.${r.label}`)}{r.times > 1 && <span className="text-muted"> × {fmtInt(r.times, locale)}</span>}</span>
                    <span className="tnum font-bold">{money(r.cost * r.times)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-2 leading-relaxed">{t("ks.repairsNote")}</p>
            </div>
          )}
          <p className="text-xs text-muted leading-relaxed">{t("ks.footer")}</p>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, sub, value, tone = "", strong }: { label: string; sub?: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${strong ? "pt-2.5 border-t border-line" : ""}`}>
      <div className="min-w-0">
        <div className={strong ? "font-bold" : ""}>{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className={`tnum font-bold whitespace-nowrap ${strong ? "text-lg" : ""} ${tone}`}>{value}</div>
    </div>
  );
}
