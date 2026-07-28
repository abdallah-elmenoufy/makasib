"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Heatmap of real GPS points recorded during shifts (components/GpsTracker.tsx)
 * — free OpenStreetMap tiles, no API key, no geocoding. Leaflet needs the
 * DOM, so this only ever runs client-side (the caller must dynamic-import
 * with ssr:false) and everything leaflet-related is loaded inside the effect.
 */
export function GpsHeatmap({ points }: { points: [number, number][] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!elRef.current || points.length === 0) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.heat");
      if (cancelled || !elRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(mapRef.current);
      }

      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [24, 24] });
      (L as any).heatLayer(points, { radius: 16, blur: 20, maxZoom: 16 }).addTo(mapRef.current);
    })();

    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return <div ref={elRef} className="rounded-xl overflow-hidden" style={{ height: 360 }} />;
}
