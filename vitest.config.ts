import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest runs the website's TypeScript unit tests (the Python crawlers use
// pytest — see crawlers/tests/). Pure logic only for now, so the default
// `node` environment is enough; add jsdom + a React testing library here if
// component tests are introduced later.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      // Mirror the `~/*` -> `./src/*` path alias from tsconfig.json so tests
      // import modules the same way the app does.
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
