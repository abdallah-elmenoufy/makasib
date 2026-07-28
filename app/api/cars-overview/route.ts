import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProfileAnalytics } from "@/lib/analytics";
import { getVehicleSummaries } from "@/lib/vehicleSummary";
import { buildCarInsights } from "@/lib/carInsights";

export async function GET() {
  try {
    await requireAuth();
    const [summaries, profile] = await Promise.all([getVehicleSummaries(), getProfileAnalytics("all")]);
    const insights = buildCarInsights(summaries, profile);
    return NextResponse.json({ summaries, insights });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
