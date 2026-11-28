import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30_000,
    exclude: ["e2e/**", "node_modules/**", "dist/**", "test-results/**"],
  },
});
