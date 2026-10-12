import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ENTITIES, coerceBody } from "@/lib/crud";
import { reconcileVehicle } from "@/lib/tripIntegrity";
import { locateTrips, locateShiftTrips } from "@/lib/tripLocation";

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

    // a closed shift must carry an end odometer: every km-based cost (fuel,
    // maintenance, depreciation) is charged per shift km, so a shift with an
    // end time but no reading would silently drop its km from the maths
    if (entity === "shifts") {
      const existing = await delegate(config.model).findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
      const merged = { ...existing, ...data };
      if (merged.endTime != null && (merged.endOdometer == null || !(merged.endOdometer > merged.startOdometer))) {
        return NextResponse.json({ error: "endOdometer required" }, { status: 400 });
      }
    }

    const row = await delegate(config.model).update({ where: { id }, data });

    // Editing either side of the relationship can change which trips belong
    // to which shift: moving a shift's window may newly cover an orphan, and
    // correcting a trip's time may move it into a shift. Reconcile on both,
    // awaited, so the response already reflects the corrected state.
    if (entity === "shifts" || entity === "trips") {
      await reconcileVehicle(row.vehicleId);
      if (entity === "trips") await locateTrips([row]);
      else await locateShiftTrips(row.id);
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
    // capture the owning vehicle before the row is gone
    const doomed = entity === "shifts" ? await delegate(config.model).findUnique({ where: { id } }) : null;
    await delegate(config.model).delete({ where: { id } });
    // deleting a shift sets its trips' shiftId to null (schema onDelete:
    // SetNull) — immediately try to re-home them onto another covering
    // shift so they don't silently drop out of the km/cost maths
    if (doomed?.vehicleId) await reconcileVehicle(doomed.vehicleId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
