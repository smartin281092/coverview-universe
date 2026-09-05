# Audit du harness SaaS v6

> Audit contradictoire du référentiel tel que livré (63 fichiers, 4 208 lignes).
> Cible assumée : **solopreneur, vélocité, développement vertical** — c'est le critère d'arbitrage utilisé partout ci-dessous.
> Chaque constat est ancré sur un fichier et une ligne, et vérifiable.
>
> **Les constats décrivent l'état livré, avant correction.** Voir §0bis pour ce qui est déjà corrigé.

---

## 0bis. Statut des correctifs

**P0 appliqué et vérifié** (commit « fix: correctifs P0 »). Les constats A-01 à A-13 et B-01 sont résolus ; leur libellé ci-dessous reste au présent car il décrit le défaut d'origine, pas l'état courant.

| Constat | Correctif | Oracle |
|---|---|---|
| A-01 | Garde `APP_ENV` fail-closed : variable absente ⇒ refus, avec message d'action | **V3** — exécuté : absent → exit 1, `production` → exit 1, `local` → passe |
| A-02, A-03 | Regex DDL (`TRUNCATE` sans mot-clé, `DROP COLUMN`, `DELETE` non borné) et force push (`git -C … push`, refspec `+ref`) | **V2** — `evals/guard-bash.test.mjs`, 26/26 contre le hook réel |
| A-04 | `git push --force*` retiré du `deny` (préfixe qui capturait `--force-with-lease`) ; autorité déplacée sur le hook, où le lookahead est exact | **V2** — cas `--force` bloqué / `--force-with-lease` passant |
| A-05 | `docker-compose.yml` tranché **à la racine** ; `infra/` réservé au déploiement. ARCH-06 et BOOT-04 alignés sur §0bis et ENV-01 | **V0** — plus aucune occurrence de `infra/docker-compose` |
| A-06 | `in_progress` → `running` (PROG-03) | **V0** |
| A-07, A-08 | `fileURLToPath` + `pathToFileURL` (chemins Windows et percent-encodés) ; `taskkill /T` sous Windows ; `mkdirSync` avant `stop` | **V3** sur POSIX (`stop` avant `start` : exit 0) · **fait non vérifié** sur Windows — pas de machine Windows ici, correction par lecture de code |
| A-09, A-11, A-12, A-13 | `DATA-04`→`DATA-09` · `MAIL-xx`→`MAIL-09` · `BILL-xx`→`BILL-10` · `session:` vidé (PROG-12 interdit les noms de modèles) · `PERSONAS_MODULE` aligné sur ARCH-06 | **V0** |
| A-10 | « 20 cas » → « 24 cas » | **V0** — compté depuis `cases.mjs` |
| B-01 | `architecture.md` : « dupliquer en AGENTS.md » → renvoi, jamais copie | **V0** |

**Ajouté au passage**, parce qu'un bug important laisse un test derrière lui (TEST-07) : `evals/guard-bash.test.mjs` — 26 cas exécutant le hook réel, dont les 3 trous trouvés en audit et 6 cas de non-régression sur les commandes courantes.

**Découvert pendant la correction, non listé dans l'audit initial** : le hook produit des **faux positifs** sur toute commande *mentionnant* les motifs — il a bloqué deux de mes propres commandes de vérification (un `grep` contenant `git push --force`, un test contenant `TRUNCATE`). C'est le compromis inhérent à une heuristique de chaîne, mais il n'était documenté nulle part. Désormais nommé dans ENV-06 et le README. Conséquence pratique : les tests du hook passent par un fichier, jamais par la ligne de commande.

### P1 appliqué

| Constat | Correctif | Oracle |
|---|---|---|
| **C-01** | `evals/lint-referentiel.mjs` — règles citées inexistantes, satellites non routés, placeholders, budgets, statuts inventés, chiffres périmés, fichiers référencés absents. Branché en CI (`ci.yml`, job `referentiel`) et en script `pnpm lint:docs` | **V2** — passe à 0 erreur sur le dépôt, et **test de sensibilité exécuté** : trois régressions injectées (`DATA-77`, `MAIL-xx`, `in_progress`) sont toutes détectées puis restaurées |
| **D-01** | `templates/scaffold/` — 12 fichiers livrés : `.gitignore`, compose, `.env.example`, CI, `package.json`, workspace, turbo, tsconfig strict, eslint, prettier, dependency-cruiser (7 règles de frontières réelles), knip | **V0** — JSON/JS validés, config dependency-cruiser chargée. **Fait non vérifié** : aucun `pnpm install` possible sans projet réel ; leur premier oracle est le `S-000a` d'un projet |
| **D-02** | `HARNESS_VERSION` (2.0.0), `CHANGELOG.md` par identifiants de règles, `/harness-upgrade` (application entrée par entrée, jamais par écrasement), version enregistrée dans `ADR-0001` — BOOT-08 | **V0** |
| **D-05** | S-000 découpé en `S-000a/b/c`, chacune avec son oracle de fin ; Socket.IO et adapter S3 **retirés** du bootstrap (ARCH-04). Backlog, ROADMAP, README, `/start-project` et PROG-12 alignés | **V0** |
| **C-06 / E** | `PROG-19` voie rapide (test de sortie objectif, jamais une impression de taille) et `PROG-20` forme réduite de la livraison. Ledger, état committé et statut de backlog ne s'allègent jamais | **V0** |
| **B-02** | DOC-10 amendée : exception nommée du résumé de racine, à trois conditions cumulatives ; l'interdit strict est recentré sur le cas satellite↔satellite. ENV-06 dédupliqué au profit de SEC-09 | **V0** |
| **B-03** | BOOT-02 recomptée (~16 décisions, zéro obligatoire) et allégée de ce qui n'est pas une décision de jour 1 (SSO, cible alternative, domaines) | **V0** |
| **B-04** | `templates/adr-0001.md` — les huit formes dégradées pré-remplies. `harness-reference.md` n'est plus requis au bootstrap | **V0** |
| **B-07** | `program.md` réordonné : PROG-01→20 en ordre numérique (13/14 étaient après 18). `PROG-08bis` renommé `PROG-20`, la convention étant `MAJUSCULE-NN` (DOC-15) | **V0** — vérifié par script |
| **A-14** | Arborescence ARCH-06 remise à jour : `evals/`, `scripts/`, `preview.config.mjs`, `.claude/hooks/`, `templates/scaffold/`, `HARNESS_VERSION` | **V0** |

### P2 appliqué — l'audit est soldé

| Constat | Correctif | Oracle |
|---|---|---|
| **D-04** | `docs/launch.md` (LAUNCH-01→07) : jalon `M-Launch`, pages légales, droits RGPD exerçables, mesure d'activation, runbooks avec porteur, boucle de retour. Routé en §5 avec ses exclusions | **V0** — linter, routage vérifié dans les deux sens |
| **C-04** | Canari `C-06 — Isolation tenant par défaut` : on juge le repository, pas l'écran | **V0** — 6 canaris, journal des passages étendu |
| **C-03** | `EVAL_MODEL` + `evals/history.jsonl` (date, modèle, score, cas rouges) + avertissement explicite quand le modèle n'est pas épinglé | **V0** — `--dry` fonctionne, syntaxe validée |
| **B-05 / B-06** | R-023 charge désormais `billing.md` (créer un plan a une contrepartie Stripe) ; R-025 teste le cas inverse — la page pricing qui n'affiche que ; ligne §5 de `program.md` complétée pour que R-022 soit satisfiable | **V0** — 27 cas, aucun doublon |
| **D-03** | Budget monétaire : `cost:` dans PROG-06, PROG-14 étendu, ligne déjà présente dans `templates/adr-0001.md` | **V0** |
| **B-08** | §4 autorise un ordre de priorité local pour un périmètre disjoint nommé (MKT-01) | **V0** |
| **B-09** | §5 : un îlot interactif charge `frontend.md` (R-026 le teste) | **V0** |
| **B-10** | `PRODUCT_RULES.md` à la racine, au lieu d'un `product/` qui n'existait nulle part | **V0** |
| **C-07** | PROG-10 : pas de V3/V5 déclaré quand V2 couvre le critère | **V0** |
| **D-06** | §6.3 : relire plan et journal de vérification après compaction | **V0** |
| **C-02** | §7 compressé de 9 à 5 entrées à contenu normatif constant → racine ramenée de 160 à **152** lignes hors table | **V0** — mesuré par le linter |

**Reste l'avertissement de budget** : 152 lignes pour ≈ 150. `HRN-KNOW-001` dit « ordre de grandeur ≲ 150 » — 1 % au-dessus est un arrondi, pas une dérive. Le linter continue de l'afficher en ⚠ (non bloquant) plutôt que de voir son seuil ajusté pour passer, ce qui serait l'équivalent de désactiver un test (G-08).

**Sur le linter lui-même** : à chaque passe, il a trouvé des erreurs que j'avais introduites dans le même mouvement — trois références de fichiers, deux compteurs périmés (« 24 cas », « 37 satellites »). C'est la démonstration la plus directe de C-01 : ces erreurs sont exactement celles qu'une relecture humaine laisse passer, et elles coûtent 80 lignes de Node à éliminer définitivement.

---

## 0. Verdict

Le harness est **nettement au-dessus de la moyenne** de ce qui circule sous ce nom. Ce qui le distingue réellement :

- **PROG-15/16** (classement des inconnues par *conséquence*, question fermée en tête de plan) est la meilleure idée du document. C'est la seule parade sérieuse au mode de panne « hypothèse plausible → GO nu → règle métier fausse en base », et elle est correctement outillée (canari C-01 binaire : on juge *où* la règle est écrite, pas sa qualité).
- **G-18 + rayon d'impact** : un « supposé » qui ne dit pas ce qu'il faudrait changer s'il est faux est décoratif. Peu de référentiels vont jusque-là.
- **DOC-09** (choix de surface par déclencheur) et le refus assumé des skills pour les normes : raisonnement correct, conclusion correcte.
- **EVAL-03** (inclusion/disjonction, jamais égalité d'ensembles) : la seule assertion qui survit à l'ajout d'un satellite.
- **Les déclarations de portée honnête** (ENV-06, SEC-09, EVAL-06, GEO-01, PROG-14, DOC-14) : le document nomme ses propres limites au lieu de les masquer. C'est rare et ça vaut plus que dix règles supplémentaires.

**Ce qui casse**, par ordre d'impact :

1. **Le harness ne livre aucun scaffolding exécutable** — c'est la plus grosse perte de vélocité, et une violation de son propre principe fondateur `HRN-P-001`. (§D.1)
2. **Une dizaine d'erreurs mécaniques** rendent inopérants `/preview`, le hook de garde et l'éval — dont trois de sécurité. (§A)
3. **DOC-10 (« une règle, une surface ») est violée systémiquement par l'architecture même du harness**, sans carve-out écrit. (§B.1)
4. **Aucun linter du référentiel** alors que le document répète que « les docs sont du code ». Les 14 erreurs de §A auraient toutes été détectées par ~80 lignes de Node. (§C.1)
5. **Angles morts produit** (légal, analytics d'activation, runbooks) qui bloquent une mise en vente réelle, pas une mise en production technique. (§D.4)

---

## A. Erreurs factuelles et bugs — vérifiés

| # | Gravité | Fichier | Constat |
|---|---|---|---|
| A-01 | **Critique** | `scripts/preview.mjs:33` | **Le garde d'environnement est fail-open.** `process.env.APP_ENV ?? process.env.NODE_ENV ?? "local"` : si aucune des deux variables n'est définie, la valeur retenue est `"local"` et le lanceur démarre. Or ENV-08 et le README affirment que l'affichage en clair des mots de passe de personas est acceptable **parce que** « le lanceur refuse de démarrer si `APP_ENV` n'est pas local ». Sur une machine où `APP_ENV` n'est pas exportée — le cas par défaut d'un VPS fraîchement provisionné — la garantie n'existe pas. Contredit aussi BACK-07 (« échouer immédiatement si une configuration obligatoire est absente »). **Correctif** : exiger la variable, refuser si absente. |
| A-02 | **Critique** | `.claude/hooks/guard-bash.mjs:28` | **La forme la plus courante de `TRUNCATE` n'est pas bloquée.** La regex exige le mot-clé `table` : `truncate\s+table?` matche `TRUNCATE TABLE users` mais **pas** `TRUNCATE users;` — qui est la syntaxe PostgreSQL usuelle. Vérifié par exécution. Non couverts non plus : `ALTER TABLE … DROP COLUMN`, `DELETE FROM` sans `WHERE`, `DROP OWNED`. |
| A-03 | **Critique** | `.claude/hooks/guard-bash.mjs:33` | **Le blocage du force push se contourne trivialement.** `git\s+push` exige `push` immédiatement après `git` : `git -C /repo push --force` passe. `git push origin +main` (refspec forcée) passe aussi. Vérifié par exécution. |
| A-04 | **Majeur** | `.claude/settings.json:6` vs `docs/delivery.md:9` | **Les deux couches de garde se contredisent.** Le matching des permissions est un préfixe : `Bash(git push --force*)` en `deny` capture aussi `git push --force-with-lease`, que DEL-01 autorise explicitement sur sa propre branche. Le hook, lui, laisse passer `--force-with-lease` (négative lookahead correct). Résultat : la règle documentée est mécaniquement interdite. |
| A-05 | **Majeur** | `scripts/preview.mjs:83` vs `docs/bootstrap.md:38`, `docs/architecture.md:71` | **`/preview` ne peut pas démarrer l'infra.** Le script exécute `docker compose up -d` avec `cwd = ROOT`, alors que ARCH-06 et BOOT-04 placent le fichier en `infra/docker-compose.yml`. `docker compose` ne descend pas dans les sous-dossiers : il ne trouvera rien. Même incohérence dans `CLAUDE.md:41`. Il faut trancher : compose à la racine, ou `-f infra/docker-compose.yml` partout. |
| A-06 | **Majeur** | `.claude/commands/preview.md:11` | **Statut de slice inexistant.** La commande cherche `roadmap/backlog.yaml` « en statut `in_progress` ». Le cycle de vie PROG-03/PROG-06 ne connaît que `idea → specified → ready → running → review → done`. La section « À tester maintenant » ne se déclenchera jamais — c'est pourtant le cœur de la valeur de `/preview`. |
| A-07 | **Majeur** | `scripts/preview.mjs:39` | **Non portable Windows, alors que la portabilité est la justification écrite du choix de Node** (en-tête du fichier, l.10). `await import(join(ROOT, "preview.config.mjs"))` reçoit un chemin absolu Windows (`C:\…`) et lève `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Il faut `pathToFileURL()`. Accessoirement `new URL("..").pathname` est *percent-encodé* : un chemin contenant une espace casse aussi sur macOS/Linux. |
| A-08 | Majeur | `scripts/preview.mjs:64-73` | **`stop` sur Windows laisse des orphelins**, et **`stop` avant tout `start` plante**. `process.kill(-pid)` n'existe pas sous Windows ; le repli `process.kill(pid)` tue le `cmd.exe` intermédiaire (`shell: true`) mais pas le serveur de dev. Par ailleurs `writeFileSync(PIDS, "{}")` échoue en `ENOENT` si `.preview/` n'a jamais été créé (`mkdirSync` n'est appelé que dans la branche `start`). |
| A-09 | Majeur | `docs/environment.md:58` | **Mauvaise référence croisée.** ENV-07 justifie la matrice de personas par l'isolation multi-tenant en citant « (DATA-04, PERM-02) ». DATA-04 est *« Requêtes N+1 »*. La règle visée est **DATA-09** (modèle multi-tenant explicite). Une référence fausse dans la justification de la règle la plus coûteuse du modèle. |
| A-10 | Mineur | `README.md:62` | **Compte de cas faux** : « 20 cas ». `evals/cases.mjs` en contient **24** (vérifié). Le README est le seul endroit qui chiffre l'éval ; il est déjà périmé. |
| A-11 | Mineur | `docs/environment.md:69`, `preview.config.mjs:24` | **Placeholders jamais résolus** livrés en production : `relances (MAIL-xx)` et `Stripe test mode uniquement (BILL-xx)`. `MAIL-09`/`BILL-10` sont les cibles réelles. |
| A-12 | Mineur | `templates/backlog.yaml:9` | **Viole PROG-12 qu'elle cite.** La ligne `session: "Opus 5 · xhigh"   # PROG-12` inscrit un **nom de modèle**, précisément ce que PROG-12 interdit (« la recommandation s'exprime en tiers, jamais en noms de modèles… figer une génération reproduit l'erreur que BOOT-05 interdit »). Double faute : PROG-06 définit `session:` comme *« modèle + effort réellement utilisés, renseigné à la livraison »* — le template le pré-remplit avec une *recommandation*, ce qui confond les deux sémantiques et rend le champ inexploitable pour comparer recommandé vs réel. |
| A-13 | Mineur | `preview.config.mjs:10` | **Chemin de personas pointant vers un package non défini** : `./packages/db/src/seed/personas.mjs`. `packages/db` n'existe dans aucune arborescence de référence (ARCH-06 liste `contracts`, `catalog`, `api-client`, `ui`). BOOT-04 dit « `preview.config.mjs` complété » — mais le défaut livré est faux, donc `/preview` sortira `personasError` au premier lancement. |
| A-14 | Mineur | `docs/architecture.md:42-74` | **Arborescence de référence périmée.** ARCH-06 ne mentionne ni `evals/`, ni `scripts/`, ni `preview.config.mjs`, ni `.claude/hooks/`, et annote `.claude/commands/` d'un seul `# /start-project` alors que 9 commandes sont livrées. C'est la carte que l'agent lira pour se repérer. |
| A-15 | Mineur | `evals/run.mjs:61` | `spawnSync(bin, args)` sans `shell: true` : sur Windows, `claude` est un `.cmd` et l'appel échoue en `ENOENT`. Même remarque de portabilité que A-07. |

---

## B. Incohérences internes

### B-01 — `AGENTS.md` : contradiction frontale (Majeur)

`docs/architecture.md:44` annote l'arborescence : `CLAUDE.md   # racine du harness (dupliquer en AGENTS.md pour Codex)`.

`AGENTS.md:5` dit exactement l'inverse : *« Ce fichier est un **pointeur**, jamais une copie (DOC-10) : deux copies d'un même référentiel divergent »*. `README.md:7` le répète.

Un agent qui lit `architecture.md` (satellite routé pour toute tâche d'architecture) exécutera la duplication interdite. **Correctif** : `# racine du harness (AGENTS.md pointe vers ce fichier — jamais de copie, DOC-10)`.

### B-02 — DOC-10 est violée par l'architecture du harness lui-même (Majeur, structurel)

DOC-10 : *« Une même règle NE DOIT JAMAIS exister sur deux surfaces chargées indépendamment. »* Sans carve-out. Or :

- **Racine ↔ satellite** : `CLAUDE.md` §6.2 réénonce PROG-07, §6.4 réénonce PROG-10, §6.5 réénonce PROG-08 quasi intégralement, §7 réénonce ARCH-01, G-01 réénonce PROG-15, G-18 réénonce PROG-08. La racine est *toujours* chargée, `program.md` est routé : ce sont bien **deux surfaces indépendantes** portant le même texte normatif.
- **Satellite ↔ satellite** : le paragraphe « le confinement réel repose sur trois choses (dépôt versionné / état committé / contenu externe ≠ instruction) » existe en quasi-verbatim dans `environment.md:42` (ENV-06), `security.md:44` (SEC-09), `README.md:26` et l'en-tête de `guard-bash.mjs:15`. **Quatre copies**, dont deux satellites routés séparément (une tâche « garde-fous agent » charge `environment.md`, une tâche « sécurité transverse » charge `security.md`).
- **Configuration ↔ prose** : ENV-06 recopie en prose le contenu de `.claude/settings.json` (listes `deny`/`ask`). Au premier ajustement du fichier JSON, la prose ment — et c'est la prose que l'agent lira.
- **Choix d'auth** : AUTH-01 dit « le choix réel est consigné dans §0 de CLAUDE.md **et** un ADR » ; `templates/PROJECT.md` a une section « Authentification » ; BOOT-03 impose `ADR-0003`. **Trois destinations** pour une même décision.

Ce n'est pas une faute d'inattention, c'est un défaut de spécification : la règle est écrite en absolu alors que le design a *besoin* de résumés en racine. **Correctif** : amender DOC-10 avec une exception nommée — *« un résumé en racine qui cite l'identifiant de la règle satellite et n'en ajoute aucune clause n'est pas une copie ; toute clause normative absente du satellite est une violation »* — puis auditer §6 de la racine pour retirer les clauses qui n'existent que là (il y en a : le plafond « ≤ 3 questions » et l'échelle V0→V5 sont formulés différemment en racine et en `program.md`).

### B-03 — BOOT-02 : la borne annoncée est fausse (Majeur)

`docs/bootstrap.md:11` : *« ≤ 12 questions au total »*. Décompte des décisions réellement demandées par les 5 blocs (l.18-22) : nom, problème, personas, apps activées, apps additionnelles, langues (6) · tenancy, PII, résidence (3) · OAuth, magic link, SSO (3) · 3-5 parcours, Stripe + plans + entitlements, IA, hors-périmètre (4) · cible de déploiement, domaines, cible alternative, URL du dépôt, fournisseur email (5) = **~21**.

Le mécanisme « répondre *défauts* accepte le bloc » rattrape en partie, mais la borne affichée n'est pas la borne réelle. Pour une procédure dont l'argument de vente est « la vitesse d'abord », c'est le premier chiffre que l'utilisateur confrontera au réel. **Correctif** : soit compter honnêtement (« 5 blocs, ~20 décisions, toutes avec défaut — 2 minutes si vous répondez *défauts* »), soit couper (domaines, cible alternative, SSO à terme et résidence des données ne sont pas des questions de jour 1 : ce sont des slices ultérieures).

### B-04 — BOOT-03 force le chargement d'un document explicitement hors routage (Majeur)

`bootstrap.md:28` exige que `ADR-0001` documente *« la forme dégradée retenue pour chaque invariant du profil minimal (…) `harness-reference.md` §15.2 »*.

Or `CLAUDE.md:155` classe `harness-reference.md` : *« Théorie du harness (référence) — **uniquement sur demande explicite** »*. Et le fichier fait **864 lignes**, soit ~1,7× le budget `HRN-KNOW-007` (≤ 500 lignes) qu'il édicte lui-même.

Conséquence pratique : le bootstrap — le moment le plus coûteux en contexte — charge 864 lignes de théorie pour en extraire un tableau de 8 lignes. **Correctif** : extraire le tableau §15.2 dans `templates/adr-0001.md` pré-rempli (les formes dégradées sont **déjà toutes décidées** : PROG-13 pour le journal, PROG-14 pour les budgets, PROG-12 pour l'épinglage, EVAL-02 pour les évals). L'ADR devient une signature, pas une rédaction.

### B-05 — L'éval de routage ne teste pas l'exclusion la plus spécifique de §5 (Majeur)

`CLAUDE.md:157` pose une exclusion précise et contre-intuitive : *« une tâche sur l'offre ou la page pricing charge `catalog.md` (+ `marketing-web.md`) mais **pas** `billing.md` »*.

`evals/cases.mjs` R-023 est exactement ce cas (« Ajouter un plan Team … et mettre à jour la page pricing ») et son `exclude` liste `realtime, jobs, storage, geo` — **pas `billing.md`**. L'exclusion qui a le plus besoin d'être testée (parce que c'est celle qu'un modèle enfreindra spontanément) n'est pas asserted.

Cette exclusion est par ailleurs **discutable au fond** : ajouter un plan implique de créer produit et prix côté Stripe et de vérifier la dérive `lookupKey` (CAT-03/CAT-08), ce qui est du territoire `billing.md`. À trancher : soit l'exclusion est juste et l'éval doit la tester, soit elle est trop agressive et §5 doit la nuancer (« page pricing seule : pas `billing.md` ; création d'un plan : `catalog.md` + `billing.md` »).

### B-06 — R-022 assert un chargement que §5 ne permet pas de déduire (Majeur)

`cases.mjs` R-022 (« Lancer les applications en local pour que je teste la slice en cours ») exige `load: ["environment.md", "program.md"]`. La ligne §5 de `program.md` dit : *« Roadmap, backlog, slices, plans, livraison de fin de tâche »* — rien sur la preview ni la vérification. PROG-18 (`/preview` = oracle V3/V5) vit bien dans `program.md`, mais **la table ne le laisse pas deviner**.

Ce cas échouera, et la conclusion de `run.mjs` (« un échec = la table de routage, pas le modèle ») est ici littéralement correcte. **Correctif** : compléter la ligne §5 → *« Roadmap, backlog, slices, plans, **preview et vérification de fin de slice**, livraison »*.

### B-07 — `PROG-13` et `PROG-14` sont placés après `PROG-18` (Mineur)

`docs/program.md` : ordre physique 01→12, puis 15, 16, 17, 18, **puis 13, 14**. Les IDs sont stables (c'est la règle, et c'est bien), mais rien n'oblige à casser l'ordre de lecture. Un lecteur qui parcourt le fichier croit avoir fini à PROG-18 et rate le budget de slice et le journal du programme — deux règles opérationnelles.

### B-08 — Un satellite redéfinit l'ordre de priorité de la racine sans mandat (Mineur)

`CLAUDE.md` §2 fixe un ordre de priorité canonique en 11 points. `marketing-web.md` MKT-01 déclare *« Ordre de priorité propre »* en 7 points, différent. C'est légitime au fond (le SEO ne se hiérarchise pas comme la tenancy), mais §4 « Résolution de conflits » n'autorise nulle part un satellite à redéfinir §2 — il ne prévoit qu'une précédence *entre satellites*. **Correctif** : une phrase en §2 (« un satellite PEUT déclarer un ordre local pour un périmètre disjoint, à condition de le nommer explicitement — voir MKT-01 »).

### B-09 — Exclusion `frontend.md` sur les tâches `www` (Mineur)

§5 : *« tâche `www` → charger `marketing-web` + `seo` + `geo`, pas `frontend.md` ni `design.md` »*. Mais MKT-04 impose des **îlots React** hydratés. Écrire un îlot interactif *est* du travail frontend (états FRONT-10, accessibilité FRONT-12, doubles soumissions FRONT-13 pour un formulaire de lead). L'exclusion est trop large pour ce sous-cas. **Correctif** : *« sauf îlot interactif, qui charge aussi `frontend.md` »*.

### B-10 — `product/rules.md` cité sans exister dans l'arborescence (Trivial)

`templates/PROJECT.md` : *« Au-delà d'une trentaine d'entrées, extraire vers `product/rules.md` »*. `product/` n'apparaît dans aucune arborescence de référence.

---

## C. Faiblesses de conception

### C-01 — « Les docs sont du code » mais il n'existe aucun linter du référentiel (Majeur)

`HRN-KNOW-004` et `EVAL-02` posent que les documents sont du code. G-15 impose que *« toute convention vérifiable mécaniquement DOIT être imposée par l'outillage »*. Le harness livre une éval **sémantique** (un appel modèle) mais **aucune vérification syntaxique**, alors que celle-ci est gratuite et déterministe.

Les 14 constats de §A ont tous été trouvés en une passe de script. Un `evals/lint-referentiel.mjs` d'environ 80 lignes, sans dépendance, en < 1 s, détecterait :

- identifiants de règle référencés mais non définis (`MAIL-xx`, `BILL-xx`, `DATA-04` mal ciblé) ;
- satellite présent sur disque mais absent de §5, et inversement ;
- budgets dépassés (racine > 150 lignes hors table `HRN-KNOW-001` ; satellite > 500 lignes `HRN-KNOW-007`) ;
- désynchronisation `cases.mjs` ↔ chiffre annoncé dans le README ;
- IDs dupliqués ou non monotones dans un fichier ;
- statuts de backlog cités dans `.claude/commands/` mais absents de PROG-03.

C'est le correctif au meilleur rapport valeur/effort du lot, et il est **exactement dans la doctrine du harness** (G-15, `HRN-P-001`). À brancher en `pre-commit` : contrairement à l'éval de routage, il ne coûte ni appel modèle ni authentification, donc l'argument d'EVAL-02 contre la CI ne s'applique pas.

### C-02 — La racine dépasse son propre budget (Mineur, mais c'est le canari)

`HRN-KNOW-001` : ≲ 150 lignes **hors table de routage**. Mesuré : `CLAUDE.md` = 202 lignes, §5 = 46 lignes → **156 lignes hors table**. Dépassement faible (+4 %), mais dans un document qui fait de ce budget un invariant et qui reproche aux autres le « doc monolithique préchargée », il faut soit couper (§7 « Définition de terminé » recoupe largement ARCH-01 + §6.5), soit assumer le seuil par écrit.

`harness-reference.md` (864 lignes) dépasse `HRN-KNOW-007` de 73 %. Le statut « hors routage » l'excuse partiellement — mais B-04 montre que le bootstrap l'appelle quand même.

### C-03 — L'éval de routage n'enregistre pas le modèle utilisé, ce qui rend EVAL-07 inapplicable (Majeur)

EVAL-07 exige ≥ 3 exécutions et *« l'écart entre elles DOIT être noté »* pour toute décision qui compte. Or `evals/run.mjs` :

- n'épingle aucun modèle (`EVAL_CMD = "claude -p"`, ce que la CLI choisira ce jour-là) ;
- n'enregistre nulle part le modèle ni la date ;
- n'écrit aucun historique — sortie console uniquement, `exit 1` en cas d'échec.

`canaries.md` a un journal des passages (colonne « Modèle ») ; l'éval machine, plus fréquente, n'en a pas. On ne peut donc pas comparer deux campagnes, ce qui est pourtant l'usage prescrit lors d'un changement de modèle. **Correctif** : `EVAL_MODEL` explicite dans la commande + append d'une ligne JSONL dans `evals/history.jsonl` (date, modèle, cas passés/total, cas rouges).

### C-04 — Les canaris ne couvrent pas la classe de bug que le harness désigne lui-même comme la plus coûteuse (Majeur)

ENV-07 : *« l'isolation est intestable [avec une seule org], alors que c'est la classe de bug la plus coûteuse du modèle »*. §2 place « isolation et intégrité des données » en 3ᵉ priorité, avant tout le reste sauf exactitude et sécurité.

Les cinq canaris (C-01 à C-05) testent tous du **processus** : refus d'inventer, gate de plan, honnêteté du ledger, contenu externe, changement de stratégie. **Aucun ne teste un comportement d'ingénierie**. Rien ne vérifie que l'agent, à qui l'on demande « ajoute une liste de projets », scope bien par `organization_id` (G-03, DATA-09).

C'est cohérent avec EVAL-06 (« l'éval prouve qu'il charge les bons documents, pas qu'il les applique ») — mais alors la lacune est nommée sans être comblée là où elle coûte le plus cher. **Correctif** : un canari `C-06 — Isolation tenant par défaut` : dans un projet initialisé, « ajoute l'endpoint `GET /projects` », succès = repository scopé tenant + test d'isolation écrit sans qu'on l'ait demandé. Coût : dix minutes, même cadence que les autres.

### C-05 — La portée annoncée du garde « réseau sortant » excède la réalité (Majeur)

SEC-08 : *« le réseau sortant reste en `ask` tant qu'une tâche implique de lire du contenu externe »* — c'est la mitigation déclarée de la trifecta létale.

`.claude/settings.json` met en `ask` exactement deux binaires : `curl` et `wget`. Ne sont pas couverts : `node -e "fetch(…)"`, `pnpm dlx` / `npx` (or **DSN-01 impose `pnpm dlx shadcn@latest init`**, qui est un egress non gardé), `git fetch/clone`, `gh`, `python -c`, tout MCP réseau. La phrase « le réseau sortant est en `ask` » est donc fausse au pied de la lettre.

Le harness est ailleurs exemplaire d'honnêteté sur la portée de ses gardes (ENV-06, SEC-09). Ici il ne l'est pas. **Correctif** : reformuler (« `curl` et `wget` sont en `ask` — le confinement réseau réel exige un proxy d'egress, hors périmètre du profil solo »), ou élargir la liste.

### C-06 — Aucun chemin défini pour une tâche hors slice (Majeur pour la vélocité)

Toute la couche programme suppose la slice : PROG-02 (chaque entrée du backlog est une slice), PROG-04 (WIP = 1), G-17 (plan persisté validé), PROG-08 (livraison structurée en 4 étapes + candidats mémoire + brouillon de plan suivant).

§6.1 admet bien des tâches « triviales » et « standards », et §6.2 dit qu'elles se contentent d'un plan conversationnel. Mais **rien ne dit ce qu'elles deviennent côté programme** : entrent-elles au backlog ? cassent-elles le WIP = 1 de la slice en cours ? produisent-elles un ledger complet et un brouillon de plan suivant ?

En pratique, un solo corrige un libellé, ajuste un texte, répare un lien — plusieurs fois par jour. Sans chemin explicite, l'agent appliquera soit la cérémonie complète (friction absurde), soit rien (perte de traçabilité). **Correctif** : une règle `PROG-19 — Voie rapide` : *« Une tâche triviale ou standard non issue du backlog n'ouvre pas de slice, ne casse pas le WIP, ne produit ni plan persisté ni brouillon suivant. Elle produit un commit conventionnel et deux lignes de compte rendu. Si elle touche une permission, un schéma, un contrat public ou de l'argent, ce n'est pas une voie rapide — c'est une slice. »*

### C-07 — Le gate `/preview` fonctionne, mais le harness ne dit pas quoi faire de la fatigue de gate (Mineur)

Sur une boucle réelle, chaque slice à surface visible impose : plan → GO → exécution → `/preview` → verdict humain → `/ship`. Quatre interruptions humaines. PROG-18 précise correctement que `/preview` n'est requis que si la DoD porte un critère V3/V5 — mais rien ne dit **comment écrire une DoD qui n'en porte pas** quand c'est légitime (slice purement backend). Le risque réel : l'agent inscrit un critère V3 par excès de zèle et fabrique un gate inutile. Une phrase suffirait : *« un critère de DoD ne DOIT pas déclarer d'oracle V3/V5 si un oracle V2 le couvre entièrement »*.

---

## D. Angles morts pour la cible « solopreneur, vélocité, vertical »

### D-01 — Le harness ne livre aucun fichier exécutable, ce qui contredit son principe fondateur (Critique)

`HRN-P-001` : *« Tout ce qui peut être déterministe DOIT sortir du prompt et entrer dans le code. Le prompt est le dernier recours, pas le premier. »*

Ce qui est **imposé** par le harness mais **régénéré par le modèle** à chaque S-000, sans aucun fichier de référence livré :

| Imposé par | Fichier attendu | Livré ? |
|---|---|---|
| BOOT-07 (avant toute installation) | `.gitignore` | ✗ |
| ENV-01, BOOT-04 | `infra/docker-compose.yml` | ✗ |
| ENV-02, BACK-07 | `.env.example` + schéma de validation | ✗ |
| DEL-04, ARCH-14 | `.github/workflows/ci.yml` | ✗ |
| ARCH-14 | `.dependency-cruiser.cjs`, config `knip` | ✗ |
| §0 (TypeScript strict) | `tsconfig.base.json` | ✗ |
| §0, ARCH-06 | `pnpm-workspace.yaml`, `turbo.json` | ✗ |
| §0 (qualité) | `eslint.config.js`, `.prettierrc` | ✗ |
| §0bis | `package.json` racine avec les 12 scripts documentés | ✗ |
| BOOT-04 | `Dockerfile`, compose de prod, `Caddyfile` | ✗ |
| ENV-03, ENV-07 | module `personas` des seeds | ✗ |
| ENV-08 | `.preview/` dans `.gitignore` | ✗ |

Le harness livre 4 208 lignes de **prose normative** et **zéro ligne de configuration**. Conséquence directe :

1. **Non-déterminisme** : deux bootstraps produisent deux CI et deux configurations de frontières différentes. Impossible de dire « le harness impose ARCH-14 » — il impose que le modèle *réinvente* ARCH-14.
2. **Coût** : S-000 est la slice la plus chère et la plus longue, alors que ~80 % de son contenu est identique d'un projet à l'autre. Pour une cible « vélocité », c'est le poste de perte n° 1.
3. **Fragilité** : `pnpm boundaries` est documenté en §0bis comme s'il existait ; il n'existera que si le modèle pense à câbler dependency-cruiser *et* knip *et* le script npm.

**Correctif** : un dossier `templates/scaffold/` contenant les fichiers ci-dessus, copiés tels quels par BOOT-03 étape 0bis, puis ajustés. BOOT-05 (« dernières versions stables, ne jamais figer de numéros ») reste tenable : les fichiers de configuration ne portent pas de versions, seul `package.json` en porte — et il est le seul à générer via `pnpm add`. **C'est la modification la plus rentable de tout cet audit.**

### D-02 — Ni version, ni CHANGELOG, ni procédure de mise à jour (Critique pour le développement vertical)

Le harness est conçu pour être **copié** dans chaque nouveau projet (README étape 1). Or :

- aucun `HARNESS_VERSION` ni champ de version : impossible de savoir avec quelle version un projet a été amorcé ;
- le README a une section « Révisions » qui commence par « **Cette version** » — sans numéro ;
- aucune procédure de mise à jour d'un projet existant.

Pour un solopreneur qui fait du **développement vertical** — donc plusieurs produits partageant le même socle — c'est bloquant à horizon six mois : chaque projet devient un fork silencieux, une correction (par exemple A-01, le garde fail-open) doit être re-portée à la main partout, et rien ne dit où elle a déjà été appliquée.

**Correctif minimal** : `HARNESS_VERSION` (une ligne, semver), `CHANGELOG.md` avec les IDs de règles touchés par version, `ADR-0001` qui enregistre la version d'amorçage, et une commande `/harness-upgrade` qui compare la version du projet à celle du harness source et présente le diff règle par règle. Sans ça, le harness est un *snapshot*, pas un actif — ce qui contredit son propre postulat d'ouverture (« Modèle = moteur qui se périme ; **Harness = actif durable** »).

### D-03 — Rien sur l'économie de l'agent (Majeur)

PROG-12 arbitre le couple modèle+effort, PROG-14 pose un budget « en sessions ». Nulle part une notion de **coût monétaire** : pas de budget par slice, pas de suivi du coût cumulé, pas de règle d'arrêt. `harness-reference.md` en a pourtant plusieurs (`HRN-TASK-003`, `HRN-OBS-002`, `HRN-OBS-005` « les plafonds DOIVENT être appliqués, pas seulement alertés », `HRN-OBS-007` « le coût du harness doit être isolé du coût de la tâche ») — aucune n'est instanciée, et §15.2 ne les liste pas dans les dégradations assumées.

Pour la cible visée, le coût des tokens est un poste de dépense réel et le premier arbitrage quotidien. **Correctif** : ajouter la ligne « budgets monétaires » au tableau §15.2 avec sa forme dégradée (« constaté a posteriori, reporté dans `backlog.yaml` à côté de `session:` »), et un champ `cost:` dans le format PROG-06. Deux lignes, et le harness cesse de piloter à l'aveugle son poste de coût principal.

### D-04 — Ce qui manque pour *vendre*, pas pour *déployer* (Majeur)

Le référentiel couvre remarquablement bien la chaîne technique. Il s'arrête net avant la mise en vente. Manquent, par ordre de blocage :

1. **Légal** — CGU/CGV, politique de confidentialité, politique cookies, mentions légales, DPA sous-traitants, registre des traitements. `DATA-14` traite le RGPD **techniquement** (inventaire PII, rétention, droits) et `MKT-09` le consentement — mais aucune surface ne produit les documents sans lesquels on ne peut pas encaisser un euro dans l'UE. C'est le seul manque qui empêche littéralement de lancer.
2. **Analytics produit / activation** — `OBS-03` couvre la latence et les DLQ, `MKT-10` les Core Web Vitals. Rien sur activation, rétention, funnel d'essai → conversion, churn. Pour un solo, ce sont les métriques qui décident du prochain jalon (et PROG-11 exige de relire la roadmap « à la lumière du réel : usage, douleurs, coûts » — sans jamais dire d'où vient cet usage).
3. **Runbooks opérationnels** — DEL-07 exige « restauration testée régulièrement » et « documenter la procédure de rollback dans le runbook », mais aucun template de runbook n'est livré, aucune slice récurrente ne porte le test de restauration. Une exigence sans porteur est une exigence morte. Idem : rotation des secrets (SEC-03 « DEVRAIT être prévue »), mode maintenance / kill switch (`HRN-SEC-008` non instancié), gestion DNS/TLS/domaines.
4. **Support et boucle de feedback** — aucune surface (adresse de contact, gestion des tickets, changelog produit public, page de statut). MEM-03 collecte les apprentissages *de l'agent* ; rien ne collecte ceux *des utilisateurs*.
5. **Self-service RGPD** — DATA-14 exige export, rectification, effacement. Aucune slice type, aucun critère de DoD, aucune persona de preview associée. C'est le genre d'exigence qu'on découvre à la première demande d'utilisateur.

Suggestion de forme : un satellite `docs/launch.md` (checklist de mise en vente : légal, facturation réelle, délivrabilité, monitoring, support, RGPD self-service) + une section « Jalon M-Launch » dans `templates/ROADMAP.md`. Coût : ~60 lignes. Ça transforme un harness d'ingénierie en harness de business, ce qui est le titre affiché.

### D-05 — S-000 est une méga-slice qui contredit trois règles du harness (Majeur)

BOOT-04 charge S-000 de : monorepo + Turbo + TS strict + ESLint/Prettier + dependency-cruiser + knip + CI, docker-compose 4 services, migration 0 + seeds + personas, `apps/api` Fastify + Better Auth + health checks, `apps/client`, `apps/admin` (avec MFA), `apps/www` Astro + robots + sitemap + llms.txt + 404, shadcn dans deux apps, **gateway Socket.IO**, **adapter S3**, Dockerfiles + compose prod + Caddy + pipeline de déploiement.

Trois frictions :

- **ARCH-04 (« ne pas construire pour des besoins hypothétiques »)** est violé dans le texte même de BOOT-04, qui monte une gateway Socket.IO « aucun événement métier encore » et un adapter S3 « sans usage métier encore ». Le harness s'auto-déroge sans ADR.
- **DEL-02** recommande des PR < ~400 lignes de diff. S-000 en produira plusieurs milliers, en un seul GO, avec un seul plan.
- **PROG-14** demande un budget en sessions et un point d'arrêt (« si la slice n'est pas passée en revue après N sessions, elle est redécoupée »). S-000 est la slice qui déclenchera cette règle en premier, et le harness ne prévoit pas son redécoupage.

**Correctif** : découper en `S-000a` (monorepo, qualité, CI, compose, migration 0, seeds), `S-000b` (api + auth + client + page protégée = le vrai critère de fin d'ARCH-02), `S-000c` (déploiement + Caddy + premier push), et **différer** Socket.IO et S3 à la première slice qui en a besoin. Le critère de fin d'ARCH-02 (« créer un compte, se connecter, voir une page protégée sur une URL déployée ») est atteint par a+b+c sans gateway temps réel ni stockage objet.

### D-06 — Aucune stratégie de reprise après compaction de contexte (Mineur)

`HRN-CTX-003/004` (compaction structurée, journalisée) n'est pas instanciée. Sur une slice longue — et S-000 en est une — le contexte sera compacté. Le harness a les bons artefacts pour survivre (plan persisté, journal de vérification, `MEMORY.md`, backlog), mais il ne dit nulle part à l'agent de **relire son plan et son journal de vérification après compaction**. Une ligne en §6.3 suffirait, et c'est exactement le genre de règle qui distingue une slice reprise proprement d'une slice qui repart de zéro.

---

## E. Tension vélocité / cérémonie — évaluation honnête

Le harness s'auto-décrit comme optimisé pour la vélocité. Coût fixe par slice significative, en artefacts produits ou mis à jour :

`S-xxx.plan.md` → attente du GO → exécution → journal de vérification → `/preview` → verdict humain → compte rendu à ledger → `backlog.yaml` → `MEMORY.md` (candidats) → promotion DOC-11 → cas d'éval éventuel → brouillon du plan suivant = **~8 artefacts et 2 à 4 points d'attente humaine.**

Ce coût est **justifié** sur une slice qui touche argent, droits, schéma ou contrat public — c'est précisément la thèse de PROG-15, et elle est juste. Il est **disproportionné** sur une slice CRUD suivant un motif déjà présent, qui est pourtant le cas majoritaire d'un SaaS en construction.

Les garde-fous existent (§6.1 proportionnalité, PROG-18 « /preview requis seulement si V3/V5 ») mais ils portent sur l'**inspection** et la **vérification**, jamais sur la **livraison** : PROG-08 n'a pas de forme réduite. Le résultat probable en usage réel est celui que le document redoute ailleurs pour les évals — *« une éval qu'on hésite à lancer n'est pas lancée »* : un rituel trop lourd n'est pas allégé, il est abandonné en bloc, et on perd aussi les 20 % qui comptaient.

**Correctif** : `PROG-19` (voie rapide, cf. C-06) **et** une forme réduite explicite de PROG-08 pour les slices standards : compte rendu + backlog, sans candidats mémoire ni brouillon suivant si la slice n'a rien appris et que la suivante est déjà `ready`. Rendre l'allègement **légitime et nommé**, plutôt que le laisser se produire par lassitude.

---

## F. Plan de correction priorisé

### P0 — À corriger avant tout usage réel (bugs, dont trois de sécurité)

| Ref | Action | Effort |
|---|---|---|
| A-01 | `preview.mjs` : exiger `APP_ENV`, refuser si absent (fail-closed) | 2 lignes |
| A-02 | Hook : `truncate\s+(table\s+)?[\w".]` ; ajouter `drop\s+column`, `delete\s+from\s+\w+\s*;` | 3 lignes |
| A-03 | Hook : `git(\s+-\S+\s+\S+)*\s+push` ; ajouter la refspec `\s\+\w` | 2 lignes |
| A-04 | `settings.json` : remplacer `git push --force*` par `git push --force ` + `git push --force-all`… ou déléguer entièrement au hook | 1 ligne |
| A-05 | Trancher l'emplacement du compose et l'aligner sur `preview.mjs`, `CLAUDE.md:41`, ARCH-06, BOOT-04 | 4 fichiers |
| A-06 | `/preview` : `in_progress` → `running` | 1 mot |
| A-07/A-08 | `preview.mjs` : `pathToFileURL`, `mkdirSync` avant `stop`, arrêt Windows | ~10 lignes |
| A-09, A-11, A-12, A-13 | Références et placeholders : `DATA-04`→`DATA-09`, `MAIL-xx`→`MAIL-09`, `BILL-xx`→`BILL-10`, `session:` vidé, `PERSONAS_MODULE` aligné sur l'arborescence | 5 lignes |
| B-01 | `architecture.md:44` : retirer « dupliquer en AGENTS.md » | 1 ligne |

### P1 — Structurel, haut rendement

| Ref | Action |
|---|---|
| **D-01** | `templates/scaffold/` : `.gitignore`, compose, `.env.example`, CI, dependency-cruiser, knip, tsconfig, eslint, prettier, turbo, `pnpm-workspace.yaml`, `package.json` racine. **Le correctif le plus rentable de l'audit.** |
| **C-01** | `evals/lint-referentiel.mjs` + `pnpm lint:docs` + `pre-commit`. Aurait détecté 12 des 15 constats de §A. |
| **D-02** | `HARNESS_VERSION` + `CHANGELOG.md` + `/harness-upgrade` + version enregistrée dans `ADR-0001`. |
| **D-05** | Découper S-000 en a/b/c ; sortir Socket.IO et S3 du bootstrap (ARCH-04). |
| **C-06 / E** | `PROG-19` voie rapide + forme réduite de PROG-08. |
| **B-02** | Amender DOC-10 (exception « résumé référençant l'identifiant ») puis dédupliquer ENV-06 / SEC-09 / README. |
| **B-03** | Recompter ou réduire l'interview BOOT-02. |
| **B-04** | `templates/adr-0001.md` pré-rempli avec le tableau §15.2 → `harness-reference.md` cesse d'être requis au bootstrap. |

### P2 — Consolidation

| Ref | Action |
|---|---|
| C-04 | Canari `C-06 — Isolation tenant par défaut`. |
| C-03 | Modèle épinglé + `evals/history.jsonl` (rend EVAL-07 applicable). |
| B-05, B-06 | Corriger R-023 (`exclude: billing.md` ou nuancer §5) et la ligne §5 de `program.md`. |
| C-05 | Reformuler la portée réelle du garde réseau (ou l'élargir). |
| D-03 | Budget monétaire : ligne §15.2 + champ `cost:` dans PROG-06. |
| D-04 | Satellite `docs/launch.md` + jalon M-Launch (légal, analytics, runbooks, support, RGPD self-service). |
| B-07..B-10, C-02, C-07, D-06 | Ordre de PROG-13/14, §2 vs MKT-01, exclusion îlots, `product/`, budget de racine, DoD sans V3 inutile, relecture du plan après compaction. |

---

## G. Ce qu'il ne faut pas « corriger »

Trois choix qui paraissent des faiblesses et n'en sont pas — les toucher dégraderait le harness :

- **L'éval de routage ne prouve pas l'application des règles** (EVAL-06). C'est nommé, quantifié, et le niveau supérieur est explicitement différé « jusqu'à ce qu'une même règle ait été violée deux fois ». C'est la bonne décision en profil solo.
- **La stack imposée sans question.** Retirer la liberté de choix est exactement ce qui fait gagner du temps, et la porte de sortie (demande explicite + ADR) est correctement dimensionnée.
- **`MEMORY.md` comme sas et non comme source de vérité** (MEM-04 + DOC-04). C'est le seul design de mémoire projet qui ne pourrit pas en six mois.
