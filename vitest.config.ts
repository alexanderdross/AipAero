import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest runs the website's TypeScript unit tests (the Python crawlers use
// pytest — see crawlers/tests/). Pure-logic specs run in the default `node`
// environment; component specs opt into jsdom with a `// @vitest-environment
// jsdom` docblock at the top of the file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
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
