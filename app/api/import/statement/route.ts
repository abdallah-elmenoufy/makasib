import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseStatementText } from "@/lib/uberStatement";
import { applyTrips, applyTip, applyFee, IncomingTrip } from "@/lib/importApply";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const form = await req.formData();
    const vehicleId = String(form.get("vehicleId") ?? "");
    const file = form.get("file") as File | null;
    if (!vehicleId || !file) return NextResponse.json({ error: "bad request" }, { status: 400 });

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    const { text } = await parser.getText();
    await parser.destroy();

    const parsed = parseStatementText(text);
    const tripRecords = parsed.records.filter((r) => r.kind === "trip");
    const trips: IncomingTrip[] = tripRecords.map((r) => ({
      startTime: r.eventAt,
      earnings: r.earnings,
      cashCollected: r.cashCollected,
      isCash: r.isCash,
      distanceKm: null,
      product: r.product,
      source: "STATEMENT",
      platform: "UBER",
    }));

    const result = await applyTrips(vehicleId, trips);

    let tips = 0;
    for (const r of parsed.records.filter((x) => x.kind === "tip")) {
      if ((await applyTip(vehicleId, r.eventAt, r.earnings, "Uber tip")) !== "skipped") tips++;
    }
    let bonuses = 0;
    for (const r of parsed.records.filter((x) => x.kind === "bonus")) {
      if ((await applyTip(vehicleId, r.eventAt, r.earnings, r.product)) !== "skipped") bonuses++;
    }
    let fees = 0;
    for (const r of parsed.records.filter((x) => x.kind === "fee")) {
      if (await applyFee(vehicleId, r.eventAt, r.earnings, r.product)) fees++;
    }

    return NextResponse.json({
      week: parsed.weekStart && parsed.weekEnd ? { start: parsed.weekStart, end: parsed.weekEnd } : null,
      totalRecords: parsed.records.length,
      trips: result,
      tips,
      bonuses,
      fees,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "parse failed" }, { status: 400 });
  }
}
