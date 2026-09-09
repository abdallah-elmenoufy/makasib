import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCommunityPlan } from "@/lib/planner";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const excludeVehicleId = req.nextUrl.searchParams.get("vehicleId") ?? undefined;
    return NextResponse.json(await getCommunityPlan(excludeVehicleId));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
