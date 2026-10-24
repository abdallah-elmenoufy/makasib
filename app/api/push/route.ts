import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendPush, vapidPublicKey } from "@/lib/push";
import { getNotifyLocale, getNotifyPrefs, runNotifications } from "@/lib/notify";
import { DEFAULT_PREFS } from "@/lib/notifyRules";
import { translate } from "@/lib/i18n/messages";

/** Phone notifications: the key to subscribe with, and what to tell the driver about. */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ publicKey: await vapidPublicKey(), prefs: await getNotifyPrefs(), devices: await prisma.pushSubscription.count() });
}

/**
 * {action:"subscribe", subscription, locale} · {action:"unsubscribe", endpoint}
 * · {action:"prefs", prefs, locale} · {action:"test"} · {action:"run"} — the
 * last also accepts header x-cron-secret = CRON_SECRET for an external cron.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const cron = !!process.env.CRON_SECRET && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  if (!(await isAuthed()) && !(cron && body.action === "run")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const setLocale = async (l: unknown) => {
    if (l === "ar" || l === "en") await prisma.setting.upsert({ where: { key: "notify.locale" }, create: { key: "notify.locale", value: l }, update: { value: l } });
  };
  switch (body.action) {
    case "subscribe": {
      const s = body.subscription;
      if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
      await prisma.pushSubscription.upsert({
        where: { endpoint: s.endpoint },
        create: { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
        update: { p256dh: s.keys.p256dh, auth: s.keys.auth },
      });
      await setLocale(body.locale);
      return NextResponse.json({ ok: true });
    }
    case "unsubscribe":
      if (typeof body.endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
      return NextResponse.json({ ok: true });
    case "prefs": {
      const prefs = { ...(await getNotifyPrefs()) };
      for (const k of Object.keys(DEFAULT_PREFS) as (keyof typeof DEFAULT_PREFS)[]) if (typeof body.prefs?.[k] === "boolean") prefs[k] = body.prefs[k];
      await prisma.setting.upsert({ where: { key: "notify.prefs" }, create: { key: "notify.prefs", value: JSON.stringify(prefs) }, update: { value: JSON.stringify(prefs) } });
      await setLocale(body.locale);
      return NextResponse.json({ prefs });
    }
    case "test": {
      const l = await getNotifyLocale();
      const r = await sendPush({ title: translate(l, "ntf.test.title"), body: translate(l, "ntf.test.body"), url: "/settings", tag: "test", lang: l, dir: l === "ar" ? "rtl" : "ltr" });
      return NextResponse.json(r);
    }
    case "run":
      return NextResponse.json(await runNotifications());
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
