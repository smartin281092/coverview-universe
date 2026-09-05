#!/usr/bin/env node
/**
 * Lanceur de preview — ENV-08.
 *
 * Objectif : permettre de tout tester depuis un navigateur, sans ouvrir de
 * terminal. Les serveurs de dev sont lancés **détachés** (sinon ils bloquent la
 * session de l'agent), leurs logs vont dans .preview/, et la commande rend un
 * panneau : URLs, identifiants, moyens de paiement de test, points à vérifier.
 *
 * Node plutôt que shell : portable Windows/macOS/Linux, et Node est déjà une
 * dépendance dure de la stack.
 *
 *   node scripts/preview.mjs start    # infra + apps, attend qu'elles répondent
 *   node scripts/preview.mjs status   # que tourne-t-il, et répond-il ?
 *   node scripts/preview.mjs info     # panneau seul, ne lance rien
 *   node scripts/preview.mjs stop     # arrête les apps (--all : + docker)
 *
 * GARDE (ENV-08) : refuse de s'exécuter si APP_ENV ne vaut pas explicitement
 * "local" ou "development" — variable ABSENTE incluse. Les personas ont des
 * mots de passe connus ; leur existence hors du poste de développement est un
 * incident de sécurité, pas un inconvénient. Un garde qui retombe sur "local"
 * quand la variable manque ne garantit rien sur une machine où personne ne l'a
 * exportée, c'est-à-dire sur toute machine de production (BACK-07).
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

// fileURLToPath, et non `.pathname` : ce dernier est percent-encodé (un chemin
// contenant une espace casse) et produit "/C:/…" sous Windows.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = join(ROOT, ".preview");
const PIDS = join(DIR, "pids.json");
const IS_WINDOWS = process.platform === "win32";
const cmd = process.argv[2] ?? "start";
const ALL = process.argv.includes("--all");

const env = process.env.APP_ENV ?? process.env.NODE_ENV;
if (env !== "local" && env !== "development") {
  console.error(
    env
      ? `REFUSÉ — APP_ENV="${env}". La preview et ses personas sont réservées au local (ENV-08).`
      : "REFUSÉ — APP_ENV n'est pas défini.\n" +
          "La preview affiche des identifiants en clair : elle exige une déclaration\n" +
          "explicite d'environnement, jamais une valeur par défaut (ENV-08, BACK-07).\n" +
          "Corriger : ajouter APP_ENV=local à .env, ou lancer APP_ENV=local node scripts/preview.mjs start"
  );
  process.exit(1);
}

// import() n'accepte pas un chemin absolu Windows ("C:\…") — il lui faut une URL file://.
const cfg = await import(pathToFileURL(join(ROOT, "preview.config.mjs")).href);
const sh = (c, a, o = {}) => spawnSync(c, a, { cwd: ROOT, stdio: "inherit", shell: true, ...o });
const probe = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return r.status < 500;
  } catch {
    return false;
  }
};
const urlOf = (a) => `http://localhost:${a.port}`;
const readPids = () => (existsSync(PIDS) ? JSON.parse(readFileSync(PIDS, "utf8")) : {});
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
// Windows n'a pas de groupes de processus : `process.kill(-pid)` y lève, et le
// repli sur `kill(pid)` ne tue que le shell intermédiaire (spawn shell:true),
// laissant le serveur de dev orphelin sur son port. `taskkill /T` tue l'arbre.
const killTree = (pid) => {
  if (IS_WINDOWS) {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid);
  } catch {
    try { process.kill(pid); } catch {}
  }
};

// ── stop ───────────────────────────────────────────────────────────────────
if (cmd === "stop") {
  mkdirSync(DIR, { recursive: true }); // `stop` avant tout `start` : .preview/ n'existe pas encore
  const pids = readPids();
  for (const [key, pid] of Object.entries(pids)) {
    if (alive(pid)) {
      killTree(pid);
      console.log(`arrêté  ${key} (pid ${pid})`);
    }
  }
  writeFileSync(PIDS, "{}");
  if (ALL) sh("docker", ["compose", "stop"]);
  else console.log("Infra docker laissée en marche — `stop --all` pour l'arrêter aussi.");
  process.exit(0);
}

// ── start ──────────────────────────────────────────────────────────────────
if (cmd === "start") {
  mkdirSync(DIR, { recursive: true });
  console.log("→ infra docker");
  sh("docker", ["compose", "up", "-d"]);

  const pids = readPids();
  for (const app of cfg.apps) {
    if (pids[app.key] && alive(pids[app.key])) {
      console.log(`déjà en marche  ${app.key} (pid ${pids[app.key]})`);
      continue;
    }
    const log = openSync(join(DIR, `${app.key}.log`), "a");
    const child = spawn("pnpm", ["dev", "--filter", app.key], {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", log, log],
      shell: true,
      env: { ...process.env, PORT: String(app.port) },
    });
    child.unref();
    pids[app.key] = child.pid;
    console.log(`lancé   ${app.key} (pid ${child.pid}) → .preview/${app.key}.log`);
  }
  writeFileSync(PIDS, JSON.stringify(pids, null, 2));

  process.stdout.write("→ attente des apps ");
  const deadline = Date.now() + 90_000;
  const pending = new Set(cfg.apps.map((a) => a.key));
  while (pending.size && Date.now() < deadline) {
    for (const app of cfg.apps) {
      if (!pending.has(app.key)) continue;
      if (await probe(urlOf(app) + (app.health ?? "/"))) pending.delete(app.key);
    }
    if (pending.size) {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log("");
  for (const key of pending) console.log(`⚠ ${key} ne répond pas — voir .preview/${key}.log`);
}

// ── status ─────────────────────────────────────────────────────────────────
if (cmd === "status") {
  const pids = readPids();
  for (const app of cfg.apps) {
    const pid = pids[app.key];
    const up = pid && alive(pid);
    const ok = up ? await probe(urlOf(app) + (app.health ?? "/")) : false;
    console.log(`${ok ? "✓" : up ? "…" : "✗"}  ${app.key.padEnd(8)} ${urlOf(app)}  ${up ? `pid ${pid}` : "arrêté"}`);
  }
  process.exit(0);
}

// ── panneau (start et info) ────────────────────────────────────────────────
const line = (l, v) => `| ${l} | ${v} |`;
console.log("\n## Applications\n");
console.log("| App | URL |");
console.log("|---|---|");
for (const a of cfg.apps) console.log(line(a.label, urlOf(a)));
for (const s of cfg.services) console.log(line(s.label, s.url + (s.note ? ` — ${s.note}` : "")));

console.log("\n## Comptes de test\n");
if (cfg.personasError) {
  console.log(cfg.personasError);
} else if (!cfg.personas.length) {
  console.log("Aucune persona seedée — lancer `pnpm db:seed`.");
} else {
  console.log("| E-mail | Mot de passe | Org | Rôle | État | Ce que ça permet de tester |");
  console.log("|---|---|---|---|---|---|");
  for (const p of cfg.personas)
    console.log(`| ${p.email} | ${p.password} | ${p.org ?? "—"} | ${p.role} | ${p.state ?? "actif"} | ${p.tests ?? ""} |`);
}

console.log("\n## Paiement de test (Stripe test mode)\n");
for (const [k, v] of Object.entries(cfg.testPayments)) console.log(`- ${k} : \`${v}\``);

console.log("\n## Parcours de fumée\n");
cfg.smokeChecks.forEach((c, i) => console.log(`${i + 1}. ${c}`));
console.log("\n(Arrêter : `node scripts/preview.mjs stop`)");
