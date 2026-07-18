import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getBenchmark } from "@/lib/benchmark";
import { Period } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    return NextResponse.json(await getBenchmark(vehicleId, period));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
