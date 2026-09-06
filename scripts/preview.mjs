#!/usr/bin/env node
/** Preview locale détachée (ENV-08). Aucune migration ni réinitialisation. */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createConnection, createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT), "..");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const urlOf = (app) => `http://127.0.0.1:${app.port}`;

/** Les credentials d'identité ne traversent que les processus de l'API. */
export function childEnvironment(key, environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) => key === "api" || !/^(WORKOS_API_KEY|AUTH_SESSION_SECRET)$/i.test(name),
    ),
  );
}

export function requireLocal(environment) {
  if (!["local", "development"].includes(environment.APP_ENV)) {
    throw new Error(
      "REFUSÉ — APP_ENV doit être explicitement local ou development (ENV-08). NODE_ENV ne remplace pas APP_ENV.",
    );
  }
  if (environment.NODE_ENV === "production") {
    throw new Error("REFUSÉ — NODE_ENV=production interdit les fixtures et la preview locale.");
  }
}

export async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: "error" });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

/** Un listener, même non HTTP, ne peut pas être adopté par cette preview. */
export async function portAvailable(port) {
  for (const host of ["127.0.0.1", "::1"]) {
    const free = await new Promise((done) => {
      const socket = createServer();
      socket.once("error", (error) =>
        done(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT"),
      );
      socket.listen({ host, port, exclusive: true }, () => socket.close(() => done(true)));
    });
    if (!free) return false;
  }
  return true;
}

const validRecord = (record) =>
  record &&
  Number.isSafeInteger(record.pid) &&
  record.pid > 0 &&
  typeof record.token === "string" &&
  /^[0-9a-f-]{36}$/.test(record.token);

export function endpoint(root, token, platform = process.platform) {
  const workspace = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 12);
  return platform === "win32"
    ? `\\\\.\\pipe\\coverview-preview-${workspace}-${token}`
    : // /tmp évite aussi le TMPDIR macOS très long. Le nom ne dépend pas de la
      // longueur du checkout; le dossier est privé et validé avant toute écoute.
      `/tmp/cvp-${process.getuid?.() ?? 0}-${workspace}/${token}.sock`;
}

function checkEndpointDirectory(directory) {
  const metadata = lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.uid !== process.getuid() ||
    (metadata.mode & 0o777) !== 0o700
  ) {
    throw new Error("Répertoire IPC non privé : écoute refusée.");
  }
}

function prepareEndpoint(root, token) {
  if (process.platform === "win32") return;
  const directory = dirname(endpoint(root, token));
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  checkEndpointDirectory(directory);
}

function cleanupEndpoint(root, token) {
  if (process.platform === "win32") return;
  const path = endpoint(root, token);
  const directory = dirname(path);
  if (!existsSync(directory)) return;
  checkEndpointDirectory(directory);
  try {
    const metadata = lstatSync(path);
    if (!metadata.isSocket() || metadata.uid !== process.getuid()) {
      throw new Error("Fichier IPC non possédé : nettoyage refusé.");
    }
    unlinkSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  // D'autres apps peuvent encore utiliser le dossier; aucune suppression récursive.
  try {
    rmdirSync(directory);
  } catch (error) {
    if (!["ENOTEMPTY", "ENOENT"].includes(error.code)) throw error;
  }
}

/** Les PID persistés ne sont JAMAIS des cibles de kill. Un canal/token vivant
 * prouve l'appartenance; seul le superviseur s'arrête avec son propre arbre. */
export async function control(root, record, action = "ping") {
  if (!validRecord(record)) return null;
  return new Promise((done) => {
    let buffer = "";
    const socket = createConnection(endpoint(root, record.token));
    const finish = (value) => {
      socket.destroy();
      done(value);
    };
    socket.setTimeout(2000, () => finish(null));
    socket.once("error", () => finish(null));
    socket.once("connect", () =>
      socket.write(JSON.stringify({ token: record.token, action }) + "\n"),
    );
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > 1024) return finish(null);
      if (!buffer.includes("\n")) return;
      try {
        const response = JSON.parse(buffer.trim());
        finish(response.token === record.token && response.pid === record.pid ? response : null);
      } catch {
        finish(null);
      }
    });
    socket.once("end", () => finish(null));
  });
}

function readRecords(root) {
  const path = join(root, ".preview", "pids.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function saveRecords(root, records) {
  mkdirSync(join(root, ".preview"), { recursive: true });
  writeFileSync(join(root, ".preview", "pids.json"), JSON.stringify(records, null, 2) + "\n");
}

function run(command, args, root, environment = childEnvironment("infrastructure")) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      timeout: 120_000,
      env: environment,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? done()
        : reject(new Error(`${command} a échoué (code ${code}, signal ${signal ?? "aucun"}).`)),
    );
  });
}

function validateConfig(config) {
  const keys = new Set();
  const ports = new Set();
  for (const app of config.apps) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(app.key) ||
      keys.has(app.key) ||
      !Number.isInteger(app.port) ||
      app.port < 1024 ||
      app.port > 65535 ||
      ports.has(app.port)
    ) {
      throw new Error(
        "Configuration preview invalide : clés/ports uniques et ports locaux non privilégiés requis.",
      );
    }
    keys.add(app.key);
    ports.add(app.port);
  }
}

async function configuration(root) {
  const envPath = join(root, ".env");
  if (existsSync(envPath)) loadEnvFile(envPath);
  requireLocal(process.env);
  const config = await import(pathToFileURL(join(root, "preview.config.mjs")).href);
  validateConfig(config);
  return config;
}

function toolBinary(root, app) {
  const require = createRequire(join(root, app.dir, "package.json"));
  const packagePath = require.resolve(`${app.tool}/package.json`);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const binary =
    typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[app.tool];
  if (!binary) throw new Error(`Exécutable ${app.tool} absent; vérifier pnpm install.`);
  return resolve(dirname(packagePath), binary);
}

async function checkAuthConfiguration(root, config) {
  if (process.env.AUTH_ENABLED !== "true")
    throw new Error("REFUSÉ — AUTH_ENABLED=true est requis pour ce lancement.");
  const api = config.apps.find((app) => app.key === "api");
  if (!api) throw new Error("REFUSÉ — API absente de la configuration preview.");
  for (const app of config.apps) toolBinary(root, app);
  await run(
    process.execPath,
    [toolBinary(root, api), join(root, api.dir, "src/platform/config.check.ts"), "--runtime"],
    root,
    childEnvironment("api"),
  );
  console.log("Configuration locale valide. Ceci ne vérifie ni la clé WorkOS ni une connexion.");
}

async function authenticationStatus(config, records, root) {
  const api = config.apps.find((app) => app.key === "api");
  if (!api || !(await control(root, records.api))) return null;
  try {
    const response = await fetch(`${urlOf(api)}/identity/config`, {
      signal: AbortSignal.timeout(2500),
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const result = await response.json();
    return typeof result.enabled === "boolean" ? result.enabled : null;
  } catch {
    return null;
  }
}

function stopOwnTree() {
  if (process.platform === "win32") {
    // Le PID est celui du processus en train d'exécuter cette instruction : il
    // ne peut pas avoir été réattribué. /T inclut serveur et watchers enfants.
    const result = spawnSync("taskkill", ["/pid", String(process.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 10_000,
      env: childEnvironment("control"),
    });
    if (result.error || result.status !== 0) {
      console.error(
        "Échec d'arrêt de l'arbre preview; le superviseur reste disponible pour un nouvel arrêt.",
      );
      return;
    }
  } else {
    process.kill(-process.pid, "SIGTERM");
  }
}

async function worker(key, token, root) {
  if (!validRecord({ pid: process.pid, token })) throw new Error("Jeton de superviseur invalide.");
  const config = await configuration(root);
  const app = config.apps.find((entry) => entry.key === key);
  if (!app) throw new Error("Application preview inconnue.");
  const cwd = resolve(root, app.dir);
  const binary = toolBinary(root, app);
  prepareEndpoint(root, token);
  const child = spawn(process.execPath, [binary, ...app.args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...childEnvironment(app.key),
      // Astro détecte les agents et daemonise son CLI. Ce marqueur interne
      // conserve le serveur au premier plan, sous notre arbre de processus.
      ...(app.tool === "astro" ? { ASTRO_DEV_BACKGROUND: "1" } : {}),
      HOST: "127.0.0.1",
      PORT: String(app.port),
      API_HOST: "127.0.0.1",
      API_PORT: String(app.port),
    },
  });
  child.once("error", (error) => {
    console.error(`Démarrage ${key} impossible : ${error.code}.`);
    stopOwnTree();
  });
  child.once("exit", (code) => {
    console.error(`${key} terminé (code ${code}).`);
    stopOwnTree();
  });
  const server = createServer((socket) => {
    let buffer = "";
    socket.setTimeout(2000, () => socket.destroy());
    socket.on("error", () => socket.destroy());
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > 1024) return socket.destroy();
      if (!buffer.includes("\n")) return;
      try {
        const request = JSON.parse(buffer.trim());
        if (request.token !== token || !["ping", "stop"].includes(request.action))
          return socket.destroy();
        socket.end(JSON.stringify({ token, pid: process.pid }) + "\n");
        if (request.action === "stop") setTimeout(stopOwnTree, 100);
      } catch {
        socket.destroy();
      }
    });
  });
  server.once("error", (error) => {
    console.error(`Canal preview indisponible : ${error.code}.`);
    stopOwnTree();
  });
  server.listen(endpoint(root, token));
}

async function stopRecord(root, key, record) {
  if (!(await control(root, record, "stop"))) {
    throw new Error(
      `${key} : propriétaire non vérifiable; aucun PID arrêté. Un état périmé ne permet pas de tuer un processus.`,
    );
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await control(root, record))) {
      cleanupEndpoint(root, record.token);
      return;
    }
    await delay(100);
  }
  throw new Error(`${key} : arrêt non confirmé après 10 secondes.`);
}

async function panel(config, records, root) {
  console.log("\n## Applications\n\n| App | URL |\n|---|---|");
  for (const app of config.apps)
    console.log(`| ${app.label} | ${urlOf(app)}${app.entry ?? app.health ?? "/"} |`);
  const configured = await authenticationStatus(config, records, root);
  console.log(
    configured === true
      ? "\nCompte : connexion activée dans l'API. Une connexion WorkOS réelle doit encore être vérifiée dans le navigateur."
      : configured === false
        ? "\nCompte : connexion indisponible, WorkOS est désactivé dans l'API."
        : "\nCompte : état de configuration non disponible (API arrêtée ou réponse invalide).",
  );
  console.log(
    "\nÉtat réel : `node scripts/preview.mjs status`. Arrêter : `node scripts/preview.mjs stop` (`--all` inclut l'infrastructure Docker).\n",
  );
}

export async function main(args = process.argv.slice(2), root = ROOT) {
  const [command = "start"] = args;
  if (
    !["start", "stop", "status", "info", "check-auth"].includes(command) ||
    args.slice(1).some((arg) => !["--all", "--require-auth"].includes(arg)) ||
    (args.includes("--all") && command !== "stop") ||
    (args.includes("--require-auth") && command !== "start")
  ) {
    throw new Error(
      "Usage : node scripts/preview.mjs start [--require-auth]|stop [--all]|status|info|check-auth",
    );
  }
  const config = await configuration(root);
  const records = readRecords(root);
  if (command === "check-auth") {
    await checkAuthConfiguration(root, config);
    return;
  }
  if (command === "info") {
    await panel(config, records, root);
    return;
  }
  if (command === "stop") {
    const failures = [];
    for (const [key, record] of Object.entries(records)) {
      try {
        await stopRecord(root, key, record);
        delete records[key];
        saveRecords(root, records);
        console.log(`arrêté  ${key}`);
      } catch (error) {
        failures.push(error.message);
      }
    }
    if (args.includes("--all"))
      await run(config.infrastructure.command, [...config.infrastructure.args, "stop"], root);
    if (failures.length) throw new Error(failures.join("\n"));
    if (!args.includes("--all")) console.log("Infrastructure Docker laissée en marche.");
    return;
  }
  if (command === "status") {
    let failed = false;
    for (const app of config.apps) {
      const owned = await control(root, records[app.key]);
      const healthy = owned && (await probe(urlOf(app) + (app.health ?? "/")));
      console.log(
        `${healthy ? "✓" : "✗"} ${app.key} ${urlOf(app)} — ${healthy ? "propriétaire et réponse 2xx vérifiés" : "arrêté, non possédé ou probe en échec"}`,
      );
      if (!healthy) failed = true;
    }
    if (failed) throw new Error("La preview ne répond pas intégralement.");
    return;
  }
  if (args.includes("--require-auth")) {
    await checkAuthConfiguration(root, config);
    if (
      (await control(root, records.api)) &&
      (await authenticationStatus(config, records, root)) !== true
    )
      throw new Error(
        "REFUSÉ — l'API déjà en marche n'a pas activé l'authentification. Utiliser scripts/start-auth-preview.ps1 pour la relancer avec les credentials en mémoire.",
      );
  }
  const existing = new Set();
  for (const app of config.apps) {
    if (await control(root, records[app.key])) {
      existing.add(app.key);
      continue;
    }
    if (!(await portAvailable(app.port)))
      throw new Error(
        `REFUSÉ — port ${app.port} occupé sans propriétaire preview (${app.key}). Aucun processus étranger arrêté.`,
      );
  }
  console.log("→ infrastructure Docker locale");
  await run(
    config.infrastructure.command,
    [...config.infrastructure.args, "up", "-d", "--wait", "--wait-timeout", "90"],
    root,
  );
  mkdirSync(join(root, ".preview"), { recursive: true });
  const started = [];
  const children = new Map();
  try {
    for (const app of config.apps) {
      if (existing.has(app.key)) {
        console.log(`déjà en marche  ${app.key}`);
        continue;
      }
      const token = randomUUID();
      const log = openSync(join(root, ".preview", `${app.key}.log`), "a");
      const child = spawn(process.execPath, [SCRIPT, "--worker", app.key, token, root], {
        cwd: root,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", log, log],
        env: childEnvironment(app.key),
      });
      closeSync(log);
      await new Promise((done, reject) => {
        child.once("spawn", done);
        child.once("error", reject);
      });
      records[app.key] = { pid: child.pid, token };
      saveRecords(root, records);
      started.push(app.key);
      children.set(app.key, child);
      child.unref();
      console.log(`lancé  ${app.key} → .preview/${app.key}.log`);
    }
    const pending = new Set(config.apps.map((app) => app.key));
    const deadline = Date.now() + (config.startTimeoutMs ?? 90_000);
    while (pending.size && Date.now() < deadline) {
      for (const app of config.apps) {
        const child = children.get(app.key);
        if (child && (child.exitCode !== null || child.signalCode !== null)) {
          throw new Error(
            `${app.key} : superviseur terminé avant disponibilité. Voir .preview/${app.key}.log.`,
          );
        }
        if (
          pending.has(app.key) &&
          (await control(root, records[app.key])) &&
          (await probe(urlOf(app) + (app.health ?? "/")))
        )
          pending.delete(app.key);
      }
      if (pending.size) await delay(500);
    }
    if (pending.size)
      throw new Error(
        `Probe en échec : ${[...pending].join(", ")}. Voir les logs .preview/ concernés; aucune migration exécutée.`,
      );
    if (
      args.includes("--require-auth") &&
      (await authenticationStatus(config, records, root)) !== true
    )
      throw new Error(
        "REFUSÉ — l'API démarrée n'a pas activé la connexion. Aucun parcours WorkOS déclaré fonctionnel.",
      );
  } catch (error) {
    for (const key of started) {
      if (await control(root, records[key])) {
        try {
          await stopRecord(root, key, records[key]);
          delete records[key];
        } catch (cleanupError) {
          console.error(cleanupError.message);
        }
      } else {
        const child = children.get(key);
        // L'objet ChildProcess provient de ce démarrage; son événement exit
        // prouve la fin sans se fier à un numéro relu depuis pids.json.
        if (child && (child.exitCode !== null || child.signalCode !== null)) {
          cleanupEndpoint(root, records[key].token);
          delete records[key];
        }
      }
    }
    saveRecords(root, records);
    throw error;
  }
  await panel(config, records, root);
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  try {
    if (process.argv[2] === "--worker")
      await worker(process.argv[3], process.argv[4], process.argv[5]);
    else await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
