# Changelog du harness

> Le harness est **copié** dans chaque projet : sans version ni journal, chaque copie devient un fork silencieux (BOOT-08).
> Ce fichier existe pour rendre une mise à niveau lisible — d'où les **identifiants de règles** sur chaque entrée, jamais des formules vagues.
> Mise à niveau d'un projet existant : `/harness-upgrade`. Jamais une copie en masse par-dessus le référentiel local.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · Versionnement : [semver](https://semver.org/lang/fr/).

**Ce que signifie chaque incrément ici** — la portée est le *comportement de l'agent*, pas une API :

- **majeur** — une règle change de sens, disparaît, ou un artefact change de forme. Une mise à niveau demande de relire les projets existants.
- **mineur** — une règle est ajoutée, un outil est livré. Rétrocompatible : un projet non mis à jour reste conforme, il est seulement moins outillé.
- **correctif** — une erreur factuelle, une référence cassée, un garde-fou qui ne gardait pas. À porter partout, sans discussion.

---

## [3.0.0-coverview.1] — 2026-09-05

Adaptation locale CoverView du harness reçu en 2.1.0 ; ne désigne pas une release amont. Les changements de fournisseur, modèle et mode d'initialisation justifient un changement majeur local.

- **CDX-01 à CDX-05** : entrée Codex, procédures communes, capacités réellement observées, checkpoint de reprise et limite de détection du contexte à 70 %.
- **PROG-12/18/21, BOOT-10, DOC-16** : Astra Ultra demandé, preuve navigateur distinguée de validation humaine, préparation documentaire et traçabilité de la bible complète jusqu'aux futurs prompts.
- **AUTH-11, DSN-01, FRONT-14, HOST-01 à HOST-03, ENV-09** : WorkOS, preset utilisateur, interactions compactes, cible Infomaniak protégée, données fictives au départ. ADR fondateurs et PROJECT initialisés.
- **BRD-01 à BRD-04** : couleurs source, extensions accessibles proposées, tokens et intégrité des assets vérifiables.
- **ENV-05/06, SEC-08/09** : portée réelle des hooks et autorisations selon l'hôte ; pièces jointes distinguées des instructions opératoires.
- **EVAL-01** : runner Codex/Claude sans concaténation shell, fixture hors ligne distincte d'une campagne, tests Node. Linter étendu aux namespaces des nouvelles règles.
- **ARCH-02, BOOT-04** : cohérence du socle, temps réel au premier besoin métier. Anciennes incohérences d'exécution preview et de défauts VPS signalées pendant l'audit et corrigées dans cette adaptation.

## [2.1.0] — 2026-08-05

Traite les constats P2 d'`AUDIT.md`. Additif : un projet en 2.0.0 reste conforme, il est seulement moins outillé.

### Ajouté

- **`docs/launch.md`** (LAUNCH-01→07) — le référentiel menait un SaaS jusqu'à *déployable*, pas jusqu'à *vendable*. Couvre le jalon `M-Launch`, les pages légales sans lesquelles on ne peut pas encaisser dans l'UE, les droits RGPD réellement exerçables (export, suppression self-service — DATA-14 les exigeait sans jamais dire par quel parcours), la mesure d'activation dont PROG-11 dépend sans l'avoir jamais nommée, les runbooks avec leur porteur, et la boucle de retour utilisateur. Routé en §5 avec ses exclusions.
- **Canari C-06 — isolation tenant par défaut.** Les cinq canaris existants ne testaient que du **processus** ; aucun ne vérifiait un comportement d'ingénierie, alors que le harness désigne l'isolation tenant comme sa classe de bug la plus coûteuse (ENV-07) et la place en 3ᵉ priorité canonique.
- **`evals/history.jsonl`** et épinglage de modèle (`EVAL_MODEL`) — EVAL-07 exige ≥ 3 exécutions avec l'écart noté ; c'était inapplicable, l'éval n'enregistrant ni son modèle ni ses résultats. Un écart pouvait n'être qu'un changement de défaut de la CLI.
- **Quatre cas de routage** (27 au total) : R-025 teste l'exclusion la plus contre-intuitive de §5 (une page pricing qui *affiche* ne charge pas `billing.md`), R-023 son pendant (*créer* un plan le charge), R-026 l'îlot interactif, R-027 le routage de `launch.md`.
- **Linter** : contrôle des compteurs annoncés (cas, satellites, canaris) et allowlist des fichiers générés. Il a immédiatement attrapé deux compteurs périmés que cette version introduisait.
- **PROG-14** : budget monétaire — le coût est constaté à la livraison et reporté dans `cost:` (PROG-06). `HRN-OBS-005` exigeait des plafonds appliqués par la machine ; le profil solo les dégrade en constat, et la dégradation est désormais écrite dans `ADR-0001` au lieu d'être absente.

### Modifié

- **PROG-10** — un critère de DoD NE DOIT PAS déclarer V3/V5 quand V2 le couvre : chaque V3/V5 est une interruption humaine, et une DoD qui en fabrique par excès de zèle transforme le gate en formalité.
- **CLAUDE.md §4** — un satellite PEUT déclarer un ordre de priorité local pour un périmètre disjoint qu'il nomme (cas de MKT-01) ; §2 s'applique partout ailleurs. Le conflit §2/MKT-01 existait sans mandat.
- **CLAUDE.md §6.3** — relire le plan et le journal de vérification après une compaction de contexte. `HRN-CTX-003/004` n'était pas instanciée, alors que les artefacts pour survivre existaient déjà.
- **CLAUDE.md §5** — exclusions précisées : un îlot interactif charge `frontend.md` malgré l'exclusion générale des tâches `www` (MKT-04) ; la ligne `program.md` mentionne la preview et la vérification de fin de slice, sans quoi R-022 ne pouvait pas passer.
- **CLAUDE.md §7** — cinq entrées thématiques au lieu de neuf. Contenu normatif inchangé, budget de racine ramené de 160 à 152 lignes.
- **`templates/PROJECT.md`** — l'extraction des règles transverses pointait vers `product/rules.md`, absent de toute arborescence ; c'est `PRODUCT_RULES.md` à la racine.

## [2.0.0] — 2026-08-05

Première version numérotée. Le harness existait déjà (« v6 » dans son README, sans marqueur exploitable) ; l'absence de version étant précisément ce que BOOT-08 corrige, la numérotation repart proprement. Ensemble issu d'un audit contradictoire complet — voir `AUDIT.md`.

### Corrigé — trois gardes qui ne gardaient rien

- **ENV-08** — `scripts/preview.mjs` retombait sur `APP_ENV="local"` quand ni `APP_ENV` ni `NODE_ENV` n'étaient définies, donc démarrait sur toute machine où personne ne les exporte. C'est ce garde qui rend acceptable l'affichage en clair de la matrice ENV-07 : sans lui, elle est une faille. Désormais fail-closed (BACK-07).
- **G-05 / ENV-06** — le hook laissait passer `TRUNCATE <table>` sans le mot-clé `TABLE`, forme PostgreSQL usuelle. Ajout de la suppression de colonne et de la suppression de lignes non bornée.
- **G-05 / DEL-01** — le hook ne voyait pas les options intercalées entre `git` et `push`, ni la refspec forcée `+ref`, qui réécrit l'historique sans écrire `--force`.
- **DEL-01** — `.claude/settings.json` interdisait `--force-with-lease`, que DEL-01 autorise : le matching des permissions est un préfixe. Autorité déplacée sur le hook, où le lookahead la rend exacte (DOC-10).

### Corrigé — incohérences du référentiel

- **ARCH-06 / ENV-01 / BOOT-04** — le compose local était placé en `infra/` par deux surfaces et invoqué depuis la racine par trois autres : il n'aurait jamais été trouvé. Tranché **à la racine** ; `infra/` ne porte plus que le déploiement.
- **DOC-10 / ARCH-06** — l'arborescence de référence demandait de dupliquer `CLAUDE.md` en `AGENTS.md`, ce que `AGENTS.md` et le README interdisent tous deux.
- **PROG-03** — `/preview` cherchait un statut `in_progress` inexistant, donc sa section « À tester maintenant » ne se déclenchait jamais.
- **PROG-12** — `templates/backlog.yaml` pré-remplissait `session:` d'un nom de modèle, ce que PROG-12 interdit ; le champ porte le réel, pas la recommandation.
- **ENV-07** — référence croisée fausse (`DATA-04`, « requêtes N+1 ») là où l'isolation multi-tenant est visée (`DATA-09`).
- Placeholders jamais résolus (`MAIL-xx`, `BILL-xx`), `PERSONAS_MODULE` pointant vers un package absent d'ARCH-06, nombre de cas d'éval faux dans le README.
- Portabilité de `scripts/preview.mjs` : `import()` refuse un chemin absolu Windows et `.pathname` est percent-encodé ; arrêt de l'arbre de processus sous Windows ; `stop` avant tout `start` plantait.

### Ajouté

- **BOOT-08** — `HARNESS_VERSION`, ce changelog, et `/harness-upgrade`. La version est enregistrée dans `ADR-0001` à l'amorçage.
- **BOOT-09** — `templates/scaffold/` : les fichiers de configuration que le harness impose par ailleurs sont désormais **livrés**, plus régénérés de mémoire à chaque projet (HRN-P-001).
- **PROG-19** — voie rapide : une tâche triviale n'ouvre pas de slice, ne casse pas le WIP et ne produit pas huit artefacts. Sortie de la voie rapide sur test objectif, jamais sur une impression de taille.
- **PROG-08bis** — forme réduite de la livraison pour les slices standards. Le ledger, l'état committé et le statut du backlog ne s'allègent jamais.
- **`evals/lint-referentiel.mjs`** — vérification formelle du référentiel : règles citées inexistantes, satellites non routés, placeholders, budgets, statuts inventés. Gratuit, déterministe, sans appel modèle. Aurait détecté 12 des 14 erreurs de cette version.
- **`evals/guard-bash.test.mjs`** — 26 cas exécutant le hook réel, dont les trois trous ci-dessus (TEST-07, EVAL-05).
- **`templates/adr-0001.md`** — les huit formes dégradées du profil minimal, pré-remplies. `ADR-0001` devient une signature ; `harness-reference.md` n'a plus à être chargé au bootstrap.

### Modifié

- **BOOT-04** — le walking skeleton devient `S-000a/b/c`. En une slice, il produisait plusieurs milliers de lignes derrière un gate unique, contre DEL-02, et rendait PROG-14 inapplicable dès le premier jour.
- **BOOT-04** — gateway Socket.IO et adapter S3 **retirés** du bootstrap : les monter « sans usage métier encore » est exactement ce qu'ARCH-04 interdit.
- **BOOT-02** — l'interview annonçait « ≤ 12 questions » pour ~21 décisions réelles. Recomptée honnêtement (~16) et allégée de ce qui n'est pas une décision de jour 1.
- **DOC-10** — exception nommée pour le résumé de racine, à trois conditions. La règle en absolu était violée par l'architecture même du harness, donc inapplicable ; l'interdit strict est recentré sur le cas qui compte, entre deux satellites.
- **ENV-06 / SEC-09** — déduplication : le confinement réel est énoncé par SEC-09 seul.
- **ENV-06 / README** — deux limites jusqu'ici tues sont nommées : le hook produit des faux positifs sur toute commande mentionnant ses motifs, et l'`ask` réseau ne couvre que `curl` et `wget` — ni `pnpm dlx`, ni `npx`, ni `git fetch`. SEC-08 ne doit pas se lire comme si un proxy d'egress existait.

### Connu, non traité

- `CLAUDE.md` fait 156 lignes hors table de routage pour un budget `HRN-KNOW-001` de ~150 (+4 %). Signalé par le linter en avertissement, assumé en l'état.
- Les canaris ne couvrent aucun comportement d'ingénierie — notamment l'isolation tenant, que le harness désigne pourtant comme sa classe de bug la plus coûteuse (`AUDIT.md` C-04).
- Aucune surface ne couvre la mise en vente : légal, analytics d'activation, runbooks, support, RGPD self-service (`AUDIT.md` D-04).
