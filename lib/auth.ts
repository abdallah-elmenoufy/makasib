import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const SESSION_COOKIE = "up_session";
const SESSION_DAYS = 30;

async function getSecret(): Promise<Uint8Array> {
  let row = await prisma.setting.findUnique({ where: { key: "sessionSecret" } });
  if (!row) {
    row = await prisma.setting.upsert({
      where: { key: "sessionSecret" },
      create: { key: "sessionSecret", value: crypto.randomUUID() + crypto.randomUUID() },
      update: {},
    });
  }
  return new TextEncoder().encode(row.value);
}

export async function isSetup(): Promise<boolean> {
  return !!(await prisma.setting.findUnique({ where: { key: "passphraseHash" } }));
}

export async function setPassphrase(passphrase: string): Promise<void> {
  const hash = await bcrypt.hash(passphrase, 10);
  await prisma.setting.upsert({
    where: { key: "passphraseHash" },
    create: { key: "passphraseHash", value: hash },
    update: { value: hash },
  });
}

export async function checkPassphrase(passphrase: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "passphraseHash" } });
  if (!row) return false;
  return bcrypt.compare(passphrase, row.value);
}

export async function createSession(): Promise<void> {
  const jwt = await new SignJWT({ authed: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await getSecret());
  (await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, await getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Throws a Response(401) — use at the top of API route handlers. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}
