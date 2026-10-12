import "server-only";
import { prisma } from "./db";

// Address labels → coordinates, via OpenStreetMap's Nominatim.
//
// Screenshots give a trip its pickup/drop-off as a Google place label
// ("Nasr City EG", "6th of October EG") but no coordinates, so those trips
// could never land on the map or in the "where to go" zones unless the shift
// was GPS-tracked. Nominatim is free, needs no key, and is good enough for a
// neighbourhood-level pin. Its usage policy (one request per second, an
// identifying User-Agent, cache results) is respected here: lookups run in
// the background off a normal analytics request, ≤ MAX_PER_RUN at a time with
// a pause between them, and every answer — including "not found" — is cached
// in GeoCache so a label is asked once, ever. The driver can switch it off in
// Settings (labels are then never sent anywhere).

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Makasib/0.1 (ride-hailing driver profit tracker, self-hosted)";
const MAX_PER_RUN = 12;
const PAUSE_MS = 1100;
const RUN_COOLDOWN_MS = 10 * 60 * 1000;

export type GeoResult = { lat: number; lng: number; label: string | null };

/** Trim the country suffix and OCR debris so cache keys collapse near-duplicates. */
export function normalizeQuery(label: string): string {
  return label
    .replace(/\s+(EG|AE|SA)\s*$/i, "")
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Parse a Nominatim JSON answer; null when it holds no usable hit. */
export function parseNominatim(json: unknown): GeoResult | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const hit = json[0] as { lat?: string; lon?: string; display_name?: string };
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: typeof hit.display_name === "string" ? hit.display_name.split(",").slice(0, 2).join(",") : null };
}

export async function getGeocodeEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "geocodeEnabled" } });
  return row ? row.value !== "false" : true;
}

export async function setGeocodeEnabled(on: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "geocodeEnabled" },
    create: { key: "geocodeEnabled", value: on ? "true" : "false" },
    update: { value: on ? "true" : "false" },
  });
}

type Fetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** One label → coordinates, cache first. Returns null for an unknown place. */
export async function geocodeLabel(label: string, fetcher: Fetcher = fetch): Promise<GeoResult | null> {
  const q = normalizeQuery(label);
  if (q.length < 3) return null;
  const cached = await prisma.geoCache.findUnique({ where: { query: q } });
  if (cached) return cached.lat != null && cached.lng != null ? { lat: cached.lat, lng: cached.lng, label: cached.label } : null;

  let result: GeoResult | null = null;
  try {
    const url = `${ENDPOINT}?${new URLSearchParams({ q: `${q}, Egypt`, format: "jsonv2", limit: "1", countrycodes: "eg" })}`;
    const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" } });
    if (res.ok) result = parseNominatim(await res.json());
  } catch {
    // network trouble: don't cache, try again next run
    return null;
  }
  await prisma.geoCache.create({ data: { query: q, lat: result?.lat ?? null, lng: result?.lng ?? null, label: result?.label ?? null } });
  return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fill coordinates on trips that have an address label but no position —
 * pickup and drop-off independently. GPS-track positions (lib/tripLocation.ts)
 * run first and are never overwritten; this only touches empty fields.
 */
export async function geocodeVehicleTrips(vehicleId: string, fetcher: Fetcher = fetch): Promise<number> {
  if (!(await getGeocodeEnabled())) return 0;
  const trips = await prisma.trip.findMany({
    where: {
      vehicleId,
      OR: [
        { pickupLat: null, pickupAddress: { not: null } },
        { dropoffLat: null, dropoffAddress: { not: null } },
      ],
    },
    orderBy: { startTime: "desc" },
    take: 200,
  });
  let lookups = 0;
  let filled = 0;
  for (const t of trips) {
    const data: Record<string, number> = {};
    for (const side of ["pickup", "dropoff"] as const) {
      const addr = side === "pickup" ? t.pickupAddress : t.dropoffAddress;
      const has = side === "pickup" ? t.pickupLat != null : t.dropoffLat != null;
      if (!addr || has) continue;
      const q = normalizeQuery(addr);
      const cached = await prisma.geoCache.findUnique({ where: { query: q } });
      if (!cached) {
        if (lookups >= MAX_PER_RUN) continue;
        lookups++;
        await sleep(PAUSE_MS);
      }
      const r = cached ? (cached.lat != null && cached.lng != null ? { lat: cached.lat, lng: cached.lng, label: cached.label } : null) : await geocodeLabel(addr, fetcher);
      if (r) {
        data[`${side}Lat`] = r.lat;
        data[`${side}Lng`] = r.lng;
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.trip.update({ where: { id: t.id }, data });
      filled++;
    }
  }
  return filled;
}

/** Lazy background pass, piggybacking on normal traffic like lib/purge.ts. */
let lastRun = 0;
let running = false;
export function maybeGeocode(vehicleId: string): void {
  const now = Date.now();
  if (running || now - lastRun < RUN_COOLDOWN_MS) return;
  lastRun = now;
  running = true;
  geocodeVehicleTrips(vehicleId)
    .catch((e) => console.error("geocode pass failed:", e))
    .finally(() => {
      running = false;
    });
}
