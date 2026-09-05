// ESLint flat config — CONV-01, ARCH-09, INTL-08, G-15.
//
// Ce qui est ici est ce que le référentiel rend MÉCANIQUEMENT vérifiable.
// Le reste des conventions vit dans docs/conventions.md et se vérifie en revue.
// Toute nouvelle convention vérifiable DOIT arriver ici en même temps que dans
// le référentiel (ARCH-14) — sinon elle se viole silencieusement.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**", "**/.astro/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { unicorn },
    rules: {
      // ARCH-09 — pas de fichiers dépotoirs. La liste est celle du référentiel.
      "unicorn/filename-case": [
        "error",
        { cases: { kebabCase: true, pascalCase: true }, ignore: ["^[a-z]+\\.[a-z]+\\.ts$"] },
      ],

      // BACK-09 — ne pas avaler les erreurs. Un catch vide est interdit.
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // CTR-01 — `any` explicite est un contournement du typage, pas une solution.
      "@typescript-eslint/no-explicit-any": "error",

      // DATA-11 — jamais de float pour un montant : parseFloat sur de l'argent
      // est le bug le plus discret du lot. Cette règle ne l'attrape pas seule,
      // mais elle rend visible tout usage à relire.
      "no-restricted-globals": [
        "error",
        { name: "parseFloat", message: "Montants : entiers en unité mineure ou NUMERIC (DATA-11). Pour le reste, Number()." },
      ],
    },
  },

  // ARCH-09 — noms de fichiers interdits, quelle que soit la casse.
  {
    files: ["**/{utils,helpers,common,misc,manager,shared}.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Program", message: "ARCH-09 — fichier dépotoir. Nommer par ce qu'il fait : proration-calculation.ts, deployment-transitions.ts." },
      ],
    },
  },

  // INTL-08 — chaînes littérales dans le JSX.
  // DÉSACTIVÉE tant que l'i18n n'est pas câblée : une règle qui crie sur un
  // projet vide est une règle qu'on supprime. L'activer à la première slice UI.
  {
    files: ["apps/{client,admin}/**/*.tsx"],
    rules: {
      // "react/jsx-no-literals": ["error", { noStrings: true, allowedStrings: ["·", "—", "/"] }],
    },
  },

  // Les tests ont le droit d'être verbeux et de mentir sur les types.
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  prettier,
);
