import globals from "globals";

import base from "./base.js";

/** Node.js (API, worker) flat ESLint config. */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // NestJS decorators rely on empty constructors / DI parameter properties.
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-useless-constructor": "off",
    },
  },
];
