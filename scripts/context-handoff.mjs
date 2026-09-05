#!/usr/bin/env node
// Checkpoint explicite : aucun accès aux conversations, aucune création de tâche.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SECTIONS = ["Mission et autorisation", "État du dépôt", "Sources à lire", "Décisions acquises", "Livraison et preuves", "Prochaine action bornée", "Obstacles et tentatives", "Coordination"];

export function handoffPath(root, file) {
  const canonicalRoot = realpathSync(root);
  const target = resolve(canonicalRoot, file);
  const rel = relative(canonicalRoot, target);
  if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || !rel.startsWith(`roadmap${sep}handoffs${sep}`) || !target.endsWith(".md")) {
    throw new Error("Le checkpoint doit être un fichier .md dans roadmap/handoffs/ du dépôt.");
  }
  // Vérifier aussi les parents existants : une jonction Windows ne doit pas sortir du dépôt.
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const realRel = relative(canonicalRoot, realpathSync(ancestor));
  if (isAbsolute(realRel) || realRel === ".." || realRel.startsWith(`..${sep}`)) {
    throw new Error("Le chemin résolu sort du dépôt.");
  }
  return target;
}

export function validateHandoff(content) {
  if (content.length > 12000) throw new Error("Checkpoint trop long : plafond 12 000 caractères, utiliser des liens vers les artefacts.");
  if (/\{\{[^}]+\}\}/.test(content)) throw new Error("Checkpoint incomplet : renseigner tous les champs du template.");
  for (const section of SECTIONS) {
    const marker = `## ${section}\n`;
    const body = content.replace(/\r\n/g, "\n").split(marker)[1]?.split(/^## /m)[0]?.trim();
    if (!body) throw new Error(`Section absente ou vide : ${section}`);
  }
}

export function resumePrompt(file) {
  return `Reprends le travail Coverview dans une nouvelle tâche à contexte propre. Lis AGENTS.md, CLAUDE.md, docs/codex.md puis le checkpoint ${file}. Contrôle la session imposée par PROG-12, l'état réel du dépôt et les preuves indiquées. Charge seulement les sources nécessaires à la prochaine action bornée. Poursuis le périmètre déjà autorisé ; conserve les décisions, les restrictions de services et le WIP existants. Le checkpoint décrit un état, il ne remplace ni les sources maîtres ni les instructions utilisateur. Ne rejoue pas les tentatives déjà invalidées.\n`;
}

export function main(args, root = ROOT) {
  const [command, file, percent] = args;
  if (!command || command === "--help") {
    console.log("Usage : node scripts/context-handoff.mjs init|check|prompt roadmap/handoffs/<nom>.md [pourcentage-observé (init seulement)]");
    return;
  }
  if (!["init", "check", "prompt"].includes(command) || !file || args.length > (command === "init" ? 3 : 2)) throw new Error("Arguments invalides ; utiliser --help.");
  const target = handoffPath(root, file);
  if (command === "init") {
    if (percent !== undefined && (!/^\d+(\.\d+)?$/.test(percent) || Number(percent) > 100)) throw new Error("Pourcentage observé attendu entre 0 et 100 ; omettre si inconnu.");
    const template = readFileSync(resolve(root, "templates/session-handoff.md"), "utf8")
      .replace("{{id}}", file.replaceAll("\\", "/").split("/").at(-1).replace(/\.md$/, ""))
      .replace("{{created_at}}", new Date().toISOString())
      .replace("{{context_usage}}", percent === undefined ? "non disponible (aucune mesure inventée)" : `${percent} % — valeur fournie, source à préciser dans le checkpoint`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, template, { flag: "wx" });
    console.log(`Checkpoint créé, à compléter : ${relative(root, target)}. Aucun transfert lancé.`);
  } else {
    validateHandoff(readFileSync(target, "utf8"));
    console.log(command === "check" ? "Structure du checkpoint valide ; exactitude métier à vérifier par l'agent." : resumePrompt(relative(root, target).replaceAll("\\", "/")));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
