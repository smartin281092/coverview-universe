import { defineConfig } from "drizzle-kit";

// Generation is offline. Executing SQL goes through the guarded maintenance CLI.
export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/platform/db/schema.ts",
    "./src/platform/admin-profile-transfer.schema.ts",
    "./src/modules/*/*.schema.ts",
  ],
  out: "./drizzle",
  strict: true,
});
