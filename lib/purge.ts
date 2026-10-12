import "server-only";
import { prisma } from "./db";
import { readdir, stat, unlink } from "fs/promises";
import path from "path";

// Photo retention. Trip screenshots are never stored at all — they're read
// in the browser and dropped. Only odometer/receipt photos live on disk
// (data/uploads; the DB holds just the filename). Those get purged after the
// configured number of days — extracted numbers stay, the pixels go.

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
export const MAX_RETENTION_DAYS = 30;
export const DEFAULT_RETENTION_DAYS = 30;

export async function getRetentionDays(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "photoRetentionDays" } });
  const n = row ? Number(row.value) : DEFAULT_RETENTION_DAYS;
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(1, Math.round(n)));
}

export async function setRetentionDays(days: number): Promise<void> {
  const clamped = String(Math.min(MAX_RETENTION_DAYS, Math.max(1, Math.round(days))));
  await prisma.setting.upsert({
    where: { key: "photoRetentionDays" },
    create: { key: "photoRetentionDays", value: clamped },
    update: { value: clamped },
  });
}

async function purgeOldUploads(): Promise<number> {
  const days = await getRetentionDays();
  const cutoff = Date.now() - days * 86_400_000;
  let files: string[] = [];
  try {
    files = await readdir(UPLOAD_DIR);
  } catch {
    return 0;
  }

  let purged = 0;
  for (const name of files) {
    const full = path.join(UPLOAD_DIR, name);
    try {
      const st = await stat(full);
      if (!st.isFile() || st.mtimeMs >= cutoff) continue;
      await unlink(full);
      purged++;
      // clear dangling references so the UI doesn't render broken images
      await prisma.shift.updateMany({ where: { startPhoto: name }, data: { startPhoto: null } });
      await prisma.shift.updateMany({ where: { endPhoto: name }, data: { endPhoto: null } });
      await prisma.fuelUp.updateMany({ where: { photo: name }, data: { photo: null } });
      await prisma.maintenance.updateMany({ where: { photo: name }, data: { photo: null } });
    } catch {
      // skip files we can't touch
    }
  }
  return purged;
}

let lastRun = 0;

/** Cheap lazy scheduler: piggybacks on normal requests, runs at most every 6h. */
export function maybePurgeUploads(): void {
  const now = Date.now();
  if (now - lastRun < 6 * 3_600_000) return;
  lastRun = now;
  purgeOldUploads()
    .then((n) => n > 0 && console.log(`purged ${n} old photo(s)`))
    .catch((e) => console.error("photo purge failed:", e));
}
