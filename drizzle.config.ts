import 'dotenv/config'; // This must stay first regardless.
import { defineConfig } from "drizzle-kit";
import { databaseUrl, postgresDB, postgresHost, postgresPassword, postgresPort, postgresUser } from "./app/env";

if (!postgresUser || !postgresPassword || !postgresHost || !postgresPort || !postgresDB) {
  throw new Error("DB: Details were not set!");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl
  },
});
