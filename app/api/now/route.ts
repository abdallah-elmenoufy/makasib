import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getNowSuggestion } from "@/lib/now";

/** Where to go right now — see lib/now.ts. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    return NextResponse.json(await getNowSuggestion(vehicleId));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
