import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getQuestStatus } from "@/lib/questStatus";

/** `?vehicleId=…` → running and just-ended quests with progress (lib/questStatus.ts). */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    return NextResponse.json(await getQuestStatus(vehicleId));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
