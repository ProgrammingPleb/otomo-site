import { defineConfig } from "drizzle-kit";
import { postgresUser, postgresPassword, postgresDB } from "./app/utils/db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `postgres://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDB}`
  },
});
