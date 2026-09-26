import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run test files sequentially — each suite hits the real DB so
    // parallel runs would cause data collisions
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },

    // Each test file gets its own isolated context
    isolate: true,

    // Global test timeout (integration tests hit a remote DB)
    testTimeout: 30_000,
    hookTimeout: 30_000,

    // Load env before every test file
    env: {},

    // Only look for tests in src/tests/
    include: ["src/tests/**/*.test.js"],

    // Reporter
    reporter: ["verbose"],
  },
});
