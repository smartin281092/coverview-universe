#!/usr/bin/env node
/**
 * Garde-fou PreToolUse — bras armé de G-05 et ENV-05.
 *
 * Écrit en Node (et non en shell) pour rester portable Windows / macOS / Linux :
 * Node est de toute façon une dépendance dure de la stack (CLAUDE.md §0).
 *
 * Entrée  : JSON sur stdin — { tool_name, tool_input: { command } }
 * Sortie  : exit 0 = autorisé · exit 2 = bloqué, le stderr est renvoyé au modèle
 *
 * AUTORITÉ SUR LE FORCE PUSH — ce fichier, et lui seul (DOC-10).
 * `.claude/settings.json` ne peut pas exprimer « --force mais pas
 * --force-with-lease » : son matching est un préfixe, donc `git push --force*`
 * y capturait aussi la forme que DEL-01 autorise. La règle vit ici, où le
 * negative lookahead la rend exacte.
 *
 * PORTÉE ET LIMITES — à lire avant de faire confiance à ce fichier.
 * C'est une heuristique sur une chaîne de caractères, pas un bac à sable.
 * Elle est contournable par composition, encodage ou indirection
 * (`bash -c "$(echo cm0gLXJmIC8K | base64 -d)"`). Elle attrape l'accident,
 * pas l'adversaire. Le vrai confinement reste : dépôt versionné, état committé
 * en fin de slice (DEL-01), et permissions `ask` sur le réseau sortant (SEC-08).
 */

const RULES = [
  {
    id: "G-05 · suppression récursive hors workspace",
    re: /\brm\s+(-[a-zA-Z]*\s+)*-?[a-zA-Z]*[rR][a-zA-Z]*f|\brm\s+(-[a-zA-Z]*\s+)*-?[a-zA-Z]*f[a-zA-Z]*[rR]/,
    guard: (cmd) => /\brm\b[^|;&]*\s(\/|~|\$HOME|\.\.)/.test(cmd) || /\brm\b[^|;&]*\s\.\s*$/.test(cmd),
    why: "Suppression récursive visant la racine, le home ou un parent du workspace.",
  },
  {
    // `truncate table?` exigeait le mot-clé TABLE et laissait donc passer
    // `TRUNCATE users;`, qui est la forme PostgreSQL usuelle. Le DELETE non
    // borné est ajouté : c'est la même perte de données sans le mot DROP.
    id: "G-05 · DDL destructif",
    re: /\b(drop\s+(table|database|schema|type|index|view|column|owned)\b|truncate\s+(table\s+)?["\w.]|delete\s+from\s+["\w.]+(?![\s\S]*\bwhere\b))/i,
    why: "DROP / TRUNCATE / DELETE non borné détecté. Passer par une migration versionnée (DATA-08).",
  },
  {
    // Le motif `git\s+push` ne voyait pas les options intercalées : `git -C dir
    // push --force` passait. La refspec forcée (`+main`) est un force push sans
    // le mot `--force` — elle doit être traitée à l'identique.
    id: "G-05 · réécriture d'historique partagé",
    re: /\bgit\s+(?:[^\s|;&]+\s+){0,6}?push\b[^|;&]*?(--force(?!-with-lease)|\s-f\b|\s\+[\w./*-]+)/,
    why: "Force push (option, refspec `+ref` ou `git -C … push`). `--force-with-lease` sur ta propre branche uniquement (DEL-01).",
  },
  {
    id: "G-05 · destruction de volumes",
    re: /docker\s+(compose\s+)?down\b[^|;&]*(-v\b|--volumes)/,
    why: "Détruit les volumes locaux (base, MinIO). Relancer les seeds sera nécessaire (ENV-03).",
  },
  {
    id: "G-04 · secret en clair",
    re: /(^|[|;&]\s*)(cat|echo|printf)\b[^|;&]*>\s*\.?\/?\.env(\.|$|\s)/,
    why: "Écriture directe dans un .env. Les secrets ne transitent jamais par l'agent (SEC-03).",
  },
];

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // entrée illisible : ne jamais bloquer le travail sur un bug du hook
  }
  if (!cmd) process.exit(0);

  for (const r of RULES) {
    if (!r.re.test(cmd)) continue;
    if (r.guard && !r.guard(cmd)) continue;
    process.stderr.write(
      `BLOQUÉ par .claude/hooks/guard-bash.mjs — ${r.id}\n` +
        `${r.why}\n` +
        `Commande : ${cmd}\n` +
        `Si l'action est réellement voulue : l'expliquer et demander confirmation explicite (G-01), ` +
        `ne pas la reformuler pour passer le garde-fou (G-08).\n`
    );
    process.exit(2);
  }
  process.exit(0);
});
