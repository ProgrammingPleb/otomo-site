import 'dotenv/config'; // This must stay first regardless.
import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./app/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl
  },
});
