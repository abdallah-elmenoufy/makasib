import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

// Web push without a third-party service: the server signs each message with
// its own VAPID key pair (made once, kept in the Setting table) and hands it
// to the browser's push service (Google, Apple, Mozilla), which wakes the
// phone. Nothing about the driver's numbers leaves the server except the
// notification text itself, encrypted end to end to the subscribed browser.

type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null = null;

async function vapid(): Promise<Vapid> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const row = await prisma.setting.findUnique({ where: { key: "vapid" } });
  if (row) {
    cached = JSON.parse(row.value) as Vapid;
    return cached;
  }
  const keys = webpush.generateVAPIDKeys();
  await prisma.setting.upsert({ where: { key: "vapid" }, create: { key: "vapid", value: JSON.stringify(keys) }, update: {} });
  // a concurrent first call may have won the race; read back whichever is stored
  const stored = await prisma.setting.findUniqueOrThrow({ where: { key: "vapid" } });
  cached = JSON.parse(stored.value) as Vapid;
  return cached;
}

export async function vapidPublicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string; lang?: string; dir?: "rtl" | "ltr" };

/** Send to every subscribed device; drops subscriptions the push service says are gone. */
export async function sendPush(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return { sent: 0, failed: 0 };
  const keys = await vapid();
  // Apple's push service rejects a localhost or malformed subject, so default to a mailto
  const subject = process.env.VAPID_SUBJECT || "mailto:makasib@example.com";
  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 6 * 3600, urgency: "normal" }
      );
      sent++;
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
    } catch (e: any) {
      failed++;
      if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else console.error("push failed", e?.statusCode ?? e);
    }
  }
  return { sent, failed };
}
