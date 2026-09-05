/** Source unique des fixtures : module partagé avec les seeds (ENV-03/07). */
export { personas } from "./apps/api/src/platform/db/seed/personas.mjs";

const project = process.env.COMPOSE_PROJECT_NAME ?? "coverview-local";
if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error("COMPOSE_PROJECT_NAME invalide.");

export const infrastructure = {
  command: "docker",
  args: ["compose", "--project-name", project],
};

export const apps = [
  {
    key: "api",
    label: "API — santé des dépendances",
    dir: "apps/api",
    port: 4100,
    health: "/health",
    tool: "tsx",
    args: ["watch", "src/main.ts"],
  },
  {
    key: "client",
    label: "Wallet — coquille",
    dir: "apps/client",
    port: 4101,
    tool: "vite",
    args: ["--host", "127.0.0.1", "--port", "4101", "--strictPort"],
  },
  {
    key: "admin",
    label: "Console admin — coquille",
    dir: "apps/admin",
    port: 4102,
    tool: "vite",
    args: ["--host", "127.0.0.1", "--port", "4102", "--strictPort"],
  },
  {
    key: "www",
    label: "Site public — coquille",
    dir: "apps/www",
    port: 4103,
    tool: "astro",
    args: ["dev", "--host", "127.0.0.1", "--port", "4103"],
  },
];

export const services = [
  { label: "Mailpit — boîte locale", url: "http://127.0.0.1:48025" },
  { label: "MinIO — console locale", url: "http://127.0.0.1:59001" },
];

export const smokeChecks = [
  "Ouvrir /health : la réponse indique l'état réel des dépendances locales (200 si prêtes, 503 sinon).",
  "Ouvrir Wallet, la console admin et le site public : chaque coquille est accessible et signale son périmètre.",
  "Ouvrir /preview dans Wallet ou la console admin : les fixtures persistées se chargent; choisir une persona affiche son e-mail sans créer de session ni de droit.",
  "Ouvrir Mailpit et MinIO : leurs consoles locales répondent. Aucun e-mail métier ni upload n'est encore implémenté.",
  "Relancer start : les superviseurs existants sont conservés. stop puis un nouveau start doivent libérer puis reprendre les ports.",
];
