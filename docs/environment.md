# Environnement local et garde-fous de l'agent

> **Résumé** : docker-compose complet (pg, redis, minio, mail), .env.example exhaustif validé au boot, seeds idempotents par persona, jamais de données de prod en local ; garde-fous destructifs de l'agent.

## ENV-01 — Environnement reproductible

- `docker-compose` fournit toutes les dépendances locales : PostgreSQL (même version majeure que la prod — TEST-06), Redis, MinIO (STOR-01), serveur mail de dev (Mailpit/MailHog).
- `pnpm dev` + `docker compose up -d` suffisent pour démarrer. Toute étape supplémentaire est documentée dans CLAUDE.md §0bis.

## ENV-02 — Variables d'environnement

- `.env.example` est **exhaustif** et committé : chaque variable, un commentaire, une valeur d'exemple factice. Aucune valeur réelle.
- Le schéma de validation au démarrage (BACK-07) est la référence ; `.env.example` reste synchronisé avec lui. Toute nouvelle variable = mise à jour de `.env.example` + mention dans le compte rendu.

## ENV-03 — Seeds

Idempotents (relançables sans doublons), minimaux, réalistes, organisés par persona selon la matrice **ENV-07**. Le module de personas est la **source de vérité unique** des identifiants de test : aucune commande, aucun README et aucun satellite ne les recopie (DOC-10) — ils sont lus depuis les seeds au moment de l'affichage.

## ENV-04 — Données de production

JAMAIS copiées telles quelles en local (DATA-14). Si un jeu réaliste est nécessaire : export anonymisé via un processus documenté.

## ENV-05 — Garde-fous de l'agent IA

En complément de G-04/G-05/G-07/G-08 :

- NE JAMAIS écrire un secret réel dans un fichier, y compris `.env`, un test, un exemple ou un commentaire. Utiliser des placeholders.
- NE JAMAIS exécuter sans confirmation explicite de l'utilisateur : `DROP`/`TRUNCATE`, suppression de données, `db:reset` hors local, `rm -rf` hors du workspace, `git push --force`, commandes touchant un environnement distant.
- Ne pas modifier le lockfile à la main (DEP-02) ; ne pas éditer ou supprimer le `.env` de l'utilisateur.
- Ne pas lancer de commandes bloquantes en mode watch dans un contexte d'agent ; préférer les exécutions ponctuelles (`pnpm test <path>`).
- Rester dans le workspace du projet ; ne pas lire ni écrire ailleurs.
- Ne jamais « réparer » la CI en désactivant l'outil qui échoue (TEST-09).
- En cas de doute sur la portée destructive d'une commande : demander (G-01).

## ENV-06 — Gates techniques (origine HRN-SEC-004/007, G-15)

Le bras armé de G-05 et G-17 est la configuration de l'outil, jamais la prose : une règle écrite en langage naturel se viole silencieusement. Ce qui est livré avec le harness :

- **`.claude/settings.json`** — `deny` : suppression récursive de la racine ou du home, `git push -f`, lecture/écriture de `.env`. `ask` : push, `curl` et `wget`, `db:migrate`, `db:reset`, `docker compose down`, `ssh`/`scp`.
- **`.claude/hooks/guard-bash.mjs`** — hook `PreToolUse` sur `Bash` : bloque (exit 2, motif renvoyé au modèle) les suppressions récursives visant hors du workspace, le DDL destructif (`DROP`, `TRUNCATE`, `DELETE` non borné), le force push sous toutes ses formes, la destruction de volumes Docker et l'écriture directe dans un `.env`. Écrit en Node pour rester portable Windows/macOS/Linux.

**Le force push relève du hook, et de lui seul** (DOC-10). Le matching des permissions est un **préfixe** : `git push --force*` en `deny` capturait aussi `git push --force-with-lease`, que DEL-01 autorise explicitement sur sa propre branche. Une règle qui ne peut pas être exprimée exactement sur une surface ne DOIT pas y être écrite approximativement — elle vit là où elle est exacte.

**Portée honnête de ces deux mécanismes.** Le matching de permissions est préfixe, et le hook est une heuristique sur une chaîne de caractères : les deux sont contournables par composition (`cd .. && rm -rf x`), encodage ou indirection. Ils attrapent l'accident, pas l'adversaire. Deux conséquences à assumer : le hook produit des **faux positifs** (toute commande contenant `DROP TABLE`, y compris un `grep` ou un message de commit, est bloquée — c'est le sens du compromis), et l'`ask` sur le réseau sortant ne couvre **que `curl` et `wget`** : `pnpm dlx`, `npx`, `git fetch`, `node -e "fetch(…)"` passent. Le confinement réseau réel exige un proxy d'egress, hors périmètre du profil solo — ne pas lire SEC-08 comme si ce proxy existait. Ne pas confondre ce dispositif avec un bac à sable : **ce qui constitue le confinement réel est énoncé par SEC-09**, qui en est le propriétaire. Ne pas le réénoncer ici — `environment.md` et `security.md` se chargent indépendamment, donc deux formulations divergentes seraient indétectables (DOC-10, dont l'exception de résumé ne vaut qu'entre racine et satellite).

Un gate DOIT présenter l'action exacte, son effet et sa réversibilité avant approbation — jamais un pavé opaque à approuver aveuglément.

**Hook de formatage (optionnel, après S-000).** Une fois Prettier installé, ajouter un `PostToolUse` sur `Edit|Write` qui reformate le fichier touché applique G-15 sur les conventions de style. À ne pas activer avant le bootstrap : la commande échouerait sur un dépôt vide.

```json
"PostToolUse": [
  { "matcher": "Edit|Write",
    "hooks": [{ "type": "command", "command": "pnpm exec prettier --write --ignore-unknown $CLAUDE_FILE_PATHS" }] }
]
```


## ENV-07 — Matrice de personas de preview

Une persona par rôle ne suffit pas à tester un SaaS multi-locataire : avec une seule organisation, **l'isolation est intestable**, alors que c'est la classe de bug la plus coûteuse du modèle (DATA-09, PERM-02). Les états de facturation manquent tout autant, sans quoi les entitlements ne se vérifient pas (BILL-05).

Les seeds DOIVENT exporter un module `personas` — un objet par compte avec `email`, `password`, `org`, `role`, `state` et `tests` (ce que la persona permet de vérifier). Matrice minimale :

| Persona | Org | Rôle | État | Débloque |
|---|---|---|---|---|
| `owner@<slug>.test` | Acme | owner | actif | administration d'organisation, facturation, invitations |
| `member@<slug>.test` | Acme | member | actif | parcours nominal |
| `viewer@<slug>.test` | Acme | viewer | actif | lecture seule, absence des actions d'écriture |
| `outsider@<slug>.test` | Globex | owner | actif | **isolation** : ne doit rien voir d'Acme |
| `trial@<slug>.test` | Initech | owner | essai J-3 | bannière d'essai, limites de plan |
| `pastdue@<slug>.test` | Umbrella | owner | impayé | dégradation d'accès, relances (MAIL-09) |
| `platform@<slug>.test` | — | platform admin | — | `apps/admin` |

- Domaine `.test` : TLD réservé (RFC 2606), il ne résout jamais — aucun risque d'envoi accidentel vers une adresse réelle.
- Mot de passe : constante lisible dans les seeds, surchargeable par `SEED_PASSWORD`. Ce n'est pas un secret (SEC-03 ne s'applique pas) **parce que** ENV-08 rend l'existence de ces comptes impossible hors local. Sans ce garde, ce serait une faille.
- Toute nouvelle dimension d'autorisation (rôle, entitlement, état d'abonnement, **plan du catalogue** — CAT-07) DOIT ajouter sa persona dans le même changement : une dimension non seedée est une dimension non testée.

## ENV-08 — Preview locale (origine HRN-VER-003)

`node scripts/preview.mjs start` — ou la commande `/preview` — lance l'infra docker puis chaque app **en processus détaché**, logs dans `.preview/`, PID dans `.preview/pids.json`, et attend que chaque URL réponde avant de rendre le panneau. Le détachement n'est pas un confort : `pnpm dev` bloque la session de l'agent, ce qui rend la vérification impossible depuis une conversation.

- **Garde d'environnement (impératif)** : le script REFUSE de s'exécuter si `APP_ENV` n'est ni `local` ni `development`. Des comptes à mot de passe connu hors du poste de développement sont un incident de sécurité, pas un inconvénient. Ce garde est ce qui rend l'affichage en clair des identifiants acceptable.
- Idempotent : une app déjà vivante n'est pas relancée. `stop` arrête les apps, `stop --all` arrête aussi docker.
- La commande NE DOIT PAS exécuter `db:reset` ni de migration destructive (ENV-05). Schéma en retard ⇒ le signaler et proposer, pas exécuter.
- `.preview/` DOIT être dans `.gitignore` : logs et PID sont du transitoire local.
- Limite à connaître : les URLs sont en `localhost`. Elles ne sont atteignables que par un navigateur tournant **sur la même machine** que la stack. Depuis un appareil distant, il faut un tunnel — hors périmètre du harness.