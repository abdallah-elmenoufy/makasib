import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ENTITIES, coerceBody } from "@/lib/crud";
import { reconcileShiftTrips } from "@/lib/analytics";

type Ctx = { params: Promise<{ entity: string; id: string }> };

function delegate(model: string) {
  return (prisma as unknown as Record<string, any>)[model];
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity, id } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });
    const row = await delegate(config.model).findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity, id } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });
    const data = coerceBody(config, await req.json());
    const row = await delegate(config.model).update({ where: { id }, data });

    // ending a shift (or otherwise changing its window) may newly cover
    // trips that were orphaned or logged before the shift existed
    if (entity === "shifts") {
      await reconcileShiftTrips(row.vehicleId, row.id);
    }

    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth();
    const { entity, id } = await ctx.params;
    const config = ENTITIES[entity];
    if (!config) return NextResponse.json({ error: "unknown entity" }, { status: 404 });
    await delegate(config.model).delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
