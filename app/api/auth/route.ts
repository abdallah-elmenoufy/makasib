import { NextRequest, NextResponse } from "next/server";
import {
  isSetup,
  setPassphrase,
  checkPassphrase,
  createSession,
  destroySession,
  isAuthed,
} from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ setup: await isSetup(), authed: await isAuthed() });
}

export async function POST(req: NextRequest) {
  const { action, passphrase, newPassphrase } = await req.json();

  if (action === "setup") {
    if (await isSetup()) return NextResponse.json({ error: "already setup" }, { status: 400 });
    if (!passphrase || passphrase.length < 4) {
      return NextResponse.json({ error: "too short" }, { status: 400 });
    }
    await setPassphrase(passphrase);
    await createSession();
    return NextResponse.json({ ok: true });
  }

  if (action === "login") {
    if (!(await checkPassphrase(passphrase ?? ""))) {
      return NextResponse.json({ error: "wrong" }, { status: 401 });
    }
    await createSession();
    return NextResponse.json({ ok: true });
  }

  if (action === "change") {
    if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!(await checkPassphrase(passphrase ?? ""))) {
      return NextResponse.json({ error: "wrong" }, { status: 401 });
    }
    if (!newPassphrase || newPassphrase.length < 4) {
      return NextResponse.json({ error: "too short" }, { status: 400 });
    }
    await setPassphrase(newPassphrase);
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await destroySession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
