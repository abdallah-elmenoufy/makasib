import "server-only";
import { prisma } from "@/lib/db";
import { startOdometerGuess, suggestEndOdometer, type EndOdoSuggestion } from "@/lib/odometer";

export type DriveState = {
  vehicleId: string;
  /** The shift being driven right now, if any. */
  active: {
    id: string;
    startTime: string;
    startOdometer: number;
    gpsKm: number | null;
    notes: string | null;
  } | null;
  /** What the active shift has logged so far. */
  tally: { trips: number; earnings: number; tripKm: number };
  /** Best guess for the next start reading (last end, else the car's initial). */
  startOdoGuess: number | null;
  /** Best guess for the active shift's end reading. */
  endOdoSuggestion: EndOdoSuggestion | null;
  /** The most recent closed shift, for the "last shift" line. */
  lastShift: { id: string; endTime: string | null; endOdometer: number | null } | null;
};

/**
 * Everything the drive sheet needs in one round trip: is a shift running,
 * what has it made so far, and which odometer numbers to offer as one-tap
 * suggestions. Only the last ~60 shifts feed the end-odometer ratio — plenty
 * to learn a driver's cruising habit, cheap to read.
 */
export async function getDriveState(vehicleId: string): Promise<DriveState> {
  const [vehicle, shifts] = await Promise.all([
    prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { initialOdometer: true } }),
    prisma.shift.findMany({ where: { vehicleId }, orderBy: { startTime: "desc" }, take: 60 }),
  ]);
  const active = shifts.find((s) => s.endOdometer == null) ?? null;
  const completed = shifts.filter((s) => s.endOdometer != null);
  const ids = shifts.map((s) => s.id);
  const trips = ids.length
    ? await prisma.trip.findMany({
        where: { vehicleId, shiftId: { in: ids } },
        select: { shiftId: true, fare: true, commission: true, tip: true, distanceKm: true, pickupKm: true },
      })
    : [];

  const mine = active ? trips.filter((t) => t.shiftId === active.id) : [];
  const lastClosed = completed[0] ?? null;
  const maxEnd = completed.reduce((m, s) => Math.max(m, s.endOdometer ?? 0), 0);

  return {
    vehicleId,
    active: active
      ? {
          id: active.id,
          startTime: active.startTime.toISOString(),
          startOdometer: active.startOdometer,
          gpsKm: active.gpsKm ?? null,
          notes: active.notes ?? null,
        }
      : null,
    tally: {
      trips: mine.length,
      earnings: mine.reduce((s, t) => s + t.fare - (t.commission ?? 0) + (t.tip ?? 0), 0),
      tripKm: mine.reduce((s, t) => s + (t.distanceKm ?? 0), 0),
    },
    startOdoGuess: startOdometerGuess(maxEnd || null, vehicle.initialOdometer),
    endOdoSuggestion: active ? suggestEndOdometer(active, trips, completed) : null,
    lastShift: lastClosed
      ? { id: lastClosed.id, endTime: lastClosed.endTime?.toISOString() ?? null, endOdometer: lastClosed.endOdometer ?? null }
      : null,
  };
}
