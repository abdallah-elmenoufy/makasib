import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

type TrackPoint = [number, number, number]; // [epochMs, lat, lng]

const MAX_POINTS = 4000;

/**
 * Every GPS point captured across this vehicle's shifts (see
 * components/GpsTracker.tsx / api/track), flattened to [lat, lng] pairs for
 * a heatmap — real recorded positions, not geocoded address guesses. Evenly
 * sampled down to MAX_POINTS so a long history doesn't ship a huge payload
 * or choke the client-side heat layer.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });

    const shifts = await prisma.shift.findMany({
      where: { vehicleId, track: { not: null } },
      select: { track: true },
    });

    const points: [number, number][] = [];
    for (const s of shifts) {
      if (!s.track) continue;
      try {
        const track: TrackPoint[] = JSON.parse(s.track);
        for (const p of track) {
          if (Array.isArray(p) && p.length === 3 && Number.isFinite(p[1]) && Number.isFinite(p[2])) {
            points.push([p[1], p[2]]);
          }
        }
      } catch {
        // malformed track JSON — skip this shift's points
      }
    }

    let sampled = points;
    if (points.length > MAX_POINTS) {
      const step = points.length / MAX_POINTS;
      sampled = [];
      for (let i = 0; i < MAX_POINTS; i++) sampled.push(points[Math.floor(i * step)]);
    }

    return NextResponse.json({ points: sampled, totalPoints: points.length });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
