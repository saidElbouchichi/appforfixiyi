import react from "@fixiyi/eslint-config/react";

export default [
  ...react,
  {
    languageOptions: {
      parserOptions: {
        // `*.ts` covers tsup.config.ts / vitest.config.ts, deliberately kept out
        // of tsconfig.json's `include` (they sit outside `rootDir`).
        projectService: { allowDefaultProject: ["*.js", "*.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
