import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ENTITIES, coerceBody } from "@/lib/crud";
import { matchTripToShift } from "@/lib/analytics";

type Ctx = { params: Promise<{ entity: string }> };

function delegate(model: string) {
  return (prisma as unknown as Record<string, any>)[model];
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });

    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const where = vehicleId && entity !== "vehicles" ? { vehicleId } : {};
    const rows = await delegate(config.model).findMany({ where, orderBy: config.orderBy });
    return NextResponse.json(rows);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });

    const body = await req.json();
    const data = coerceBody(config, body);

    // auto-attach a trip to the shift covering its start time
    if (entity === "trips" && !data.shiftId && data.vehicleId && data.startTime) {
      data.shiftId = await matchTripToShift(data.vehicleId as string, data.startTime as Date);
    }

    const row = await delegate(config.model).create({ data });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
