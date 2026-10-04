// Adaptation du scaffold : règles typées sur les projets TS, i18n dès les coquilles.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";
import globals from "globals";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.astro/**",
      "**/node_modules/**",
      ".planning-local/**",
      ".preview/**",
      "templates/**",
      "**/.preset-work/**",
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  { files: ["tests/e2e/**/*.mjs"], languageOptions: { globals: globals.browser } },
  {
    files: ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "packages/**/*.tsx"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          cases: { kebabCase: true, pascalCase: true },
          ignore: ["^[a-z]+\\.[a-z]+\\.ts$", "^vite-env\\.d\\.ts$", "^env\\.d\\.ts$"],
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "parseFloat",
          message: "Montants : entiers en unité mineure ou NUMERIC (DATA-11). Sinon Number().",
        },
      ],
    },
  },
  {
    files: ["**/{utils,helpers,common,misc,manager,shared}.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Program", message: "ARCH-09 — nommer le fichier par sa responsabilité." },
      ],
    },
  },
  {
    files: ["apps/{client,admin,partners}/**/*.tsx", "packages/ui/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/[^\\s]/]",
          message: "INTL-08 — texte utilisateur dans les catalogues i18n.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(title|placeholder|aria-label|alt)$/] > Literal[value=/[^\\s]/]",
          message: "INTL-08 — attribut lisible traduit par i18n.",
        },
      ],
    },
  },
  prettier,
);
