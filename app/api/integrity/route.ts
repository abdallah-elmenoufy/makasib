import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkIntegrity } from "@/lib/tripIntegrity";

/** Reconciles first, then reports only what still needs the driver — powers
 *  the logging banner on the trips/shifts pages. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    return NextResponse.json(await checkIntegrity(vehicleId));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
