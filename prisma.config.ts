import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 keeps the database URL here (not in schema.prisma). A relative
// SQLite path is resolved from this file's folder — the repo root — so the
// default ./data/app.db is <repo>/data/app.db for the CLI and for the app.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
  },
});
