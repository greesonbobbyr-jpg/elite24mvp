import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./*" so tests import modules the same way
    // app code does.
    alias: { "@": resolve(__dirname) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // DB-backed tests (season invariant, shim identity) connect to the local
    // throwaway Postgres via TEST_DATABASE_URL and self-skip when it's absent.
    // The placeholder below only satisfies PrismaClient construction for pure
    // unit tests that import modules touching lib/prisma — it is never
    // connected to (DB tests overwrite it with TEST_DATABASE_URL first).
    environment: "node",
    // The DB suites share one local Postgres — parallel files would see each
    // other's mid-test worlds (e.g. the season sweep catching the dual-write
    // suite's throwaway org between its create and teardown).
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:9/placeholder",
    },
  },
});
