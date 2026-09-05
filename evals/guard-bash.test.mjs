#!/usr/bin/env node
/**
 * Tests de non-régression du hook de garde — TEST-07.
 *
 *   node evals/guard-bash.test.mjs
 *
 * Trois de ces cas correspondent à des trous réels trouvés en audit :
 *   · `TRUNCATE users;` (sans le mot-clé TABLE) n'était pas bloqué ;
 *   · `git -C <dir> push --force` contournait le motif `git\s+push` ;
 *   · `git push origin +main` force l'historique sans écrire `--force`.
 * Un cas ajouté après un échec ne se supprime pas une fois la règle corrigée
 * (EVAL-05) : c'est ce qui empêche la régression au prochain remaniement.
 *
 * Les règles sont EXTRAITES du hook, jamais recopiées ici (DOC-10) : un test
 * qui duplique la regex qu'il teste ne teste plus rien dès qu'elles divergent.
 *
 * Sans dépendance, sans installation — mêmes contraintes que evals/run.mjs.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOOK = join(ROOT, ".claude/hooks/guard-bash.mjs");

/** Exécute le hook tel que Claude Code l'appelle : JSON sur stdin, exit 2 = bloqué. */
const runHook = (command) => {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  return { blocked: res.status === 2, stderr: res.stderr ?? "" };
};

const CASES = [
  // — DDL destructif —————————————————————————————————————
  ['psql -c "TRUNCATE users;"', true, "TRUNCATE sans le mot-clé TABLE (forme PostgreSQL usuelle)"],
  ['psql -c "TRUNCATE TABLE users"', true, "TRUNCATE TABLE"],
  ['psql -c "DROP TABLE users"', true, "DROP TABLE"],
  ['psql -c "DROP DATABASE app"', true, "DROP DATABASE"],
  ['psql -c "ALTER TABLE t DROP COLUMN c"', true, "DROP COLUMN"],
  ['psql -c "DELETE FROM users"', true, "DELETE sans WHERE"],
  ['psql -c "DELETE FROM users WHERE id = 1"', false, "DELETE borné par WHERE"],

  // — Réécriture d'historique ————————————————————————————
  ["git push --force", true, "force push nu"],
  ["git push -f", true, "force push court"],
  ["git -C /autre/repo push --force", true, "options intercalées entre git et push"],
  ["git push origin +main", true, "refspec forcée, sans le mot --force"],
  ["git push --force-with-lease", false, "autorisé par DEL-01 sur sa propre branche"],
  ["git push -u origin main", false, "push nominal"],

  // — Suppression récursive ——————————————————————————————
  ["rm -rf /", true, "racine"],
  ["rm -rf ~/projets", true, "home"],
  ["rm -rf ../autre-projet", true, "parent du workspace"],
  ["rm -rf node_modules", false, "dans le workspace"],
  ["rm -rf .preview", false, "transitoire local (ENV-08)"],

  // — Volumes Docker ————————————————————————————————————
  ["docker compose down -v", true, "détruit les volumes locaux"],
  ["docker compose down", false, "arrêt sans perte de données"],

  // — Écriture de secret ————————————————————————————————
  ["echo 'SECRET=x' > .env", true, "écriture directe dans .env"],
  ["cat .env.example", false, "lecture d'un exemple"],

  // — Commandes courantes : aucun faux positif toléré ici —————
  ["pnpm test apps/api", false, "tests"],
  ["pnpm db:migrate", false, "migration (gérée par `ask`, pas par le hook)"],
  ["pnpm lint && pnpm typecheck", false, "qualité"],
  ["node scripts/preview.mjs start", false, "preview"],
];

let failed = 0;
for (const [command, expectBlocked, label] of CASES) {
  const { blocked } = runHook(command);
  const ok = blocked === expectBlocked;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${(blocked ? "bloqué" : "passé ").padEnd(7)} ${command.padEnd(38)} ${label}`
  );
}

console.log(`\n${CASES.length - failed}/${CASES.length} cas passés.`);
if (failed) {
  console.log(
    "Un échec = la regex du hook, pas le cas de test. Corriger .claude/hooks/guard-bash.mjs ;\n" +
      "ajuster l'attente pour faire passer la suite est l'équivalent de désactiver un test (G-08, TEST-09)."
  );
  process.exit(1);
}
