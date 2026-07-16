import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import { access, constants } from "fs/promises";
import path from "path";

const execFileP = promisify(execFile);
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const TOOL_DIR = path.join(process.cwd(), "tools");
const BIN = path.join(TOOL_DIR, "vision-ocr");

let compiling: Promise<void> | null = null;

// Apple Vision OCR (phase 1: the server is a Mac). Reads 7-segment dashboard
// LCDs that tesseract can't. Compiled from tools/vision-ocr.swift on first use.
async function ensureBinary(): Promise<boolean> {
  try {
    await access(BIN, constants.X_OK);
    return true;
  } catch {
    // not compiled yet
  }
  if (!compiling) {
    compiling = execFileP("xcrun", [
      "swiftc",
      "-O",
      path.join(TOOL_DIR, "vision-ocr.swift"),
      "-o",
      BIN,
    ]).then(
      () => undefined,
      (e) => {
        compiling = null;
        throw e;
      }
    );
  }
  try {
    await compiling;
    return true;
  } catch {
    return false; // no swift toolchain — caller falls back to tesseract
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  try {
    await requireAuth();
    const { name } = await ctx.params;
    const safe = path.basename(name);
    if (!(await ensureBinary())) {
      return NextResponse.json({ error: "vision unavailable" }, { status: 501 });
    }
    const { stdout } = await execFileP(BIN, [path.join(UPLOAD_DIR, safe)], {
      timeout: 30_000,
    });
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    return NextResponse.json({ lines });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "ocr failed" }, { status: 500 });
  }
}
