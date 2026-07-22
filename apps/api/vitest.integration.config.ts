import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Database-backed integration tests. These run against a real PostgreSQL
 * started by the global setup, with the committed migrations applied from an
 * empty database.
 *
 * Tests run in a single fork so they share one database without racing.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    environment: "node",
    include: ["test/integration/**/*.int.spec.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    teardownTimeout: 60_000,
  },
});
