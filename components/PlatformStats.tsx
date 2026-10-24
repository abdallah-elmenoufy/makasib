"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Btn, Card, CardHead, Field, Input, Segmented } from "./ui";
import { useOnChanged } from "./dataBus";
import { fmtInt, fmtNum } from "@/lib/format";
import { END_REASONS } from "./EndShiftFlow";

// The three numbers the platform judges a driver by — rating, acceptance,
// cancellation — typed once a week from the app's ratings screen, so the
// driver sees their own trend (no driver API exists to read them).

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT"] as const;

export function PlatformStatsCard({ vehicleId, weekKey, weekLabel }: { vehicleId: string; weekKey: string; weekLabel: string }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [platform, setPlatform] = useState<string>("UBER");
  const [form, setForm] = useState({ rating: "", acceptanceRate: "", cancellationRate: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/platformStats?vehicleId=${vehicleId}&all=1`).then((r) => (r.ok ? r.json() : [])).then((d) => setRows(Array.isArray(d) ? d : []));
  }, [vehicleId]);
  useEffect(load, [load]);

  const mine = useMemo(() => rows.filter((r) => r.platform === platform).sort((a, b) => a.weekKey.localeCompare(b.weekKey)), [rows, platform]);
  const current = mine.find((r) => r.weekKey === weekKey) ?? null;
  const before = mine.filter((r) => r.weekKey < weekKey).at(-1) ?? null;
  useEffect(() => setSaved(false), [weekKey, platform]);
  useEffect(() => {
    setForm({
      rating: current?.rating != null ? String(current.rating) : "",
      acceptanceRate: current?.acceptanceRate != null ? String(current.acceptanceRate) : "",
      cancellationRate: current?.cancellationRate != null ? String(current.cancellationRate) : "",
    });
  }, [current?.id, weekKey, platform]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const data = { vehicleId, weekKey, platform, rating: num(form.rating), acceptanceRate: num(form.acceptanceRate), cancellationRate: num(form.cancellationRate) };
    const res = current
      ? await fetch(`/api/platformStats/${current.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
      : await fetch(`/api/platformStats`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      load();
    }
  };

  const trend = (k: "rating" | "acceptanceRate" | "cancellationRate", lowerIsBetter = false) => {
    if (current?.[k] == null || before?.[k] == null) return null;
    const d = current[k] - before[k];
    if (Math.abs(d) < 1e-9) return <span className="text-muted">=</span>;
    const good = lowerIsBetter ? d < 0 : d > 0;
    return <span className={good ? "text-money" : "text-loss"}>{d > 0 ? "▲" : "▼"} {fmtNum(Math.abs(d), locale, k === "rating" ? 2 : 0)}</span>;
  };

  return (
    <Card>
      <CardHead icon="trophy" tint="tint-sky" title={t("ps.title")} sub={t("ps.sub", { week: weekLabel })} />
      <Segmented size="sm" value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p, label: t(`pf.${p}`) }))} />
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Field label={t("ps.rating")}>
          <Input type="number" step="0.01" min="1" max="5" inputMode="decimal" placeholder="4.90" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
        </Field>
        <Field label={t("ps.acceptance")}>
          <Input type="number" step="1" min="0" max="100" inputMode="numeric" placeholder="%" value={form.acceptanceRate} onChange={(e) => setForm({ ...form, acceptanceRate: e.target.value })} />
        </Field>
        <Field label={t("ps.cancellation")}>
          <Input type="number" step="0.1" min="0" max="100" inputMode="decimal" placeholder="%" value={form.cancellationRate} onChange={(e) => setForm({ ...form, cancellationRate: e.target.value })} />
        </Field>
      </div>
      {current && before && (
        <div className="grid grid-cols-3 gap-3 text-xs font-bold mt-1.5 tnum">
          <div>{trend("rating")}</div>
          <div>{trend("acceptanceRate")}</div>
          <div>{trend("cancellationRate", true)}</div>
        </div>
      )}
      <div className="flex items-center gap-3 mt-4">
        <Btn onClick={save} disabled={busy || (!form.rating && !form.acceptanceRate && !form.cancellationRate)}>{t("c.save")}</Btn>
        {saved && <span className="text-sm text-money font-bold">{t("ps.saved")}</span>}
      </div>
      {mine.length >= 2 && (
        <div className="mt-4 pt-3 border-t border-line">
          <div className="text-xs text-muted mb-2">{t("ps.history")}</div>
          <div className="flex gap-2 overflow-x-auto scroll-x pb-1">
            {mine.slice(-8).map((r) => (
              <div key={r.id} className={`shrink-0 rounded-xl px-3 py-2 text-center ${r.weekKey === weekKey ? "bg-action-soft" : "bg-surface-2"}`}>
                <div className="text-[11px] text-muted tnum">{r.weekKey.slice(5)}</div>
                <div className="text-sm font-bold tnum">{r.rating != null ? fmtNum(r.rating, locale, 2) : "—"}</div>
                <div className="text-[11px] text-muted tnum">{r.acceptanceRate != null ? `${fmtInt(r.acceptanceRate, locale)}%` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Why shifts ended over the last eight weeks, with how long those shifts ran. */
export function EndReasonsCard({ vehicleId }: { vehicleId: string }) {
  const { t, locale } = useI18n();
  const [shifts, setShifts] = useState<any[]>([]);
  const load = useCallback(() => {
    fetch(`/api/shifts?vehicleId=${vehicleId}&all=1`).then((r) => (r.ok ? r.json() : [])).then((d) => setShifts(Array.isArray(d) ? d : []));
  }, [vehicleId]);
  useEffect(load, [load]);
  useOnChanged(load);

  const stats = useMemo(() => {
    const since = Date.now() - 56 * 86_400_000;
    const by = new Map<string, { n: number; hours: number }>();
    for (const s of shifts) {
      if (!s.endReason || !s.endTime || new Date(s.startTime).getTime() < since) continue;
      const e = by.get(s.endReason) ?? { n: 0, hours: 0 };
      e.n++;
      e.hours += (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3_600_000;
      by.set(s.endReason, e);
    }
    const total = [...by.values()].reduce((s, e) => s + e.n, 0);
    return { total, rows: END_REASONS.filter((r) => by.has(r)).map((r) => ({ reason: r, ...by.get(r)!, avg: by.get(r)!.hours / by.get(r)!.n })).sort((a, b) => b.n - a.n) };
  }, [shifts]);

  if (stats.total < 3) return null;
  return (
    <Card>
      <CardHead icon="flag" title={t("er.title")} sub={t("er.sub")} />
      <div className="space-y-2.5">
        {stats.rows.map((r) => (
          <div key={r.reason}>
            <div className="flex justify-between text-sm">
              <span className="font-bold">{t(`sh.reason.${r.reason}`)}</span>
              <span className="text-muted tnum">{t("er.row", { n: fmtInt(r.n, locale), h: fmtNum(r.avg, locale, 1) })}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-action" style={{ width: `${(r.n / stats.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
