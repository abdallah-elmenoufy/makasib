import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { reconcileAll } from "@/lib/tripIntegrity";
import { prisma } from "@/lib/db";
import { locateVehicleTrips } from "@/lib/tripLocation";

/** Manual trigger for the same sweep the lazy periodic health check runs —
 * lets a driver ask "is everything tied together right now?" instead of
 * waiting for the next automatic pass. */
export async function POST() {
  try {
    await requireAuth();
    const fixed = await reconcileAll();
    // also place any trip whose shift has a GPS track but no coordinates yet
    const vehicles = await prisma.vehicle.findMany({ select: { id: true } });
    let located = 0;
    for (const v of vehicles) located += await locateVehicleTrips(v.id);
    return NextResponse.json({ fixed, located });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
