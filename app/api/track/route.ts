import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

type Point = [number, number, number]; // [epochMs, lat, lng]

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[2] - a[2]) * Math.PI) / 180;
  const la = (a[1] * Math.PI) / 180;
  const lb = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function trackKm(points: Point[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineKm(points[i - 1], points[i]);
    const dtH = (points[i][0] - points[i - 1][0]) / 3_600_000;
    // drop GPS glitches: >2 km jumps or implied speed >150 km/h
    if (seg > 2 || (dtH > 0 && seg / dtH > 150)) continue;
    km += seg;
  }
  return Math.round(km * 100) / 100;
}

// Append a batch of GPS points to a shift's track and refresh its GPS km.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { shiftId, points } = (await req.json()) as { shiftId: string; points: Point[] };
    if (!shiftId || !Array.isArray(points)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) return NextResponse.json({ error: "not found" }, { status: 404 });

    let track: Point[] = [];
    try {
      track = shift.track ? JSON.parse(shift.track) : [];
    } catch {
      track = [];
    }
    const clean = points
      .filter(
        (p) =>
          Array.isArray(p) &&
          p.length === 3 &&
          p.every(Number.isFinite) &&
          Math.abs(p[1]) <= 90 &&
          Math.abs(p[2]) <= 180
      )
      .sort((a, b) => a[0] - b[0]);
    track.push(...clean);
    if (track.length > 20_000) track = track.slice(-20_000); // hard cap per shift

    const gpsKm = trackKm(track);
    await prisma.shift.update({
      where: { id: shiftId },
      data: { track: JSON.stringify(track), gpsKm },
    });
    return NextResponse.json({ gpsKm, points: track.length });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}
