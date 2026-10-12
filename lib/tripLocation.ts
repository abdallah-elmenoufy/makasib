import "server-only";
import { prisma } from "./db";
import { tripMinutes } from "./analytics";

// Where did this trip start and end?
//
// No ingestion source gives coordinates directly (screenshots carry address
// labels, statements carry nothing), but the in-shift GPS tracker records
// where the car was every ~30 s. A trip's pickup is therefore wherever the
// car was at the trip's start time, and its drop-off wherever it was when
// the rider got out (start + duration). This module reads those two points
// back off the shift's track so every trip logged inside a tracked shift gets
// real coordinates for free — no geocoding, no API key.

export type TrackPoint = [number, number, number]; // [epochMs, lat, lng]

/** Longest gap we tolerate between a trip event and the nearest GPS fix. */
const MAX_GAP_MS = 10 * 60 * 1000;

export function parseTrack(json: string | null | undefined): TrackPoint[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is TrackPoint =>
        Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) && Math.abs(p[1]) <= 90 && Math.abs(p[2]) <= 180
    );
  } catch {
    return [];
  }
}

/** Nearest recorded position to `at`, or null if the track has nothing near it. */
export function positionAt(track: TrackPoint[], at: number): { lat: number; lng: number } | null {
  if (track.length === 0) return null;
  // tracks are appended in time order; binary-search the insertion point
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid][0] < at) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [track[lo], track[lo - 1]].filter(Boolean) as TrackPoint[];
  const best = candidates.sort((a, b) => Math.abs(a[0] - at) - Math.abs(b[0] - at))[0];
  if (!best || Math.abs(best[0] - at) > MAX_GAP_MS) return null;
  return { lat: best[1], lng: best[2] };
}

type TripRow = {
  id: string;
  shiftId: string | null;
  startTime: Date;
  endTime: Date | null;
  durationMin: number | null;
  pickupLat: number | null;
  dropoffLat: number | null;
};

/**
 * Fill missing pickup/drop-off coordinates on these trips from their shifts'
 * GPS tracks. Only ever writes empty fields — a position captured live on the
 * phone, or typed by the driver, is never overwritten by a track estimate.
 * Returns how many trips gained at least one coordinate.
 */
export async function locateTrips(trips: TripRow[]): Promise<number> {
  const pending = trips.filter((t) => t.shiftId && (t.pickupLat == null || t.dropoffLat == null));
  if (pending.length === 0) return 0;
  const shiftIds = [...new Set(pending.map((t) => t.shiftId!))];
  const shifts = await prisma.shift.findMany({
    where: { id: { in: shiftIds }, track: { not: null } },
    select: { id: true, track: true },
  });
  const tracks = new Map(shifts.map((s) => [s.id, parseTrack(s.track)]));

  let located = 0;
  for (const t of pending) {
    const track = tracks.get(t.shiftId!);
    if (!track || track.length === 0) continue;
    const data: Record<string, number> = {};
    const start = new Date(t.startTime).getTime();
    if (t.pickupLat == null) {
      const p = positionAt(track, start);
      if (p) {
        data.pickupLat = p.lat;
        data.pickupLng = p.lng;
      }
    }
    if (t.dropoffLat == null) {
      const mins = tripMinutes(t);
      if (mins > 0) {
        const p = positionAt(track, start + mins * 60_000);
        if (p) {
          data.dropoffLat = p.lat;
          data.dropoffLng = p.lng;
        }
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.trip.update({ where: { id: t.id }, data });
      located++;
    }
  }
  return located;
}

/** Every trip of one shift — called after a GPS batch lands or a shift is edited. */
export async function locateShiftTrips(shiftId: string): Promise<number> {
  const trips = await prisma.trip.findMany({ where: { shiftId } });
  return locateTrips(trips);
}

/** Every unlocated trip on the car — the catch-all used by the health check. */
export async function locateVehicleTrips(vehicleId: string): Promise<number> {
  const trips = await prisma.trip.findMany({
    where: { vehicleId, shiftId: { not: null }, OR: [{ pickupLat: null }, { dropoffLat: null }] },
  });
  return locateTrips(trips);
}
