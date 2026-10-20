import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Runs against a local Supabase stack. See docs/saas-plan/FASE-3-AUTH-BANCO.md.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
