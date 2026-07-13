import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// No auth: switching UI language is allowed from the login screen too.
export async function POST(req: NextRequest) {
  const { locale } = await req.json();
  (await cookies()).set("locale", locale === "ar" ? "ar" : "en", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
