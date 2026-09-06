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
    label: "Wallet — mon compte",
    dir: "apps/client",
    port: 4101,
    entry: "/account",
    tool: "vite",
    args: ["--host", "127.0.0.1", "--port", "4101", "--strictPort"],
  },
  {
    key: "admin",
    label: "Espace équipe — accès au compte",
    dir: "apps/admin",
    port: 4102,
    entry: "/account",
    tool: "vite",
    args: ["--host", "127.0.0.1", "--port", "4102", "--strictPort"],
  },
  {
    key: "www",
    label: "CoverView — site public",
    dir: "apps/www",
    port: 4103,
    tool: "astro",
    args: ["dev", "--host", "127.0.0.1", "--port", "4103"],
  },
];
