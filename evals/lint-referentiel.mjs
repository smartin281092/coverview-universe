#!/usr/bin/env node
/**
 * Linter du référentiel — G-15 appliqué au harness lui-même.
 *
 *   node evals/lint-referentiel.mjs          # échoue (exit 1) sur toute erreur
 *   node evals/lint-referentiel.mjs --warn   # n'échoue jamais, se contente de lister
 *
 * POURQUOI CE FICHIER EXISTE
 * `HRN-KNOW-004` et EVAL-02 posent que les documents sont du code. G-15 impose
 * que toute convention vérifiable mécaniquement soit imposée par l'outillage.
 * Or le harness ne livrait qu'une éval **sémantique** (un appel modèle, docs/evals.md)
 * et aucune vérification **syntaxique** — pourtant gratuite et déterministe.
 *
 * Ce que ça attrape, et que l'éval de routage ne peut pas attraper : une règle
 * citée qui n'existe pas, un satellite non routé, un placeholder jamais résolu,
 * un budget dépassé, un statut inventé dans une commande. Ce sont des erreurs
 * de référentiel, pas de modèle : aucun appel LLM ne doit être dépensé pour ça.
 *
 * PORTÉE HONNÊTE (EVAL-06 vaut ici aussi) : ceci vérifie la **cohérence
 * formelle** du référentiel. Ça ne dit rien de la justesse d'une règle, ni de
 * son application par l'agent. C'est le niveau V0 de l'échelle PROG-10 —
 * le moins cher et le premier à rentabiliser, jamais le plus fort.
 *
 * Zéro dépendance, zéro installation : mêmes contraintes qu'evals/run.mjs.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WARN_ONLY = process.argv.includes("--warn");
const p = (...s) => join(ROOT, ...s);
const read = (f) => readFileSync(p(f), "utf8");
const rel = (f) => relative(ROOT, f).split("\\").join("/");

/** Fichiers texte du dépôt, hors .git et node_modules. */
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === ".preview") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(md|mjs|js|cjs|json|yaml|yml)$/.test(e.name)) files.push(full);
  }
})(ROOT);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where} — ${msg}`);
const warn = (where, msg) => warnings.push(`${where} — ${msg}`);

// ── Périmètre : le référentiel, pas l'audit ni le document de référence ─────
// AUDIT.md décrit l'état AVANT correction : il cite volontairement des défauts.
// harness-reference.md est un document source hors routage, avec ses propres IDs.
const EXCLUDE_FROM_REFS = new Set(["AUDIT.md", "CHANGELOG.md", "docs/harness-reference.md"]);
const scoped = files.filter((f) => !EXCLUDE_FROM_REFS.has(rel(f)));

// Identifiants cités à titre d'illustration, qui ne désignent aucune règle réelle.
// Toute addition ici DOIT être justifiée : c'est la porte de sortie du linter.
const ILLUSTRATIVE = new Map([
  ["BILL-11", "docs/documentation.md — exemple de collision d'espace de noms (DOC-15)"],
  ["MEM-001", "templates/MEMORY.md — ligne d'exemple du format"],
  ["MEM-012", "docs/memory.md — exemple du format MEM-02"],
]);

const PREFIXES =
  "G|ARCH|CONV|PAT|BACK|FRONT|DSN|INTL|MKT|SEO|GEO|CTR|DATA|API|AUTH|PERM|EVT|RT|JOB|" +
  "STOR|BILL|CAT|MAIL|LLM|SEC|OBS|TEST|PERF|EVO|DEL|DEP|ENV|DOC|MEM|PROG|BOOT|EVAL|LAUNCH|CDX|HOST|BRD";

// ── 1. Identifiants définis ────────────────────────────────────────────────
const defined = new Map(); // id -> [fichiers]
const addDef = (id, f) => defined.set(id, [...(defined.get(id) ?? []), rel(f)]);

for (const f of scoped.filter((f) => f.endsWith(".md"))) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(new RegExp(`^#{2,4}\\s+((?:${PREFIXES})-\\d{2,3})\\s+—`, "gm"))) addDef(m[1], f);
  for (const m of t.matchAll(/^-\s+\*\*(G-\d{2})\s+—/gm)) addDef(m[1], f);
  // Les entrées mémoire réelles suivent MEM-02, sans titre de règle satellite.
  if (rel(f) === 'MEMORY.md') {
    for (const m of t.matchAll(/^- (MEM-\d{3}) ·/gm)) addDef(m[1], f);
  }
}

for (const [id, where] of defined) {
  if (where.length > 1) err(where.join(" + "), `règle \`${id}\` définie plusieurs fois (DOC-10 : une règle, une surface)`);
}

// ── 2. Identifiants cités mais inexistants ─────────────────────────────────
const refRe = new RegExp(`(?<!HRN-)\\b(?:${PREFIXES})-\\d{2,3}\\b`, "g");
const dangling = new Map();
for (const f of scoped) {
  for (const m of readFileSync(f, "utf8").matchAll(refRe)) {
    const id = m[0];
    if (defined.has(id) || ILLUSTRATIVE.has(id)) continue;
    dangling.set(id, new Set([...(dangling.get(id) ?? []), rel(f)]));
  }
}
for (const [id, where] of dangling) {
  err([...where].join(", "), `cite \`${id}\`, qui n'est défini nulle part`);
}

// ── 3. Placeholders jamais résolus ─────────────────────────────────────────
for (const f of scoped) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(new RegExp(`\\b(?:${PREFIXES})-(xx|XX|nn|NN|\\?\\?)\\b`, "g"))) {
    err(rel(f), `placeholder d'identifiant non résolu : \`${m[0]}\``);
  }
}

// ── 4. Table de routage §5 : couverture dans les deux sens ─────────────────
const root = read("CLAUDE.md");
const rootLines = root.split("\n");
const i5 = rootLines.findIndex((l) => /^## 5\. Table de routage/.test(l));
const i6 = rootLines.findIndex((l) => /^## 6\./.test(l));
if (i5 < 0 || i6 < 0) {
  err("CLAUDE.md", "§5 introuvable — evals/run.mjs et ce linter s'appuient sur cette structure");
} else {
  const table = rootLines.slice(i5, i6).join("\n");
  const routed = new Set([...table.matchAll(/docs\/([a-z0-9-]+\.md)/g)].map((m) => m[1]));
  const onDisk = readdirSync(p("docs")).filter((f) => f.endsWith(".md"));

  for (const f of onDisk) {
    if (!routed.has(f)) err("CLAUDE.md §5", `satellite \`docs/${f}\` présent sur disque mais absent de la table (donc jamais chargé)`);
  }
  for (const f of routed) {
    if (!onDisk.includes(f)) err("CLAUDE.md §5", `la table route vers \`docs/${f}\`, qui n'existe pas`);
  }

  // Budget de la racine — HRN-KNOW-001 : ≲ 150 lignes HORS table de routage.
  const horsTable = rootLines.length - (i6 - i5);
  if (horsTable > 150) {
    warn("CLAUDE.md", `${horsTable} lignes hors table de routage, budget HRN-KNOW-001 ≈ 150 (dépassement ${Math.round((horsTable / 150 - 1) * 100)} %)`);
  }
}

// Budget des satellites — HRN-KNOW-007 : ≤ 500 lignes.
for (const f of readdirSync(p("docs")).filter((f) => f.endsWith(".md"))) {
  if (f === "harness-reference.md") continue; // document source, hors routage — exception assumée
  const n = read(`docs/${f}`).split("\n").length;
  if (n > 500) warn(`docs/${f}`, `${n} lignes, budget HRN-KNOW-007 ≤ 500 — scinder (HRN-KNOW-011)`);
}

// ── 5. Références de fichiers ──────────────────────────────────────────────
// Les blocs de code sont retirés au préalable : ils contiennent des *exemples*
// (DOC-14 illustre une table de routage de module dont les entrées désignent
// modules/<module>/docs/<capacité>.md, pas des satellites). Un exemple n'est pas
// une référence — le linter qui les confond finit désactivé pour bruit.
const withoutFences = (t) => t.replace(/```[\s\S]*?```/g, "");
// Fichiers produits à l'exécution : ils n'existent qu'après le premier run, et
// leur absence sur un dépôt frais n'est pas une incohérence.
const GENERATED = new Set(["evals/history.jsonl"]);
for (const f of scoped) {
  const t = withoutFences(readFileSync(f, "utf8"));
  for (const m of t.matchAll(/`((?:docs|templates|evals|scripts|\.claude\/commands|\.claude\/hooks)\/[\w.-]+\.\w+)`/g)) {
    if (!GENERATED.has(m[1]) && !existsSync(p(m[1]))) err(rel(f), `référence le fichier \`${m[1]}\`, qui n'existe pas`);
  }
}

// ── 6. Statuts de slice : PROG-03 est la seule source ──────────────────────
const progText = read("docs/program.md");
const cycle = /`(idea → specified → ready → running → review → done)`/.exec(progText);
if (!cycle) {
  err("docs/program.md", "cycle de vie PROG-03 introuvable — le linter ne peut plus valider les statuts");
} else {
  const known = new Set(cycle[1].split(" → "));
  const statusRe = /statut\s+`([a-z_]+)`/g;
  for (const f of scoped.filter((f) => /\.claude[\\/]commands|templates[\\/]backlog/.test(f))) {
    for (const m of readFileSync(f, "utf8").matchAll(statusRe)) {
      if (!known.has(m[1])) err(rel(f), `statut de slice \`${m[1]}\` inconnu de PROG-03 (${[...known].join(", ")})`);
    }
  }
}

// ── 7. Chiffres qui se périment ────────────────────────────────────────────
// Un chiffre écrit en prose ne se met pas à jour tout seul : il est faux dès la
// première addition, et c'est le lecteur qui le découvre. Tout compte annoncé
// dans le référentiel doit être confrontable à sa source.
const nbCases = (read("evals/cases.mjs").match(/^\s{2}\{\s*$/gm) ?? []).length;
const nbGuardCases = (read("evals/guard-bash.test.mjs").match(/^\s{2}\[/gm) ?? []).length;
const nbSatellites = readdirSync(p("docs")).filter((f) => f.endsWith(".md")).length;
const nbCanaries = (read("evals/canaries.md").match(/^## C-\d{2} — /gm) ?? []).length;

for (const f of ["README.md", "docs/evals.md", "evals/canaries.md"]) {
  const t = read(f);
  for (const m of t.matchAll(/(\d+)\s+cas\b/g)) {
    if (![nbCases, nbGuardCases].includes(Number(m[1]))) {
      err(f, `annonce « ${m[1]} cas » — cases.mjs en contient ${nbCases}, guard-bash.test.mjs ${nbGuardCases}`);
    }
  }
  for (const m of t.matchAll(/(\d+)\s+satellites\b/g)) {
    if (Number(m[1]) !== nbSatellites) err(f, `annonce « ${m[1]} satellites » alors que docs/ en contient ${nbSatellites}`);
  }
}

const MOTS = { cinq: 5, six: 6, sept: 7, huit: 8 };
for (const m of read("evals/canaries.md").matchAll(/\b(cinq|six|sept|huit)\s+comportements\b/gi)) {
  const n = MOTS[m[1].toLowerCase()];
  if (n !== nbCanaries) err("evals/canaries.md", `annonce « ${m[1]} comportements » alors que ${nbCanaries} canaris sont définis`);
}

// ── Rapport ────────────────────────────────────────────────────────────────
const label = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
for (const w of warnings) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✗ ${e}`);

console.log(
  `\n${files.length} fichiers · ${defined.size} règles définies · ` +
    `${label(errors.length, "erreur")} · ${label(warnings.length, "avertissement")}`
);

if (errors.length && !WARN_ONLY) {
  console.log(
    "\nUn ⚠ est un budget dépassé : il se corrige quand on y touche, il ne bloque pas.\n" +
      "Un ✗ est une incohérence formelle : le référentiel se contredit lui-même, et\n" +
      "l'agent lira la version fausse. Corriger le référentiel — jamais la règle du linter (G-08)."
  );
  process.exit(1);
}
