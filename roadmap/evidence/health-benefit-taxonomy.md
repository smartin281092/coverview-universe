# Prestations supplémentaires uniformisées — recette

Demande utilisateur du 4 octobre 2026, exécutée sous le mandat autonome (`roadmap/execution-policy.md`). Plan : [health-benefit-taxonomy.plan.md](../plans/health-benefit-taxonomy.plan.md). Session réelle : Claude Opus 5.5 (`claude-opus-5-5`), effort max, Claude Code desktop ; recherche web par neuf agents parallèles du même modèle. Branche `claude/health-benefits`, créée depuis `claude/partner-merge` (c6cb640), seule base contenant le comparateur.

## Ledger

- **Vérifié** — recherche : 32 assureurs et 153 modèles couverts, aucun modèle manquant ni mal rattaché (assertions de `health-benefit-research-merge.py`) ; 1014 pages officielles consultées le 4 octobre ; 486 fiches, 11 propositions écartées avec motif. Détail : [review-c.md](../../data/health-insurance/2027/research/review-c.md).
- **Vérifié** — catalogue `catalog_fe98064955579fb8923847f0` : 514 fiches, 40 types, 812 passages, 227 dossiers ; contrat strict et jointures (`recommendation.import.ts --validate`), test sur l’inventaire réel (32/153, contradictions avec dossier).
- **Vérifié** — moteur : `recommendation.test.ts` 45/45 (dont 6 nouveaux cas : synonymes comptés une fois, question limitée aux types offerts et changement de meneur, question non posée si non différenciante, réserve provisoire seulement décisive, faits payants/complémentaires/indépendants/contradictoires/expirés exclus, validation de taxonomie). Module + plateforme PostgreSQL réelle : 74/74 ; client API 17/17.
- **Vérifié** — import réel dans une base locale isolée (conteneur `coverview-health-benefits-pg`, port 55442, clone de la base locale du 4 octobre) ; API (4200) et WWW (4203) du worktree. Statut : 29 types filtrables. Filtre « Téléconsultation sans participation aux coûts » en Vaud région 1 : 106 → 13 modèles. Guide : question des prestations groupée par famille (31 options), sélection de trois types, classement modifié (« Prestations souhaitées · 3 sur 3 »), message de réserve 2027 affiché car décisif, détail par type dans « Pourquoi cette offre ». Fiche modèle : libellé uniforme puis nom commercial (Prestations 4, Club 8 pour Sympany flexhelp24).
- **Vérifié** — mobile 390 px : aucun défilement horizontal de page ; le léger dépassement interne mesuré provient de la liste de résultats existante (pleine largeur), pas des ajouts.
- **Vérifié** — performance locale du calcul : ~0,4–0,5 s pour 106 offres et ~0,7–0,8 s pour 630 offres (optimisation de franchise), après élagage des sondes (96 → 10 scénarios). Catalogue public : 1,72 Mo brut, 273 Ko gzip.
- **Vérifié** — types/lint : `tsc` API, Admin, contrats, client ; `astro check` WWW (0 diagnostic) ; ESLint ciblé ; build WWW (45 pages) ; dependency-cruiser sans erreur.
- **Fait non vérifié** — page Admin : sélecteur `serviceEvidence` et compteur de taxonomie typés, non ouverts dans un navigateur (MFA administrateur requis).
- **Supposé** — une prestation annoncée sur une source officielle consultée après la publication des primes 2027 reflète l’offre 2027 tant qu’elle n’est pas datée autrement. Rayon d’impact : passer `serviceEvidence` à `verified` dans l’Admin (aucun code), les services non datés cessent alors de compter ; les montants n’en dépendent jamais.

## Décisions et dérogations

Décisions du plan appliquées : taxonomie versionnée dans le catalogue `jsonb` (aucune migration, pas de collision avec la migration partenaire 0070 non commitée), question unique `benefit_types` remplaçant la question par catégories quand une taxonomie existe, seuil administrable `serviceEvidence` (`official` par défaut), réserve provisoire seulement si décisive. Aucune dépendance, variable d’environnement, permission, route, événement, room ou job ajouté. Contrats : champs additifs (`benefitTypes`, `insurerTerm`, `serviceEvidence` par défaut, `preferredBenefits` par défaut, `group`/`description` d’option, `benefitTypes` du statut) ; options de question portées de 20 à 80 maximum.

Formatage : les données générées par les scripts (`recommendation-catalog.json`, `operator-*`, `review-c.json`) gardent la sortie `json.dumps` existante, déjà hors Prettier avant ce chantier.

## Hors périmètre signalé (G-07)

- knip échoue sur des fichiers et exports préexistants non touchés : `health.current.audit.ts`, quatre composants WWW (`Closing`, `Faq`, `GuideVisual`, `ResourceVisual`), `scripts/health-packaging-assets.mjs`, doublon `competenceQuerySchema|conventionQuerySchema` de `partner.ts`.
- Le lanceur `pnpm` global du poste pointe vers un binaire 12.3.4 incomplet ; commandes exécutées avec `pnpm.exe` du même paquet.
- La table historique `health_benefits` (88 faits, ancienne API `/models/:id` et filtres hérités) n’est pas réalignée sur la taxonomie.
- Le catalogue public est téléchargé en entier à l’ouverture d’une fiche ; un point d’accès par modèle ou la compression au proxy reste à décider.
- La base clonée `coverview_health_benefits` (conteneur partagé `coverview-s000b-postgres-1`) et le conteneur `coverview-health-benefits-pg` sont conservés ; leur suppression demande une confirmation explicite (G-05).
- Catalogue non importé dans la base locale partagée `coverview_local` : l’API de la session partenaire exécute encore le code antérieur, dont le schéma strict refuserait `benefitTypes`. Import à faire après alignement de ces processus (README, ordre d’activation).

## Limites

Disponibilité locale des réseaux et pharmacies, annexes non publiées et maintien en 2027 des offres non datées restent à confirmer par les assureurs ; aucun message envoyé. Aucun déploiement ni push.
