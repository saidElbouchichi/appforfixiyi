import react from "@fixiyi/eslint-config/react";

export default [
  ...react,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.js", "*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
