import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// Prisma 7 talks to SQLite through a driver adapter (better-sqlite3). The
// URL comes from DATABASE_URL (see .env.example) and defaults to
// <repo>/data/app.db; a relative path is resolved from the project root so
// the app and the Prisma CLI (prisma.config.ts) always mean the same file.
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/app.db";
  const p = raw.replace(/^file:/, "");
  if (p.startsWith("/")) return `file:${p}`;
  return `file:${path.resolve(process.cwd(), p)}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
