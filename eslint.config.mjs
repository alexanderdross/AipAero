// Flat ESLint config (ESLint 9). Replaces the legacy .eslintrc.mjs.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import drizzlePlugin from "eslint-plugin-drizzle";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "drizzle/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/server/db/migrations/**",
      "crawlers/**",
      "public/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  // We deliberately use the non-type-checked presets: type-checked rules
  // flag a lot of pre-existing framework idioms (next-intl dynamic imports,
  // Next.js empty page-props, tailwind plugin require()) without catching
  // many real bugs. Tighten to type-checked in a focused follow-up once those
  // sites are refactored.
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    plugins: {
      drizzle: drizzlePlugin,
    },
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "drizzle/enforce-delete-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
    },
  },
  {
    // JS config files don't need typed linting.
    files: ["*.js", "*.mjs", "*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
);
