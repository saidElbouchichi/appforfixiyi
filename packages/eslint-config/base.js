import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

/**
 * Base flat ESLint config shared by every app/package.
 * Strict TypeScript: `any` is an error, not a warning (03_AGENT_PROTOCOL.md).
 * Escape hatch: a justified `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason`.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.turbo/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  prettier,
  {
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "import-x/order": [
        "warn",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/no-cycle": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Config files (this one included) commonly import loosely-typed tooling
    // packages; type-aware rules don't apply to them the way they do to app code.
    files: ["**/*.config.js", "**/*.config.mjs", "**/*.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
);
