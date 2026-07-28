import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Read-only: the catalog is curated/seeded (prisma/seed.ts), not user-editable,
// so this doesn't go through the generic mutable [entity] CRUD route.
export async function GET() {
  try {
    await requireAuth();
    const models = await prisma.carModel.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }] });
    return NextResponse.json(models);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
