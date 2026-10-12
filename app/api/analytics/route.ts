import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAnalytics, Period } from "@/lib/analytics";
import { maybePurgeUploads } from "@/lib/purge";
import { maybeSweep } from "@/lib/tripIntegrity";
import { maybeGeocode } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    maybePurgeUploads();
    maybeSweep();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    maybeGeocode(vehicleId);
    return NextResponse.json(await getAnalytics(vehicleId, period));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
