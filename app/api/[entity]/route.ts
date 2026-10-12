import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ENTITIES, coerceBody } from "@/lib/crud";
import { matchTripToShift } from "@/lib/analytics";
import { reconcileVehicle } from "@/lib/tripIntegrity";
import { locateTrips } from "@/lib/tripLocation";

type Ctx = { params: Promise<{ entity: string }> };

function delegate(model: string) {
  return (prisma as unknown as Record<string, any>)[model];
}

const MAX_PAGE_SIZE = 50;

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });

    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const where = vehicleId && entity !== "vehicles" ? { vehicleId } : {};

    // vehicles is a small, bounded list (one per car) — always returned in
    // full so the vehicle switcher/provider doesn't need pagination logic.
    // `all=1` is the same escape hatch for callers that need a complete,
    // unpaginated list for cross-referencing (e.g. the shifts page tallying
    // every trip's km/revenue per shift) rather than rendering it as a table.
    if (entity === "vehicles" || req.nextUrl.searchParams.get("all") === "1") {
      const rows = await delegate(config.model).findMany({ where, orderBy: config.orderBy });
      return NextResponse.json(rows);
    }

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
    const pageSize = MAX_PAGE_SIZE;
    const [rows, total] = await Promise.all([
      delegate(config.model).findMany({
        where,
        orderBy: config.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      delegate(config.model).count({ where }),
    ]);
    return NextResponse.json({ rows, total, page, pageSize });
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

    // a trip that knows its duration knows when it ended
    if (entity === "trips" && data.durationMin != null && data.startTime && data.endTime == null) {
      data.endTime = new Date((data.startTime as Date).getTime() + (data.durationMin as number) * 60_000);
    }

    const row = await delegate(config.model).create({ data });

    if (entity === "trips") await locateTrips([row]);

    // a new shift may cover trips logged earlier that had no shift to
    // attach to yet (including trips orphaned by a previously deleted shift)
    if (entity === "shifts") {
      await reconcileVehicle(row.vehicleId);
    }

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
