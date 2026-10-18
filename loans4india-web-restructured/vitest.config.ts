import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next's guard against importing server code into the browser; irrelevant under test.
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/globalSetup.ts"],
    setupFiles: ["tests/support/setup.ts"],
    // Each test file runs in its own process against its own copy of the template database, so files run in parallel.
    pool: "forks",
    testTimeout: 20000,
  },
});
