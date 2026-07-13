import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { matchTripToShift } from "@/lib/analytics";

type ImportRow = {
  startTime: string;
  fare: string | number;
  distanceKm?: string | number;
  paymentType?: string;
  tip?: string | number;
};

function num(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, "")); // strip currency symbols
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { vehicleId, platform, rows } = (await req.json()) as {
      vehicleId: string;
      platform: string;
      rows: ImportRow[];
    };
    if (!vehicleId || !Array.isArray(rows)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    let imported = 0;
    let matched = 0;
    for (const row of rows) {
      const startTime = new Date(row.startTime);
      const fare = num(row.fare);
      if (isNaN(startTime.getTime()) || fare === null) continue;

      const payRaw = (row.paymentType ?? "").toString().toLowerCase();
      const paymentType = /cash|كاش|نقد/.test(payRaw) ? "CASH" : payRaw ? "CARD" : "CASH";

      const shiftId = await matchTripToShift(vehicleId, startTime);
      if (shiftId) matched++;

      await prisma.trip.create({
        data: {
          vehicleId,
          shiftId,
          platform: platform || "UBER",
          startTime,
          fare,
          distanceKm: num(row.distanceKm),
          tip: num(row.tip) ?? 0,
          paymentType,
          source: "CSV",
        },
      });
      imported++;
    }

    return NextResponse.json({ imported, matched });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "import failed" }, { status: 400 });
  }
}
