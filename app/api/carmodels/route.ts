import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { CATALOG } from "@/lib/carCatalog";

// Read-only: the catalog is curated (lib/carCatalog.ts), not user-editable,
// so this doesn't go through the generic mutable [entity] CRUD route.
// Models added to the catalog after a database was seeded are inserted here
// on first read, so nobody has to re-run the seed script.
export async function GET() {
  try {
    await requireAuth();
    let models = await prisma.carModel.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }] });
    const have = new Set(models.map((m) => `${m.make}|${m.model}`));
    const missing = CATALOG.filter((c) => !have.has(`${c.make}|${c.model}`));
    if (missing.length > 0) {
      for (const m of missing) {
        await prisma.carModel.upsert({ where: { make_model: { make: m.make, model: m.model } }, create: m, update: {} });
      }
      models = await prisma.carModel.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }] });
    }
    return NextResponse.json(models);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
