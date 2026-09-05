#!/usr/bin/env node
/**
 * Éval de routage — EVAL-01.
 *
 * Teste la seule chose testable par une machine à coût quasi nul : la table de
 * routage de CLAUDE.md §5 discrimine-t-elle correctement ?
 *
 * Un seul appel modèle pour l'ensemble des cas. Objectif : < 1 min, coût
 * négligeable, exécutable à chaque PR touchant le référentiel — une éval qu'on
 * hésite à lancer n'est pas lancée.
 *
 * PORTÉE (à ne pas surestimer — EVAL-06) : ceci vérifie que la table permet de
 * choisir les bons satellites. Cela ne prouve PAS que l'agent applique leurs
 * règles une fois chargés. C'est un proxy — meilleur que rien, très inférieur à
 * une éval sur diff réel. Les comportements non routables sont couverts par
 * evals/canaries.md, à la main, au changement de modèle.
 *
 * Usage :
 *   node evals/run.mjs                      # exécute
 *   node evals/run.mjs --dry                # affiche le prompt sans appeler le modèle
 *   EVAL_MODEL=claude-opus-5 node evals/run.mjs
 *   EVAL_CMD="claude -p" node evals/run.mjs # surcharge complète de la commande
 *
 * MODÈLE ET HISTORIQUE (EVAL-07) — une campagne exige ≥ 3 exécutions avec
 * l'écart noté. C'est impossible si l'on ne sait pas quel modèle a répondu :
 * sans épinglage ni trace, deux exécutions ne sont pas comparables et le
 * « delta » observé peut n'être qu'un changement de modèle par défaut de la CLI.
 * Chaque exécution ajoute donc une ligne à evals/history.jsonl.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cases } from "./cases.mjs";

const DRY = process.argv.includes("--dry");
const MODEL = process.env.EVAL_MODEL ?? "";
const CMD = process.env.EVAL_CMD ?? `claude -p${MODEL ? ` --model ${MODEL}` : ""}`;
const HISTORY = new URL("./history.jsonl", import.meta.url);

// ── 1. Extraire la table de routage : c'est l'objet sous test, rien d'autre ──
const root = readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");
const section = root.split(/^## 5\. Table de routage[^\n]*$/m)[1]?.split(/^## 6\./m)[0];
if (!section) {
  console.error("Impossible d'extraire §5 de CLAUDE.md — la structure de la racine a changé.");
  process.exit(1);
}

const known = [...root.matchAll(/`docs\/([a-z0-9-]+\.md)`/g)].map((m) => m[1]);

const prompt = `Tu appliques une table de routage documentaire. Tu ne réalises AUCUNE tâche.

Table de routage :
${section.trim()}

Pour chacune des tâches ci-dessous, indique les fichiers de docs/ que tu chargerais
avant d'agir, en appliquant strictement la table et ses exclusions.

${cases.map((c) => `${c.id}: ${c.task}`).join("\n")}

Réponds UNIQUEMENT par un tableau JSON, sans texte avant ni après, sans balises de code :
[{"id":"R-001","load":["data.md"]}]`;

if (DRY) {
  console.log(prompt);
  process.exit(0);
}

// ── 2. Un seul appel ────────────────────────────────────────────────────────
const [bin, ...args] = CMD.split(" ");
const res = spawnSync(bin, args, { input: prompt, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
if (res.error || res.status !== 0) {
  console.error(`Échec de \`${CMD}\` : ${res.error?.message ?? res.stderr?.slice(0, 400)}`);
  console.error("Vérifier que la CLI est installée et authentifiée, ou surcharger EVAL_CMD.");
  process.exit(1);
}

let answers;
try {
  const raw = res.stdout.replace(/```(?:json)?/g, "").trim();
  answers = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
} catch {
  console.error("Réponse non parsable :\n" + res.stdout.slice(0, 800));
  process.exit(1);
}

// ── 3. Assertions : inclusion et disjonction, jamais égalité (EVAL-03) ──────
const byId = new Map(answers.map((a) => [a.id, (a.load ?? []).map((f) => f.replace(/^docs\//, ""))]));
let failed = 0;
const unknownRefs = new Set();

for (const c of cases) {
  const got = byId.get(c.id);
  if (!got) {
    console.log(`✗ ${c.id}  aucune réponse`);
    failed++;
    continue;
  }
  got.filter((f) => !known.includes(f)).forEach((f) => unknownRefs.add(f));

  const missing = (c.load ?? []).filter((f) => !got.includes(f));
  const forbidden = (c.exclude ?? []).filter((f) => got.includes(f));

  if (missing.length || forbidden.length) {
    failed++;
    console.log(`✗ ${c.id}  ${c.task.slice(0, 62)}`);
    if (missing.length) console.log(`    manquant : ${missing.join(", ")}`);
    if (forbidden.length) console.log(`    interdit : ${forbidden.join(", ")}`);
  } else {
    console.log(`✓ ${c.id}  (${got.length} satellites)`);
  }
}

if (unknownRefs.size) {
  console.log(`\n⚠ satellites cités mais inexistants : ${[...unknownRefs].join(", ")}`);
  console.log("  Symptôme classique d'une entrée de routage ambiguë ou d'un satellite renommé.");
}

const passed = cases.length - failed;
console.log(`\n${passed}/${cases.length} cas passés.`);

// ── 4. Trace : sans elle, EVAL-07 est inapplicable ─────────────────────────
const entry = {
  date: new Date().toISOString(),
  model: MODEL || "(défaut de la CLI — non épinglé)",
  cmd: CMD,
  passed,
  total: cases.length,
  failed: cases.filter((c) => {
    const got = byId.get(c.id);
    return !got || (c.load ?? []).some((f) => !got.includes(f)) || (c.exclude ?? []).some((f) => got.includes(f));
  }).map((c) => c.id),
};
try {
  appendFileSync(HISTORY, JSON.stringify(entry) + "\n");
  console.log(`→ evals/history.jsonl (${entry.model})`);
} catch (e) {
  console.log(`⚠ historique non écrit : ${e.message}`);
}

if (!MODEL) {
  console.log(
    "⚠ Modèle non épinglé : deux exécutions ne sont pas comparables, et un écart\n" +
      "  peut n'être qu'un changement de défaut de la CLI. Pour une décision qui\n" +
      "  compte (changer de modèle, modifier un tier PROG-12), relancer avec\n" +
      "  EVAL_MODEL=<id> et au moins 3 exécutions (EVAL-07)."
  );
}

if (failed) {
  console.log("Un échec = la table de routage, pas le modèle. Corriger l'entrée ou l'exclusion en cause.");
  process.exit(1);
}
