# Harness SaaS solo — mode d'emploi

Harness complet pour développer un SaaS seul avec un agent de code (Claude Code, Codex) : référentiel d'ingénierie routé (38 satellites), couche programme (roadmap, slices, plans validés), mémoire projet, garde-fous outillés et procédure d'initialisation « Start project ». Stack imposée, dernières versions stables, vitesse de livraison d'abord — sans sacrifier les règles.

## Lancer un nouveau projet

1. Créer un **dossier vide** — pas besoin d'initialiser Git, le bootstrap s'en charge (`git init -b main`, `.gitignore`, commits — BOOT-07) — et y coller **tout le contenu** de ce dossier à la racine (`CLAUDE.md`, `AGENTS.md`, `docs/`, `templates/`, `.claude/`). `AGENTS.md` est un pointeur d'une ligne vers `CLAUDE.md` : ne jamais le remplacer par une copie (DOC-10).
2. Ouvrir Claude Code dans le dossier et lancer `/start-project` (ou écrire « Start project »). L'absence de `PROJECT.md` déclenche la procédure de `docs/bootstrap.md`.
3. Répondre à l'interview — 5 blocs, ~16 décisions, **zéro réponse obligatoire** : tout a un défaut, et « défauts » accepte un bloc entier. L'authentification se décide au bloc 3 ; la stack n'est pas une question.
4. Relire les sorties : `PROJECT.md`, ADR-0001/0002/0003, `ROADMAP.md`, `roadmap/backlog.yaml`, puis le plan `S-000a`.
5. Répondre **« GO S-000a »**. Le walking skeleton se fait en **trois slices**, chacune avec son gate — en une seule, l'amorçage produit plusieurs milliers de lignes derrière un unique « GO », ce qui n'est plus un point de contrôle :
   - **`S-000a`** socle outillé — `templates/scaffold/` copié puis ajusté, monorepo, CI, compose, migration 0, seeds. Fin : `pnpm lint && pnpm typecheck && pnpm build` passe et les seeds sont rejouables.
   - **`S-000b`** authentification réelle — `apps/api` (Fastify + Better Auth), `client`, `admin`, `www` coquille. Fin : parcours réel en local via `/preview`.
   - **`S-000c`** mise en ligne — Docker, Caddy, pipeline, premier push. Fin : le critère ci-dessous, sur l'URL déployée.
6. Vérifier le critère de fin : créer un compte, se connecter, voir la page protégée — sur l'URL déployée.

Ni gateway temps réel ni stockage objet ne sont montés au bootstrap : les installer « sans usage métier encore » est exactement ce qu'ARCH-04 interdit. Ils arrivent avec la première slice qui en a besoin.

## Boucle de travail quotidienne

Choisir la slice `ready` du backlog → l'agent écrit `roadmap/plans/S-xxx.plan.md` → répondre « GO S-xxx », en portant les réponses si le plan pose des questions bloquantes (« GO S-xxx · 1a 2b » ou « · défauts ») → exécution → `/preview` si la slice a une surface visible → compte rendu avec ledger (vérifié / fait non vérifié / supposé) + session réelle → backlog et `MEMORY.md` mis à jour → brouillon du plan suivant proposé. Une seule slice en cours à la fois. Toutes les ~5 slices : revue de roadmap et des entrées mémoire expirées.

## Structure

`CLAUDE.md` racine (stack imposée, règles d'or, workflow, routage) · `AGENTS.md` pointeur pour Codex · `docs/` 38 satellites thématiques chargés à la demande · `templates/` PROJECT, plan de slice, ADR, backlog, README de module, et **`scaffold/`** les fichiers de configuration livrés (BOOT-09) · `.claude/` permissions, hook de garde et commandes (`/harness` pour les lister, `/start-project`, `/plan S-xxx`, `/ship`, `/preview`, `/review-roadmap`, `/new-module`, `/memory-review`, `/eval-routing`, `/harness-upgrade`) · `evals/` tests du référentiel et du hook · `HARNESS_VERSION` + `CHANGELOG.md` (BOOT-08) · `docs/harness-reference.md` (théorie complète du harness, hors routage).

## Le harness a une version

Il est **copié** dans chaque projet : sans marqueur, chaque copie devient un fork silencieux, et une correction doit être re-portée à la main sans savoir où elle l'a déjà été. `HARNESS_VERSION` voyage avec la copie, `ADR-0001` l'enregistre à l'amorçage, `CHANGELOG.md` liste les identifiants de règles touchés par version, et `/harness-upgrade` porte les évolutions **entrée par entrée** — jamais par écrasement, qui effacerait les dérogations décidées en ADR. C'est ce qui distingue un actif durable d'un instantané (BOOT-08).

## Garde-fous outillés

Deux mécanismes, livrés actifs : les permissions de `.claude/settings.json` (deny sur la suppression de racine/home, `git push -f` et l'accès `.env` ; ask sur push, `curl`/`wget`, migrations, `docker compose down`, ssh) et le hook `PreToolUse` `.claude/hooks/guard-bash.mjs`, écrit en Node pour rester portable Windows/macOS/Linux. Le force push relève du hook seul : le matching des permissions est un préfixe, il ne sait pas distinguer `--force` de `--force-with-lease` (ENV-06).

**Ce qu'ils ne sont pas** : un bac à sable. Les deux reposent sur une inspection de chaîne de caractères, contournable par composition ou encodage. Ils attrapent l'accident, pas l'adversaire. Le hook produit aussi des faux positifs assumés, et l'`ask` réseau ne couvre que `curl` et `wget` — pas `pnpm dlx`, `npx` ni `git fetch`. Le confinement réel de ce harness tient à trois choses — travail dans un dépôt versionné, état committé en fin de slice, contenu externe jamais traité comme une instruction (SEC-08). Voir ENV-06 et SEC-09.

## Choisir où placer une règle

Cinq surfaces, un seul critère : **qui décide du chargement** (DOC-09). Racine = toujours chargé. Satellite = table de routage, déterministe. Commande = invocation humaine explicite. Skill = décision du modèle, probabiliste. Hook/lint = machine, non contournable. Une règle qui existe pour corriger le jugement du modèle ne peut pas dépendre du jugement du modèle — c'est pourquoi ce référentiel n'utilise aucune skill. Et une règle ne vit jamais sur deux surfaces à la fois (DOC-10).

## Documentation produit : modules, règles, offre

Le référentiel `docs/` porte les normes d'ingénierie ; la connaissance **produit** vit ailleurs, selon trois destinations arbitrées par `DOC-11` :

- **Règle d'une capacité** → sous-document du module, `modules/<module>/docs/<capacité>.md`
- **Invariant valant pour tout le module** → §3 du README du module
- **Règle transverse** (essai, rétention, quotas inter-modules) → section `Règles transverses` de `PROJECT.md`

Un README de module est une **racine locale** : au-delà de ~150 lignes hors table, ou de quatre capacités distinctes, il se scinde et porte sa propre table de routage vers ses sous-documents (DOC-13/DOC-14). C'est le motif de `CLAUDE.md` §5 appliqué un niveau plus bas — le routage est récursif (HRN-KNOW-011). Un module naît avec son README seul : la scission est délibérée, jamais anticipée. Les règles métier s'identifient en minuscules à trois segments (`billing.proration.3`) pour ne jamais collisionner avec les règles du harness (DOC-15).

L'**offre commerciale** est du code : `packages/catalog` définit plans, entitlements, limites et états, et toute surface — page pricing, écran d'upgrade, contrôles d'accès — en dérive. Les montants restent chez Stripe : changer un prix ne doit jamais exiger un déploiement. Un plan ne se supprime pas, il passe `privé` puis `déprécié` (CAT-06).

## Tester sans terminal — `/preview`

`/preview` lance l'infra et les apps **en processus détachés** (`pnpm dev` bloquerait la session), attend qu'elles répondent, puis rend un panneau : URLs ouvrables d'un clic, comptes de test avec leurs rôles et états, cartes Stripe de test, accès Mailpit et MinIO, points à vérifier dérivés de la DoD de la slice en cours — et, en clôture, la commande à envoyer si tout est conforme plus le sujet de la prochaine slice. Appelable à n'importe quel moment.

Les identifiants sont affichés en clair, et c'est sans danger **parce que** le lanceur refuse de démarrer si `APP_ENV` n'est pas local (ENV-08). Sans ce garde, la même matrice serait une faille. Source de vérité unique : le module `personas` des seeds — jamais recopié ailleurs (ENV-07, DOC-10).

Deux limites assumées. L'agent ne voit pas l'écran : il produit le panneau et s'arrête, le verdict est humain (V5) et lui seul autorise le passage en « vérifié ». Et les URLs sont en `localhost` : le navigateur doit tourner sur la même machine que la stack.

## Questions bloquantes

Une inconnue qui se matérialise en données persistées, détermine un droit, porte sur de l'argent ou un délai, ou exigerait une migration pour être infirmée, est **bloquante** (PROG-15) : l'agent DOIT en faire une question, jamais une hypothèse posée, et elle ne compte pas dans le plafond de 3 questions. Elle remonte en tête du plan au format fermé avec défaut proposé — cinq secondes pour répondre « défauts », mais la décision métier reste la tienne et elle est datée.

Sans cette règle, G-01 se contourne par écrit : l'agent assume proprement, tu approuves d'un GO nu, le code est irréprochable et la règle métier est fausse. Ça ne se voit pas dans un diff, ça se découvre en migration de données. En pratique la plupart des slices n'en portent aucune, et rien ne ralentit.

## Tester le référentiel

Les documents gouvernent le comportement de l'agent : les modifier sans vérification revient à pousser du code sans test. Deux niveaux, dimensionnés pour un solo.

- **Éval de routage** — `/eval-routing` ou `node evals/run.mjs`. Un seul appel modèle, 27 cas, moins d'une minute, aucune dépendance à installer. Vérifie que la table §5 désigne les bons satellites et respecte ses exclusions. À lancer **uniquement** avant de merger une PR qui touche `CLAUDE.md` §5 ou un satellite — jamais dans la boucle quotidienne.
- **Tests du hook** — `node evals/guard-bash.test.mjs`. 26 cas, instantané, aucun appel modèle : le garde-fou est du code, il se teste comme du code. À lancer après toute modification de `.claude/hooks/guard-bash.mjs`.
- **Canaris** — `evals/canaries.md`, cinq comportements non routables (refus d'inventer une règle, gate de plan, honnêteté du ledger, contenu externe, changement de stratégie). Oracle humain, dix minutes, au changement de modèle.

Le corpus s'enrichit tout seul : chaque écart constaté en revue devient un cas au moment du `/ship` (EVAL-05). Ce que ça ne prouve pas : que l'agent *applique* les règles une fois chargées — seulement qu'il charge les bonnes (EVAL-06).

## Entretien du harness

Les documents sont du code : toute évolution passe par PR. Statuts datés à surveiller : `docs/geo.md` (llms.txt, mi-2026) et la table de correspondance tiers → modèles de `docs/program.md` (PROG-12), à revoir à chaque génération de modèles. Les seuils (12 questions, 100 lignes de mémoire, 5 slices par revue) sont des points de départ à recalibrer à l'usage.

## Révisions

**Cette version** — documentation produit : arbitrage de destination des règles (DOC-11), module propriétaire d'une capacité transverse (DOC-12), budget et scission des README de module avec routage local (DOC-13/DOC-14), convention d'identifiants métier (DOC-15), `templates/module.README.md`, routage récursif (HRN-KNOW-011) ; catalogue commercial exécutable `docs/catalog.md` + `packages/catalog` (CAT-01→08), `PROJECT.md` doté des sections Carte des modules, Règles transverses et Offre commerciale ; `/preview` : lanceur détaché `scripts/preview.mjs`, `preview.config.mjs`, matrice de personas multi-organisations avec états de facturation (ENV-07), garde d'environnement (ENV-08), oracle V3/V5 et suite à donner (PROG-18) ; questions bloquantes : classement des inconnues par conséquence (PROG-15), format fermé en tête de plan (PROG-16), promotion en mémoire des réponses (PROG-17), rayon d'impact obligatoire sur tout « supposé » (G-18), G-01 et §6.2 resserrés, canari C-01 rendu binaire (HRN-TASK-006, HRN-INTAKE-008, HRN-DLV-006) ; suite d'évals du référentiel : `evals/` (routage machine + canaris humains), commande `/eval-routing`, satellite `docs/evals.md`, dépôt de cas au `/ship` (EVAL-01→07, HRN-EVAL-008/009/010) ; `docs/i18n.md` ajouté (l'i18n était imposée au §0 sans satellite) ; SEC-08/SEC-09 (contenu externe = donnée, jamais instruction ; portée réelle du confinement) ; DOC-09/DOC-10 (choix de surface, une règle une surface) ; PROG-12 exprimé en tiers plutôt qu'en noms de modèles, avec table de correspondance datée ; PROG-13 (les artefacts qui font office de journal) ; PROG-14 (budget de slice) ; session réelle enregistrée à la livraison ; `.claude/settings.json` durci + hook de garde ; journal de vérification dans le plan de slice ; `harness-reference.md` v1.2 (HRN-KNOW-009/010, HRN-INFRA-010, invariants en deux paliers).
