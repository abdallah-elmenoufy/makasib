import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { maybePurgeUploads } from "@/lib/purge";
import { writeFile, mkdir, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import crypto from "crypto";

const execFileP = promisify(execFile);
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif"]);

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    maybePurgeUploads();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase() || ".jpg";
    if (!ALLOWED.has(ext)) return NextResponse.json({ error: "bad type" }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "too large" }, { status: 400 });
    }

    let name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

    // iPhone HEIC: browsers can't decode it (broken previews, no OCR) —
    // convert to JPEG via macOS `sips`. TODO phase 2: sharp/libheif on Linux.
    if (ext === ".heic") {
      const jpgName = name.replace(/\.heic$/, ".jpg");
      try {
        await execFileP("sips", [
          "-s", "format", "jpeg",
          "-s", "formatOptions", "85",
          path.join(UPLOAD_DIR, name),
          "--out", path.join(UPLOAD_DIR, jpgName),
        ]);
        await unlink(path.join(UPLOAD_DIR, name));
        name = jpgName;
      } catch (err) {
        console.error("HEIC conversion failed, keeping original:", err);
      }
    }

    return NextResponse.json({ filename: name });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
