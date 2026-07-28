import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCarModelBenchmark, getCarModelBenchmarkForModel } from "@/lib/carBenchmark";

// GET ?vehicleId=  → benchmark for an existing vehicle against its own catalog model
// GET ?carModelId= → live preview for the car-add form, before a vehicle exists
// (optionally &excludeVehicleId= when editing, so the vehicle doesn't count against itself)
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const carModelId = req.nextUrl.searchParams.get("carModelId");
    const excludeVehicleId = req.nextUrl.searchParams.get("excludeVehicleId") ?? undefined;

    if (vehicleId) {
      const result = await getCarModelBenchmark(vehicleId);
      return NextResponse.json(result);
    }
    if (carModelId) {
      const result = await getCarModelBenchmarkForModel(carModelId, excludeVehicleId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "vehicleId or carModelId required" }, { status: 400 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
