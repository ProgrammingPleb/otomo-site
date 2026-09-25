import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

export const postgresUser = process.env.POSTGRES_USER ?? "otomo";
export const postgresPassword = process.env.POSTGRES_PASSWORD ?? "ChangeMe123!";
export const postgresDB = process.env.POSTGRES_DB ?? "otomo";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `postgres://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDB}`
  },
});
