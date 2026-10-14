#!/usr/bin/env node
// Bring an existing Makasib database up to the current schema WITHOUT ever
// dropping anything.
//
//   npm run db:sync
//
// Why not `prisma db push`: it diffs the live database against the schema and
// DROPS any column it does not know about — which is how a copied production
// database lost its colour/transmission values. Why not plain `prisma migrate
// deploy`: it fails when a migration tries to add a column the database
// already has (because that column was added by hand, or by a migration that
// only ever lived on one machine).
//
// This script reads every migration in prisma/migrations, checks which of its
// statements are already true in the database (table exists / column exists),
// applies only the missing statements, records the migration as applied, and
// finishes with `prisma migrate deploy` so Prisma's own bookkeeping agrees.
// Nothing is ever dropped; unknown extra columns are left alone.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "prisma", "migrations");

// --- resolve DATABASE_URL the way Prisma does (from .env, relative to prisma/) ---
if (!process.env.DATABASE_URL) {
  const envFile = join(root, ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = /^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/.exec(line);
      if (m) process.env.DATABASE_URL = m[1];
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}
const dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
const absDb = dbPath.startsWith("/") ? dbPath : resolve(root, "prisma", dbPath);
console.log(`Database: ${absDb}`);
if (!existsSync(absDb)) {
  console.log("No database file yet — creating it with prisma migrate deploy.");
  run("npx", ["prisma", "migrate", "deploy"]);
  process.exit(0);
}

const prisma = new PrismaClient();

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name);
  return rows.length > 0;
}
async function columnExists(table, column) {
  if (!(await tableExists(table))) return false;
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return rows.some((r) => r.name === column);
}
async function appliedMigrations() {
  if (!(await tableExists("_prisma_migrations"))) return new Set();
  const rows = await prisma.$queryRawUnsafe(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`);
  return new Set(rows.map((r) => r.migration_name));
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n${cmd} ${args.join(" ")} failed.`);
    process.exit(r.status ?? 1);
  }
}

// split a migration file into statements, ignoring comments
function statementsOf(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const applied = await appliedMigrations();
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let touched = 0;
  for (const name of dirs) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
    const stmts = statementsOf(sql);
    let alreadyTrue = 0;
    const missing = [];
    for (const st of stmts) {
      let m;
      if ((m = /^ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/i.exec(st))) {
        if (await columnExists(m[1], m[2])) alreadyTrue++;
        else missing.push(st);
      } else if ((m = /^CREATE TABLE "(\w+)"/i.exec(st))) {
        if (await tableExists(m[1])) alreadyTrue++;
        else missing.push(st);
      } else if ((m = /^CREATE (?:UNIQUE )?INDEX "(\w+)"/i.exec(st))) {
        const rows = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, m[1]);
        if (rows.length > 0) alreadyTrue++;
        else missing.push(st);
      } else {
        // UPDATE / other data statements: safe to re-run
        missing.push(st);
      }
    }
    if (alreadyTrue === 0 && missing.length === stmts.length) continue; // plain pending: deploy handles it
    console.log(`${name}: ${alreadyTrue} part(s) already in place, applying ${missing.length} missing part(s)`);
    for (const st of missing) await prisma.$executeRawUnsafe(st);
    await prisma.$disconnect();
    run("npx", ["prisma", "migrate", "resolve", "--applied", name]);
    touched++;
  }
  await prisma.$disconnect();
  if (touched === 0) console.log("No partially-applied migrations; running prisma migrate deploy.");
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["prisma", "generate"]);
  console.log("\nDatabase is in sync. Nothing was dropped.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
