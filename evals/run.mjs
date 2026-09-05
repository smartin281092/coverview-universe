#!/usr/bin/env node
/** Éval EVAL-01 : --dry sans modèle, --fixture <json> hors ligne et sans historique.
 * EVAL_PROVIDER=codex|claude, EVAL_MODEL, EVAL_EFFORT ; aucun repli implicite.
 * Surcharge : EVAL_EXECUTABLE + EVAL_ARGS_JSON, jamais une commande de shell. */
import { readFileSync, appendFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cases } from "./cases.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function buildPrompt(rootText, corpus = cases) {
  const section = rootText.split(/^## 5\. Table de routage[^\n]*$/m)[1]?.split(/^## 6\./m)[0];
  if (!section) throw new Error("Impossible d'extraire §5 de CLAUDE.md.");
  return `Tu appliques une table de routage documentaire. Tu ne réalises AUCUNE tâche et n'utilises aucun outil.\n\nTable de routage :\n${section.trim()}\n\nPour chacune des tâches ci-dessous, indique les fichiers de docs/ que tu chargerais avant d'agir, en appliquant strictement la table et ses exclusions.\n\n${corpus.map((c) => `${c.id}: ${c.task}`).join("\n")}\n\nRéponds UNIQUEMENT par un tableau JSON, sans texte avant ni après, sans balises de code :\n[{"id":"R-001","load":["data.md"]}]`;
}

export function parseAnswers(raw, corpus = cases) {
  const clean = raw.trim().replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  let answers;
  try { answers = JSON.parse(clean); } catch { throw new Error("Réponse non parsable comme tableau JSON complet."); }
  if (!Array.isArray(answers)) throw new Error("Réponse attendue : tableau JSON.");
  const ids = new Set();
  for (const answer of answers) {
    if (!answer || !corpus.some((c) => c.id === answer.id) || ids.has(answer.id) || !Array.isArray(answer.load) || answer.load.some((f) => typeof f !== "string")) throw new Error("Réponse invalide : identifiant inconnu/dupliqué ou liste de satellites incorrecte.");
    ids.add(answer.id);
  }
  return new Map(answers.map((answer) => [answer.id, answer.load.map((f) => f.replace(/^docs\//, ""))]));
}

export function scoreAnswers(byId, known, corpus = cases) {
  return corpus.map((c) => {
    const got = byId.get(c.id);
    return { id: c.id, absent: !got, missing: (c.load ?? []).filter((f) => !got?.includes(f)), forbidden: (c.exclude ?? []).filter((f) => got?.includes(f)), unknown: (got ?? []).filter((f) => !known.includes(f)) };
  }).map((row) => ({ ...row, passed: !row.absent && !row.missing.length && !row.forbidden.length && !row.unknown.length }));
}

export function providerCommand(env, lastMessage) {
  if (env.EVAL_CMD) throw new Error("EVAL_CMD retiré : utiliser EVAL_EXECUTABLE et EVAL_ARGS_JSON ; aucune découpe de commande shell.");
  const provider = env.EVAL_PROVIDER || "codex";
  if (!["codex", "claude"].includes(provider)) throw new Error("EVAL_PROVIDER doit valoir codex ou claude.");
  const model = env.EVAL_MODEL || (provider === "codex" ? "gpt-6-astra" : "");
  const effort = env.EVAL_EFFORT || (provider === "codex" ? "ultra" : "");
  if (env.EVAL_EXECUTABLE || env.EVAL_ARGS_JSON) {
    if (!env.EVAL_EXECUTABLE || !env.EVAL_ARGS_JSON) throw new Error("EVAL_EXECUTABLE et EVAL_ARGS_JSON doivent être fournis ensemble.");
    const args = JSON.parse(env.EVAL_ARGS_JSON);
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("EVAL_ARGS_JSON doit contenir un tableau de chaînes.");
    return { provider: "custom", bin: env.EVAL_EXECUTABLE, args, model: env.EVAL_MODEL || "", effort: env.EVAL_EFFORT || "", fileOutput: false };
  }
  if (provider === "claude") return { provider, model, effort, bin: "claude", args: ["-p", "--tools", "", ...(model ? ["--model", model] : []), ...(effort ? ["--effort", effort] : [])], fileOutput: false };
  return { provider, model, effort, bin: "codex", args: ["exec", "--ephemeral", "--sandbox", "read-only", "--color", "never", "--model", model, "--config", `model_reasoning_effort=${JSON.stringify(effort)}`, "--output-last-message", lastMessage, "-"], fileOutput: true };
}

// Résoudre les shims npm Windows sans shell:true ni cmd/PowerShell.
export function resolveCommand(command, platform = process.platform, env = process.env) {
  if (platform !== "win32" || /[\\/]/.test(command.bin)) return command;
  for (const dir of (env.PATH || env.Path || "").split(delimiter).filter(Boolean)) {
    const executable = join(dir, `${command.bin}.exe`);
    if (existsSync(executable)) return { ...command, bin: executable };
    const npmEntry = command.bin === "codex" ? join(dir, "node_modules/@openai/codex/bin/codex.js") : command.bin === "claude" ? join(dir, "node_modules/@anthropic-ai/claude-code/cli.js") : null;
    if (npmEntry && existsSync(npmEntry)) return { ...command, bin: process.execPath, args: [npmEntry, ...command.args] };
  }
  return command;
}

export function invokeProvider(command, prompt, root = ROOT) {
  const resolved = resolveCommand(command);
  const result = spawnSync(resolved.bin, resolved.args, { input: prompt, encoding: "utf8", cwd: root, shell: false, windowsHide: true, timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (/unknown variant.*ultra|unsupported.*ultra|invalid.*ultra/i.test(result.stderr ?? "")) throw new Error("Cette CLI refuse Ultra. Utiliser la surface Codex qui expose Astra Ultra ; aucune substitution automatique par xhigh. Une éval distincte peut être lancée avec EVAL_EFFORT explicitement choisi et déclaré.");
    throw new Error(`Échec fournisseur ${command.provider} : ${result.error?.code || `code ${result.status}`}. Vérifier installation, session et compatibilité ; aucune relance automatique.`);
  }
  return result.stdout;
}

export function main(args = process.argv.slice(2), env = process.env) {
  if (args.length && !(args.length === 1 && args[0] === "--dry") && !(args.length === 2 && args[0] === "--fixture")) throw new Error("Usage : node evals/run.mjs [--dry | --fixture <fichier-json>]");
  const root = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
  const prompt = buildPrompt(root);
  if (args[0] === "--dry") { console.log(prompt); return 0; }
  const fixture = args[0] === "--fixture";
  let raw, command;
  if (fixture) raw = readFileSync(resolve(args[1]), "utf8");
  else {
    const temp = mkdtempSync(join(tmpdir(), "coverview-eval-"));
    try {
      const lastMessage = join(temp, "answer.txt");
      command = providerCommand(env, lastMessage);
      const stdout = invokeProvider(command, prompt);
      raw = command.fileOutput ? readFileSync(lastMessage, "utf8") : stdout;
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  const byId = parseAnswers(raw);
  const known = [...root.matchAll(/`docs\/([a-z0-9-]+\.md)`/g)].map((m) => m[1]);
  const results = scoreAnswers(byId, known);
  for (const row of results) {
    console.log(`${row.passed ? "✓" : "✗"} ${row.id}${row.absent ? " aucune réponse" : ""}`);
    for (const [key, title] of [["missing", "manquant"], ["forbidden", "interdit"], ["unknown", "inconnu"]]) if (row[key].length) console.log(`    ${title} : ${row[key].join(", ")}`);
  }
  const failed = results.filter((r) => !r.passed).map((r) => r.id);
  const passed = results.length - failed.length;
  console.log(`\n${passed}/${results.length} cas passés.${fixture ? " Fixture hors ligne : aucune preuve d'appel modèle, aucun historique de campagne écrit." : ""}`);
  if (!fixture) {
    const entry = { date: new Date().toISOString(), provider: command.provider, model: command.model || "(défaut CLI — non épinglé)", effort: command.effort || "(défaut CLI)", configuration_source: command.provider === "custom" ? "déclarée par l'opérateur ; commande personnalisée" : "arguments explicites du runner", passed, total: results.length, failed };
    appendFileSync(new URL("./history.jsonl", import.meta.url), JSON.stringify(entry) + "\n");
    console.log(`→ evals/history.jsonl (${entry.provider}, ${entry.model}, ${entry.effort})`);
    if (!command.model) console.log("⚠ Modèle non épinglé : campagne non comparable (EVAL-07).");
  }
  if (failed.length) console.log("Diagnostiquer table, exclusions et sortie fournisseur avant correction ; ne pas modifier l'attente pour faire passer l'éval.");
  return failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
