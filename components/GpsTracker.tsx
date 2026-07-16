"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";

type Point = [number, number, number];

function distKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[2] - a[2]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Foreground GPS tracking for the active shift (screen must stay on —
 *  background tracking arrives with the native mobile app). */
export function GpsTracker({ shiftId, initialKm }: { shiftId: string; initialKm: number | null }) {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const [km, setKm] = useState<number | null>(initialKm);
  const [error, setError] = useState("");
  const watchId = useRef<number | null>(null);
  const buffer = useRef<Point[]>([]);
  const lastKept = useRef<Point | null>(null);
  const wakeLock = useRef<any>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = async () => {
    if (buffer.current.length === 0) return;
    const points = buffer.current.splice(0, buffer.current.length);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shiftId, points }),
      });
      if (res.ok) setKm((await res.json()).gpsKm);
    } catch {
      buffer.current.unshift(...points); // retry next flush
    }
  };

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (flushTimer.current) clearInterval(flushTimer.current);
    wakeLock.current?.release?.().catch(() => {});
    watchId.current = null;
    flushTimer.current = null;
    flush();
    setOn(false);
  };

  const start = async () => {
    setError("");
    if (!("geolocation" in navigator)) return setError(t("sh.gpsUnsupported"));
    if (!window.isSecureContext) return setError(t("sh.gpsNeedsHttps"));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: Point = [Date.now(), pos.coords.latitude, pos.coords.longitude];
        const prev = lastKept.current;
        // keep a point when it moved ≥20 m or ≥30 s passed
        if (!prev || distKm(prev, p) >= 0.02 || p[0] - prev[0] >= 30_000) {
          lastKept.current = p;
          buffer.current.push(p);
        }
      },
      (err) => setError(err.code === err.PERMISSION_DENIED ? t("sh.gpsDenied") : err.message),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 }
    );
    flushTimer.current = setInterval(flush, 30_000);
    try {
      wakeLock.current = await (navigator as any).wakeLock?.request?.("screen");
    } catch {
      // wake lock is best-effort
    }
    setOn(true);
  };

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-3 flex-wrap text-sm">
      <button
        type="button"
        onClick={on ? stop : start}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          on
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
        }`}
      >
        🛰 {on ? t("sh.gpsOn") : t("sh.gpsStart")}
      </button>
      {km != null && (
        <span className="text-xs text-slate-600">
          {t("sh.gpsKm")}: <b style={{ fontVariantNumeric: "tabular-nums" }}>{km}</b> {t("c.km")}
        </span>
      )}
      {on && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
      {on && <span className="text-xs text-slate-400">{t("sh.gpsKeepOpen")}</span>}
    </div>
  );
}
