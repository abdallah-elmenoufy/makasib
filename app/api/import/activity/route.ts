import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { applyTrips, IncomingTrip } from "@/lib/importApply";

// Receives trips the client parsed from OCR'd Earnings Activity screenshots
// (already reviewed/edited by the user in the preview table).
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { vehicleId, trips } = (await req.json()) as {
      vehicleId: string;
      trips: {
        startTime: string;
        earnings: number;
        cashCollected: number | null;
        distanceKm: number | null;
        product: string | null;
      }[];
    };
    if (!vehicleId || !Array.isArray(trips)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    const incoming: IncomingTrip[] = trips
      .filter((t) => t.startTime && Number.isFinite(t.earnings))
      .map((t) => ({
        startTime: new Date(t.startTime),
        earnings: t.earnings,
        cashCollected: t.cashCollected,
        isCash: t.cashCollected != null,
        distanceKm: t.distanceKm,
        product: t.product,
        source: "OCR" as const,
        platform: "UBER",
      }));

    const result = await applyTrips(vehicleId, incoming);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "import failed" }, { status: 400 });
  }
}
