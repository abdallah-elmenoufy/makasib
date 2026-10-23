"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { emitChanged } from "./dataBus";
import { Badge, Btn, Card, CardHead, IconChip, Meter, Modal } from "./ui";
import { Icon } from "./icons";
import { fmtNum, sep, toLocalInput } from "@/lib/format";

/**
 * Maintenance alerts on Home.
 *
 * A part with a service interval turns amber at 80% of it and red at 90%,
 * and stays on Home until the driver taps "I changed it". That logs the new
 * part (odometer, cost and interval prefilled from last time); the newer
 * record retires the old one (lib/maintenance.ts › inServiceItems), so its
 * bar starts again from zero and the alert clears by itself. Drivers rarely
 * open the Maintenance tab, so the reminder has to come to them.
 */

export type ServicePart = {
  id: string;
  category: string;
  state: "dueSoon" | "changeNow" | "overdue" | "ok";
  ratio: number | null;
  kmRemaining: number | null;
  intervalKm: number | null;
  dueOdometer: number | null;
  lastCost: number | null;
};

export function wearTone(state: string): "good" | "warn" | "bad" | "neutral" {
  return state === "overdue" || state === "changeNow" ? "bad" : state === "dueSoon" ? "warn" : state === "ok" ? "good" : "neutral";
}

export function ServiceAlertsCard({
  reminders,
  vehicleId,
  currentOdo,
}: {
  reminders: any[];
  vehicleId: string;
  currentOdo: number | null;
}) {
  const { t, locale } = useI18n();
  const [changing, setChanging] = useState<ServicePart | null>(null);
  const parts: ServicePart[] = reminders.filter((r) => r.source === "service" && r.state !== "ok");
  const manual = reminders.filter((r) => r.source === "manual" && r.state !== "ok");
  if (parts.length === 0 && manual.length === 0) return null;
  const urgent = parts.some((p) => p.state !== "dueSoon") || manual.some((r) => r.state === "overdue");

  return (
    <Card className={urgent ? "!border-loss/40" : "!border-warn/60"}>
      <CardHead
        icon="wrench"
        tint={urgent ? "tint-rose" : "tint-amber"}
        title={t("svc.alertTitle")}
        sub={t("svc.alertSub")}
        actions={
          <Link href="/maintenance" className="inline-flex items-center gap-0.5 text-xs font-bold text-action whitespace-nowrap">
            {t("nav.maintenance")} <Icon name="chevron" size={14} className="rtl:rotate-180" />
          </Link>
        }
      />
      <div className="space-y-3">
        {parts.map((p) => {
          const red = p.state !== "dueSoon";
          return (
            <div key={p.id} className={`rounded-2xl p-3.5 ${red ? "bg-loss-soft" : "bg-warn-soft"}`}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <IconChip icon="wrench" tint={red ? "tint-rose" : "tint-amber"} size="sm" />
                <span className="text-[15px] font-bold flex-1 min-w-0 truncate">{t(`mn.cat.${p.category}`)}</span>
                <Badge tone={red ? "bad" : "warn"}>{t(`svc.state.${p.state}`)}</Badge>
              </div>
              <Meter
                ratio={p.ratio ?? 0}
                tone={red ? "bad" : "warn"}
                value={p.intervalKm != null && p.ratio != null ? `${fmtNum(Math.round(p.ratio * p.intervalKm), locale, 0)} / ${fmtNum(p.intervalKm, locale, 0)} ${t("c.km")}` : undefined}
                sub={
                  p.kmRemaining != null && p.kmRemaining <= 0
                    ? t("mn.overdueBy", { km: fmtNum(-p.kmRemaining, locale, 0) })
                    : t("mn.kmLeft", { km: fmtNum(p.kmRemaining ?? 0, locale, 0), pct: fmtNum((p.ratio ?? 0) * 100, locale, 0) })
                }
              />
              <Btn variant={red ? "primary" : "secondary"} size="sm" className="mt-3 w-full sm:w-auto" onClick={() => setChanging(p)}>
                <Icon name="check" size={16} strokeWidth={2.5} /> {t("svc.changed")}
              </Btn>
            </div>
          );
        })}
        {manual.map((r) => (
          <Link key={r.id} href="/reminders" className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ${r.state === "overdue" ? "bg-loss-soft" : "bg-warn-soft"}`}>
            <IconChip icon="bell" tint={r.state === "overdue" ? "tint-rose" : "tint-amber"} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold truncate">{r.title}</span>
              {r.kmRemaining != null && (
                <span className="block text-xs text-ink-500">
                  {r.kmRemaining >= 0 ? t("rm.inKm", { n: fmtNum(r.kmRemaining, locale) }) : t("rm.kmOverdue", { n: fmtNum(-r.kmRemaining, locale) })}
                </span>
              )}
            </span>
            <Badge tone={r.state === "overdue" ? "bad" : "warn"}>{r.state === "overdue" ? t("rm.overdue") : t("rm.dueSoon")}</Badge>
          </Link>
        ))}
      </div>
      {changing && (
        <PartChangedSheet
          part={{ ...changing, fittedOdometer: changing.dueOdometer != null && changing.intervalKm != null ? changing.dueOdometer - changing.intervalKm : null }}
          vehicleId={vehicleId}
          currentOdo={currentOdo}
          onClose={() => setChanging(null)}
        />
      )}
    </Card>
  );
}

/** "I changed it": log the new part so its bar restarts at zero. */
export function PartChangedSheet({
  part,
  vehicleId,
  currentOdo,
  onClose,
  onSaved,
}: {
  part: { category: string; intervalKm: number | null; lastCost: number | null; fittedOdometer?: number | null };
  vehicleId: string;
  currentOdo: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t, locale } = useI18n();
  const [odo, setOdo] = useState(currentOdo != null ? String(Math.round(currentOdo)) : "");
  const [cost, setCost] = useState(part.lastCost != null ? String(part.lastCost) : "");
  const [life, setLife] = useState(part.intervalKm != null ? String(part.intervalKm) : "");
  const [earlier, setEarlier] = useState(false);
  const [date, setDate] = useState(toLocalInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = t(`mn.cat.${part.category}`);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const o = Number(odo);
    if (!Number.isFinite(o) || o <= 0) return setError(t("svc.odoRequired"));
    if (part.fittedOdometer != null && o <= part.fittedOdometer) return setError(t("svc.odoTooLow", { n: fmtNum(part.fittedOdometer, locale, 0) }));
    setBusy(true);
    setError("");
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        date: new Date(earlier ? date : Date.now()).toISOString(),
        odometer: o,
        category: part.category,
        cost: cost === "" ? 0 : Number(cost),
        lifetimeKm: life === "" ? null : Number(life),
        notes: t("svc.loggedFromAlert"),
      }),
    });
    setBusy(false);
    if (!res.ok) return setError(t("c.error"));
    emitChanged();
    onSaved?.();
    onClose();
  };

  const field = "w-full h-14 rounded-2xl bg-paper border-2 border-transparent focus:border-action focus:bg-sheet focus:outline-none px-4 text-2xl font-bold display tnum";
  return (
    <Modal open onClose={onClose} title={t("svc.changedTitle", { part: name })}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-ink-500">{t("svc.changedSub")}</p>
        <label className="block">
          <span className="block text-sm font-bold mb-1.5">{t("svc.odoAtChange")}</span>
          <input type="number" inputMode="decimal" value={odo} onChange={(e) => setOdo(e.target.value)} className={field} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="block text-sm font-bold mb-1.5">{t("svc.cost")}</span>
            <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={field} />
          </label>
          <label className="block min-w-0">
            <span className="block text-sm font-bold mb-1.5">{t("mn.lifetimeKm")}</span>
            <input type="number" inputMode="numeric" value={life} onChange={(e) => setLife(e.target.value)} placeholder="0" className={field} />
          </label>
        </div>
        {earlier ? (
          <label className="block">
            <span className="block text-sm font-bold mb-1.5">{t("c.date")}</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-12 rounded-xl bg-paper px-3.5 text-[15px] tnum" />
          </label>
        ) : (
          <button type="button" onClick={() => setEarlier(true)} className="text-sm font-bold text-ink-500 underline underline-offset-4">
            {t("svc.changedEarlier")}
          </button>
        )}
        <p className="text-xs text-muted">
          {t("svc.restartHint")}
          {part.lastCost != null && (
            <>
              {sep(locale)}
              {t("svc.prefilled")}
            </>
          )}
        </p>
        {error && <p className="text-sm text-loss">{error}</p>}
        <Btn type="submit" variant="big" disabled={busy || odo === ""}>
          <Icon name="check" size={20} strokeWidth={2.5} /> {t("svc.save")}
        </Btn>
      </form>
    </Modal>
  );
}
