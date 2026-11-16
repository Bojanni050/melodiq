import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // The suite must not inherit the ambient NODE_ENV. Run under
    // NODE_ENV=production (a CI job that exports it before `npm run build`, or a
    // shell that still has it from one) and 14 tests fail for two environment
    // reasons that have nothing to do with the code: React's production build
    // has no `act`, so @testing-library's act-compat falls back to
    // react-dom/test-utils and every render throws "React.act is not a
    // function"; and with the production export condition the `node:` builtins
    // stop resolving ("No such built-in module: node:") in cover-cache,
    // upload-overrides and audio-format. Pinning it here makes the suite
    // deterministic wherever it runs.
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
