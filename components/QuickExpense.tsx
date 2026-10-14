"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { Badge, Btn, Input } from "./ui";
import { fmtMoney, sep } from "@/lib/format";

/**
 * One-tap running costs.
 *
 * Running costs are the one thing drivers never log — a wash, a phone
 * top-up, a parking fee, a fine — and every one of them missing makes the
 * app's profit figure flatter it. The full form asks for six fields; this
 * asks for none when the amount hasn't changed since last time, because the
 * button is pre-filled from the driver's own most recent entry in that
 * category. Nothing is ever invented: with no history the box opens empty.
 */

export const EXPENSE_ICON: Record<string, string> = {
  WASH: "🧼",
  MOBILE_DATA: "📶",
  PARKING: "🅿️",
  FINE: "🚨",
  TOLL: "🛣️",
  RENTAL: "🔑",
  INSURANCE: "🛡️",
  LICENSE: "📄",
  OTHER: "➕",
};

/** The costs that recur often enough to deserve a chip. */
export const QUICK_CATEGORIES = ["WASH", "MOBILE_DATA", "PARKING", "TOLL", "FINE"];

export function QuickExpense({
  vehicleId,
  recent,
  onAdded,
  categories = QUICK_CATEGORIES,
}: {
  vehicleId: string;
  /** Every expense on this car — used only to remember the last amount. */
  recent: { category: string; amount: number; date: string }[];
  onAdded: () => void;
  categories?: string[];
}) {
  const { t, locale } = useI18n();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const lastFor = (cat: string): number | null => {
    let best: { amount: number; date: string } | null = null;
    for (const r of recent) {
      if (r.category !== cat) continue;
      if (best == null || new Date(r.date) > new Date(best.date)) best = r;
    }
    return best?.amount ?? null;
  };

  const pick = (cat: string) => {
    if (openCat === cat) return setOpenCat(null);
    const last = lastFor(cat);
    setOpenCat(cat);
    setAmount(last != null ? String(last) : "");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!openCat || !Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        date: new Date().toISOString(),
        category: openCat,
        amount: value,
        isWork: true,
      }),
    });
    setSaving(false);
    if (!res.ok) return setFlash(t("c.error"));
    setFlash(t("qx.added", { cat: t(`ex.cat.${openCat}`), v: fmtMoney(value, locale) }));
    setTimeout(() => setFlash(""), 2500);
    setOpenCat(null);
    setAmount("");
    onAdded();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const last = lastFor(cat);
          const active = openCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => pick(cat)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "bg-action border-action text-action-fg"
                  : "bg-paper border-[var(--border)] text-ink-700 hover:bg-surface"
              }`}
            >
              <span className="text-sm leading-none">{EXPENSE_ICON[cat] ?? "➕"}</span>
              <span>{t(`ex.cat.${cat}`)}</span>
              {last != null && (
                <span className={`tnum ${active ? "text-hero-fg/70" : "text-muted"}`}>
                  {fmtMoney(last, locale)}
                </span>
              )}
            </button>
          );
        })}
        {flash && <Badge tone="good">{flash}</Badge>}
      </div>

      {openCat && (
        <form onSubmit={save} className="flex items-end gap-2 mt-3">
          <div className="flex-1 max-w-40">
            <span className="block text-xs font-semibold text-ink-500 mb-1.5">
              {t("ex.amount")}{sep(locale)}{t(`ex.cat.${openCat}`)}
            </span>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-bold"
            />
          </div>
          <Btn type="submit" disabled={saving || !amount}>
            {t("c.save")}
          </Btn>
          <Btn variant="ghost" onClick={() => setOpenCat(null)}>
            {t("c.cancel")}
          </Btn>
        </form>
      )}
    </div>
  );
}
