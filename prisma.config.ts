import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI operations need a session-capable connection. Runtime queries
    // continue to use the transaction pooler via src/lib/server/db/prisma.ts.
    url: env("DIRECT_URL"),
  },
});
