import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import base from "./base.js";

/**
 * React / Next.js (web, admin) flat ESLint config.
 *
 * `eslint-plugin-react` (the classic package) is NOT used here: its
 * `Components` rule utility still calls the removed `context.getFilename()`
 * API and crashes outright under ESLint 10 (see docs/DECISIONS.md).
 * `@eslint-react/eslint-plugin` is the replacement -- peer `eslint: "*"`,
 * built for flat config, TypeScript-aware. Its own hook rules duplicate
 * `eslint-plugin-react-hooks` (the official, React-team-maintained plugin,
 * kept here as the single source of truth for hooks rules), so those
 * duplicates are turned off below to avoid double-reporting.
 */
export default [
  ...base,
  eslintReact.configs["recommended-type-checked"],
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/static-components": "off",
      "@eslint-react/unsupported-syntax": "off",
      "@eslint-react/use-memo": "off",
      "@eslint-react/error-boundaries": "off",
    },
  },
];
