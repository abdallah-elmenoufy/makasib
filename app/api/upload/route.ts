import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif"]);

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase() || ".jpg";
    if (!ALLOWED.has(ext)) return NextResponse.json({ error: "bad type" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "too large" }, { status: 400 });
    }

    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ filename: name });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
