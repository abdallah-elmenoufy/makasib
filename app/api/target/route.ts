import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDailyTarget } from "@/lib/target";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    const raw = req.nextUrl.searchParams.get("hours");
    const hours = raw != null && raw !== "" ? Number(raw) : undefined;
    return NextResponse.json(await getDailyTarget(vehicleId, hours));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
