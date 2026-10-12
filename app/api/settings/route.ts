import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCommissionPcts } from "@/lib/analytics";
import { getRetentionDays, setRetentionDays } from "@/lib/purge";
import { getGeocodeEnabled, setGeocodeEnabled } from "@/lib/geocode";

export async function GET() {
  try {
    await requireAuth();
    const locale = (await cookies()).get("locale")?.value ?? "en";
    const defaultVehicleRow = await prisma.setting.findUnique({ where: { key: "defaultVehicleId" } });
    return NextResponse.json({
      locale,
      commissionPcts: await getCommissionPcts(),
      photoRetentionDays: await getRetentionDays(),
      geocodeEnabled: await getGeocodeEnabled(),
      defaultVehicleId: defaultVehicleRow?.value ?? null,
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

    if (body.geocodeEnabled != null) {
      await setGeocodeEnabled(body.geocodeEnabled === true || body.geocodeEnabled === "true");
    }

    if (body.commissionPcts) {
      await prisma.setting.upsert({
        where: { key: "commissionPcts" },
        create: { key: "commissionPcts", value: JSON.stringify(body.commissionPcts) },
        update: { value: JSON.stringify(body.commissionPcts) },
      });
    }

    if (body.defaultVehicleId !== undefined) {
      await prisma.setting.upsert({
        where: { key: "defaultVehicleId" },
        create: { key: "defaultVehicleId", value: String(body.defaultVehicleId) },
        update: { value: String(body.defaultVehicleId) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
