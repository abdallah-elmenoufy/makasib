import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { reconcileAllVehicles } from "@/lib/analytics";

/** Manual trigger for the same sweep the lazy periodic health check runs —
 * lets a driver ask "is everything tied together right now?" instead of
 * waiting for the next automatic pass. */
export async function POST() {
  try {
    await requireAuth();
    const fixed = await reconcileAllVehicles();
    return NextResponse.json({ fixed });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
