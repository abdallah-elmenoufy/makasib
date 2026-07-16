import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCommissionPcts } from "@/lib/analytics";
import { getRetentionDays, setRetentionDays } from "@/lib/purge";

export async function GET() {
  try {
    await requireAuth();
    const locale = (await cookies()).get("locale")?.value ?? "en";
    return NextResponse.json({
      locale,
      commissionPcts: await getCommissionPcts(),
      photoRetentionDays: await getRetentionDays(),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (body.locale) {
      (await cookies()).set("locale", body.locale === "ar" ? "ar" : "en", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    if (body.photoRetentionDays != null) {
      await setRetentionDays(Number(body.photoRetentionDays));
    }

    if (body.commissionPcts) {
      await prisma.setting.upsert({
        where: { key: "commissionPcts" },
        create: { key: "commissionPcts", value: JSON.stringify(body.commissionPcts) },
        update: { value: JSON.stringify(body.commissionPcts) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
