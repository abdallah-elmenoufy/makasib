import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProfileAnalytics, Period } from "@/lib/analytics";
import { maybePurgeUploads } from "@/lib/purge";
import { maybeReconcileTrips } from "@/lib/healthCheck";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    maybePurgeUploads();
    maybeReconcileTrips();
    const period = (req.nextUrl.searchParams.get("period") ?? "week") as Period;
    return NextResponse.json(await getProfileAnalytics(period));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
