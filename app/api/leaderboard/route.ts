import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { Period } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
    const vehicleId = req.nextUrl.searchParams.get("vehicleId") ?? undefined;
    return NextResponse.json(await getLeaderboard(period, vehicleId));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
