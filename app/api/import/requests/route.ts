import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Enrich existing trips with pickup distance parsed from trip-request cards.
// A request card has no date, so matching is by the driver's net earnings
// (the offer is net, like statement/OCR earnings) over a recent window,
// tie-broken by time-of-day from the status-bar clock.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { vehicleId, requests } = (await req.json()) as {
      vehicleId: string;
      requests: {
        fare: number;
        pickupKm: number;
        pickupMin: number | null;
        tripKm: number | null;
        clock: string | null;
      }[];
    };
    if (!vehicleId || !Array.isArray(requests)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    const since = new Date(Date.now() - 45 * 86_400_000);
    const trips = await prisma.trip.findMany({
      where: { vehicleId, startTime: { gte: since } },
      orderBy: { startTime: "desc" },
    });

    let enriched = 0;
    let unmatched = 0;
    const used = new Set<string>();

    for (const r of requests) {
      if (!Number.isFinite(r.fare) || !Number.isFinite(r.pickupKm)) {
        unmatched++;
        continue;
      }
      const candidates = trips.filter(
        (t) =>
          !used.has(t.id) &&
          t.pickupKm == null &&
          Math.abs(t.fare - (t.commission ?? 0) - r.fare) < 1
      );
      let best = candidates[0] ?? null;
      if (candidates.length > 1 && r.clock) {
        // 12h clock without AM/PM — compare against both interpretations
        const [h, m] = r.clock.split(":").map(Number);
        const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
        const dist = (t: (typeof trips)[number]) => {
          const tm = minutesOf(new Date(t.startTime));
          const a = Math.abs(tm - ((h % 12) * 60 + m));
          const b = Math.abs(tm - (((h % 12) + 12) * 60 + m));
          return Math.min(a, b, 1440 - a, 1440 - b);
        };
        best = candidates.sort((x, y) => dist(x) - dist(y))[0];
      }
      if (!best) {
        unmatched++;
        continue;
      }
      used.add(best.id);
      const data: Record<string, unknown> = { pickupKm: r.pickupKm, pickupMin: r.pickupMin };
      if (best.distanceKm == null && r.tripKm != null) data.distanceKm = r.tripKm;
      await prisma.trip.update({ where: { id: best.id }, data });
      enriched++;
    }

    return NextResponse.json({ enriched, unmatched });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "import failed" }, { status: 400 });
  }
}
