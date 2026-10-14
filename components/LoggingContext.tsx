"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { fmtDateTime, fmtMoney } from "@/lib/format";

/**
 * The "where is this going?" banner.
 *
 * Context: a driver logs trips at the end of a shift — tired, one-handed,
 * last tea before bed. The single most disorienting thing about the old flow
 * was landing on Trips with no idea which shift the entries would attach to,
 * so they'd flip back to Shifts to check, then back again. This keeps that
 * answer permanently on screen.
 *
 * It also surfaces (and one-tap fixes) the two data problems that silently
 * corrupt cost maths: a platform trip sitting outside any shift, and a shift
 * left open. Both are reported only after the server has already tried to
 * reconcile automatically, so it never nags about something fixable.
 */
export function LoggingContext({ vehicleId, onChanged }: { vehicleId: string; onChanged?: () => void }) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!vehicleId) return;
    fetch(`/api/integrity?vehicleId=${vehicleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport);
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const attach = async (tripId: string, shiftId: string) => {
    setBusy(true);
    await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shiftId }),
    });
    setBusy(false);
    load();
    onChanged?.();
  };

  if (!report) return null;

  const open = report.openShifts?.[0];
  const orphans = report.orphanTrips ?? [];

  // nothing to say and nothing wrong — stay out of the way
  if (!open && orphans.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {open && (
        <div className="rounded-2xl border border-line bg-action-soft px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-money opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-money" />
          </span>
          <div className="text-sm min-w-0">
            <span className="font-bold text-ink">{t("lc.loggingInto")}</span>{" "}
            <span className="text-ink">{fmtDateTime(open.startTime, locale)}</span>
          </div>
          <Link
            href="/shifts"
            className="ms-auto text-xs font-semibold text-ink hover:text-action underline underline-offset-2"
          >
            {t("lc.endShift")} →
          </Link>
        </div>
      )}

      {orphans.length > 0 && (
        <div className="rounded-2xl border border-warn/60 bg-warn-soft px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-warn-ink">{t("lc.orphanTitle", { n: orphans.length })}</p>
              <p className="text-xs text-warn-ink mt-0.5 leading-relaxed">{t("lc.orphanWhy")}</p>
              <div className="mt-2.5 space-y-1.5">
                {orphans.slice(0, 4).map((o: any) => (
                  <div key={o.id} className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold tnum">{fmtDateTime(o.startTime, locale)}</span>
                    <span className="text-warn-ink">{fmtMoney(o.net, locale)}</span>
                    {o.nearestShiftId ? (
                      <button
                        disabled={busy}
                        onClick={() => attach(o.id, o.nearestShiftId)}
                        className="ms-auto font-semibold text-ink hover:text-action underline underline-offset-2 disabled:opacity-50"
                      >
                        {t("lc.attachTo", { when: fmtDateTime(o.nearestShiftLabel, locale) })}
                      </button>
                    ) : (
                      <Link href="/shifts" className="ms-auto font-semibold text-action underline underline-offset-2">
                        {t("lc.createShift")}
                      </Link>
                    )}
                  </div>
                ))}
                {orphans.length > 4 && (
                  <p className="text-xs text-warn-ink">{t("lc.andMore", { n: orphans.length - 4 })}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
