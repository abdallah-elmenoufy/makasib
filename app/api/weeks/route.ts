import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getWeeklyReport } from "@/lib/weekly";

/** Uber-week analytics: `?vehicleId=…&weeks=12` → lib/weekly.ts report. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    const weeks = Number(req.nextUrl.searchParams.get("weeks") ?? "12") || 12;
    return NextResponse.json(await getWeeklyReport(vehicleId, weeks));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
