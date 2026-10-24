import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getKeepOrSell } from "@/lib/keepOrSell";

/** `?vehicleId=` → the keep-or-sell picture for that car. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const id = req.nextUrl.searchParams.get("vehicleId");
    if (!id) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    return NextResponse.json(await getKeepOrSell(id));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
