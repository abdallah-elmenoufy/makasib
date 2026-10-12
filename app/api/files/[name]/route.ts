import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  try {
    await requireAuth();
    const { name } = await ctx.params;
    const safe = path.basename(name); // strip any path traversal
    const buf = await readFile(path.join(UPLOAD_DIR, safe));
    const type = MIME[path.extname(safe).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": type } });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
