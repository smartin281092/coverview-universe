/**
 * Frontières imposées par l'outillage — ARCH-14, G-15.
 *
 * « Une règle en prose se viole silencieusement ; une erreur de lint, non. »
 * Ce fichier est le bras armé d'ARCH-11 (API publique par module) et ARCH-12
 * (pas de cycles). Il tourne en CI bloquante (`pnpm boundaries`, DEL-04).
 *
 * Toute nouvelle convention de frontière s'ajoute ICI en même temps que dans le
 * référentiel — sinon elle n'existe pas (G-15).
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "pas-de-cycle",
      comment:
        "ARCH-12 — dépendance circulaire entre modules. Redistribuer les responsabilités, " +
        "extraire un contrat commun, ou passer par un événement. NE PAS masquer le cycle " +
        "derrière l'event bus.",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    {
      name: "frontiere-de-module",
      comment:
        "ARCH-11 — un module s'importe par son point d'entrée, jamais par ses fichiers " +
        "internes. `import { deploymentService } from '../deployments'`, jamais " +
        "'../deployments/internal/sql'.",
      severity: "error",
      from: { path: "^apps/api/src/modules/([^/]+)/" },
      to: {
        path: "^apps/api/src/modules/([^/]+)/.+",
        pathNot: ["^apps/api/src/modules/$1/", "^apps/api/src/modules/[^/]+/index\\.ts$"],
      },
    },

    {
      name: "www-independant",
      comment:
        "MKT-02 — apps/www est une application indépendante : le site reste en ligne si " +
        "l'app est down, et inversement. Aucune dépendance au backend ni aux apps " +
        "authentifiées. Le contenu vit en Markdown/MDX ou dans un CMS.",
      severity: "error",
      from: { path: "^apps/www/" },
      to: { path: "^apps/(api|client|admin)/" },
    },

    {
      name: "contracts-sans-backend",
      comment:
        "CTR-04 — packages/contracts porte des schémas, types, codes d'erreur et clés de " +
        "permission. Jamais de logique métier, d'accès base, de modèle ORM ni de dépendance UI.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: { pathNot: "^packages/contracts/", path: "^(apps/|packages/)" },
    },

    {
      name: "frontends-sans-backend",
      comment:
        "ARCH-13 — un frontend parle au backend par le client API typé (packages/api-client), " +
        "jamais en important son code. Le backend reste l'autorité (G-11).",
      severity: "error",
      from: { path: "^apps/(client|admin)/" },
      to: { path: "^apps/api/" },
    },

    {
      name: "pas-de-dependance-orpheline",
      comment:
        "ARCH-10 / knip — un module qu'aucun autre n'importe est soit mort, soit mal placé. " +
        "Avertissement seulement : un point d'entrée légitime en déclenche aussi.",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "(^|/)(index|main)\\.ts$", "\\.config\\.[cm]?[jt]s$"] },
      to: {},
    },

    {
      name: "pas-de-dependance-de-dev-en-prod",
      comment: "DEP-01 — une devDependency importée par du code de production casse le build.",
      severity: "error",
      from: { path: "^(apps|packages)/", pathNot: "\\.(test|spec)\\.[jt]sx?$" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|build|coverage|\\.turbo)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
