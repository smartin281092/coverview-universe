import { defineConfig } from "vitest/config";

// Un point d'entrée permet aussi `pnpm test apps/api/src/...test.ts`.
export default defineConfig({
  test: {
    include: ["apps/api/src/**/*.test.ts", "packages/api-client/src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
