# Plan — Partner : intégration, activation et fonctions restantes

> Statut : **approuvé** — réponses utilisateur du 4 octobre 2026 : « 1a 2a 3b ». diff_from : [lot 4/4](partner-conclusion-integration.plan.md), interrompu le 4 octobre à 01h30.
> **Session requise** : Claude Code, Claude Opus 5.5, effort max. La reprise quitte la chaîne de relais Codex (décision 1a).
> **Session réelle** : renseignée à chaque livraison.
> **Budget** : plusieurs sessions. Une phase livrée est commitée sur `claude/partner-integration` avant la suivante.

## Décisions acquises (réponses aux questions bloquantes du bilan du 4 octobre)

1. **1a — Reprise et intégration.** Le WIP du worktree Codex `9783` est rapatrié, commité sur une branche dédiée et fusionné avec `D:\Projects`. Plus de relais Codex : le travail continue dans ce dépôt.
2. **2a — Matching.** Le système classe les intervenants à partir des déclarations **validées par l'Admin** (compétences, conventions, langues, zones, disponibilités, capacité, conflits). Il explique chaque proposition. Un humain décide, et tout écart avec la proposition est motivé et tracé. L'appréciation personnelle et la distribution favorable restent des dossiers distincts.
3. **3b — Priorité.** Après l'intégration, les fonctions manquantes passent avant la recette réelle et la simplification UX.

## Objectif

Rendre tout le [brief I–III](../../references/coverview-partner-2026-10-02.md) disponible dans une seule branche intégrée, activée sur la base locale. Les reliquats fonctionnels doivent être codés et vérifiés avant la recette réelle avec l'utilisateur.

## Phases

### A — Sécuriser, fusionner, activer

- [x] Commits de plomberie, sans toucher aux fichiers. Snapshot du 2 octobre (`claude/partner-snapshot-20261002`), chaîne des 17 états de relais (`claude/partner-program`), travail source du 2–3 octobre (`claude/partner-integration`, parents snapshot + `97ce34b`). Arbres comparés à leurs sources : 0 écart.
- [x] Fusion à trois voies sur la base exacte. Seule la métadonnée Drizzle était en conflit : deux migrations 0029.
- [x] Catalogue unifié 0000–0065. Les migrations `drizzle-pending` 0049–0064 sont intégrées à l'octet près. La migration santé devient `0065_bumpy_mentallo` et conserve son horodatage déjà enregistré en base locale. Les 16 tests qui assemblaient un catalogue temporaire migrent désormais le catalogue normal.
- [x] Vérification cumulée. Lint complet vert. Premier passage de la suite complète : 733/744. Huit échecs venaient de deadlocks entre déclencheurs de profil et chemins Partner (corrigés à la source par 0066 et le mappage 409), deux d'attentes figées sur l'état « en attente » (alignées), un d'un bug de configuration préexistant (corrigé, G-07). Second passage : **72/72 fichiers, 744/744 tests**.
- [x] Sauvegarde `pg_dump` (28,5 Mo, `.planning-local/backups/`, ignoré par Git), puis migration de la base locale : 47 → 67 migrations, 28 → 70 tables Partner. 0065 était déjà enregistrée, aucune entrée sautée.
- [x] Avance rapide de `D:\Projects` sur la fusion (`f0a3813`). L'API de preview a rechargé, `/health` répond `ready`. Documents propriétaires mis à jour : les mentions « hors catalogue » sont déclarées historiques.

### C — Fonctions restantes, dans l'ordre

1. **Matching système et réattribution automatique bornée** (I.10.2–10.4, I.11.3, II.9). Classement expliqué depuis les déclarations validées, exclusion des conflits déclarés, départage par choix client, capacité et répartition, rémunération exclue. Écart manuel motivé. Après 24 h sans action utile : proposition au candidat suivant, nombre maximal configuré, puis reprise humaine CoverView.
2. **Profils publics et évaluations** (I.18, I.12) : profil publiable, trois dimensions séparées, note avec période, volume et méthode, prudence à faible volume, contestation, évaluation des apporteurs.
3. **Wallet d'un nouveau client** (I.6.2, scénario 3) : espace préparé, invitation et activation encadrées, sans révélation ni consentement implicite. Traitement des emails erronés et des adresses partagées.
4. **Comparaison** (I.13, III.7–10) : catégories de prestations normalisées, proposition automatique du contrat actuel quand l'objet est identifiable (confirmation sinon), orientation initiale automatique distincte de la recommandation finale, spécificités prévoyance.
5. **Pilotage quotidien** (I.7, II.6/10/14) : vues d'équipe et prédéfinies, indicateurs de carte, dashboard Admin complet.
6. **Temps réel et agenda** (III.16, I.12, I.21) : diffusion Partner↔Wallet, rendez-vous conjoint, rentabilité CoverView si ses données existent.
7. **Droits des personnes** (I.20, S-130/S-131) : export, rectification, conservation et suppression contrôlée, cloisonnement en base. Aucune durée légale inventée.
8. **Reliquats** : gestion d'équipe du responsable, restrictions fines et réexamens automatiques (I.4), contrat non déclaré signalé par le client (I.17.2), audit incomplet → demande de complément (I.13).

#### C1 — Conception retenue (avant code)

- **Candidats.** Conseillers approuvés de la catégorie : organisation approuvée, rôle conseiller, réexamen non échu, accès non révoqué. Au plus 100 candidats sont évalués. Le responsable courant est exclu, et pour une réattribution automatique, tous les responsables de la chaîne automatique aussi.
- **Éligibilité (sinon exclu, avec le motif compté).**
  - compétence examinée et valide (`reviewed` ou `limited`) ;
  - convention examinée et valide pour la catégorie ;
  - langue ou canton qui ne diffèrent pas d'un souhait client confirmé ;
  - pas d'absence déclarée en cours ;
  - capacité déclarée différente de « indisponible ».
  - Une donnée manquante reste « à confirmer » : elle n'exclut pas, mais elle classe plus bas et elle est signalée.
- **Classement lexicographique, explicable et sans aucune donnée économique.**
  1. référent confirmé du client pour la catégorie ;
  2. nombre de critères client concordants (langue, zone, mode), puis nombre d'inconnues ;
  3. compétence de catégorie avant compétence limitée ;
  4. disponibilité déclarée dans les 14 jours ;
  5. capacité ouverte, puis au cas par cas ;
  6. charge observée la plus faible ;
  7. moins d'attributions sur 30 jours ;
  8. identifiant, pour un ordre stable.
- **Restitution.** `GET /partner/leads/:id/matching`, réservé à l'Admin avec MFA : rang, critères, raisons et réserves sous forme de clés i18n, compteurs d'exclusion. Aucune donnée privée en texte libre. Sans candidat éligible, aucun « meilleur conseiller » n'est affiché : la file CoverView est proposée.
- **Décision humaine.**
  - La commande `assign` accepte un `matchingBasis` facultatif ; un classement périmé renvoie `409`.
  - Le motif, déjà obligatoire, devient le motif d'écart quand le choix n'est pas le premier éligible.
  - Une décision immuable conserve le classement (10 premiers), les exclusions, le choix, le rang et l'indicateur d'écart.
- **Réattribution automatique bornée.** La politique de continuité ajoute `automaticReassignments` (0–3, défaut 1). À l'échéance non justifiée, ou après perte d'habilitation, le worker propose le dossier au premier éligible si le quota n'est pas atteint depuis la dernière décision humaine. Le candidat doit accepter : c'est la décision humaine de l'intervenant. Sinon, reprise humaine CoverView comme aujourd'hui. Décision de type `automatic` et notifications existantes.

#### C2 — Conception retenue (avant code)

- **Profil publiable par version.**
  - Présentation libre bornée et photo facultative ; la photo passe par le circuit documentaire des preuves professionnelles (antivirus, finalité `partner_profile_photo`, images seulement).
  - Le reste vient des sources déjà validées : spécialités (compétences examinées), langues et cantons (pratique déclarée), modes de rendez-vous.
  - Soumission par le membre, examen Admin avec MFA (publication ou refus motivé), historique immuable. Une modification crée une nouvelle version à examiner ; la version publiée précédente reste affichée jusque-là.
- **Évaluations calculées à la lecture, en trois dimensions séparées.**
  - Expérience client : notes 1 à 5 des enquêtes de fin de demande, attribuées au responsable au moment de la clôture par une table d'attribution que remplit un déclencheur.
  - Qualité opérationnelle : prise en charge dans le délai, réclamations examinées, suivi documenté.
  - Fiabilité économique : dossiers, contestations, reprises du lot 2.
  - Période glissante de 12 mois, volume et méthode affichés. La note publique n'apparaît qu'à partir de 5 avis ; sinon « pas encore assez d'avis ». Une conversion n'est jamais comptée comme qualité.
- **Audiences.** Profil publié et note publique : Wallet (interlocuteur, propositions), membres Partner, Admin. Dimensions internes : la personne elle-même (droit d'accès, R5) et l'Admin ; la fiabilité économique est réservée à cette personne et à l'Admin.
- **Contestation.** La personne conteste un élément précis (enquête, réclamation) avec un motif. L'Admin accepte ou refuse avec un motif. Un élément accepté sort du calcul, avec trace.
- **Apporteurs.** Évaluation interne pour l'Admin : demandes transmises, doublons et demandes invalides, autorisation de transmission, écarts entre besoin annoncé et réalité constatée.

### B — Recette réelle et simplification (après C)

Les 33 scénarios I.23 se déroulent avec de vrais comptes WorkOS : candidat, Admin avec MFA, conseiller, apporteur, client Wallet. Revue produit critique, mobile et clavier. Cette phase exige la présence de l'utilisateur.

## Definition of Done — oracles

- [ ] A : typecheck des 8 espaces, `drizzle-kit generate` sans écart, lint et tests complets verts, base locale migrée, `D:\Projects` sur la branche intégrée. V0–V2 et V1 migration.
- [ ] Chaque item C : contrats Zod, API avec autorisation serveur, SDK et UI Partner/Wallet/Admin concernées. Tests PostgreSQL des invariants de droits, d'isolation, de concurrence et d'idempotence. Document propriétaire et couverture mis à jour. V0–V2.
- [ ] B : scénarios I.23 observés en réel. V3, puis revue humaine V5.
- [ ] Ledger sans élément critique « supposé » ; brief, S-110 et S-042a fermés seulement sur preuve réelle.

## Périmètre

- Modules : `partner-workspace` (propriétaire), `identity`, `profiles`, `document-intelligence`, `authorizations`, `insurance-requests`, `health-insurance` en lecture. Apps : `api`, `partners`, `client`, `admin`.
- Permissions : réemploi des politiques Partner existantes (aucun accès par organisation seule, email ou commission). Admin global sous MFA.
- Données : migrations additives à partir de 0066, générées depuis le catalogue normal. Une seconde génération doit sortir sans écart.
- Événements et jobs : bus et outbox existants. BullMQ pour l'escalade 24 h. Pas de nouveau broker.

## Satellites à charger

architecture, backend, api, contracts, data, permissions, security, testing, frontend, design, i18n, events, jobs, realtime (item 6), email (item 3), conventions. Exclusions : marketing-web, seo, geo, billing.

## Hypothèses réversibles

- Les déclarations validées par l'Admin suffisent à l'éligibilité du matching (décision 2a). Rayon d'impact : le module de matching seul, pas les dossiers existants.
- Pas de fournisseur email ou SMS de production : Mailpit en local. Rayon d'impact : l'adaptateur d'envoi.

## Journal de vérification

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
| 1 | Migration locale | `db:migrate` via pnpm | Échec masqué par le CLI ; base inchangée (transaction) | Diagnostic : la maintenance exige `AUTH_ENABLED=false` |
| 2 | Migration locale | tsx depuis la racine | Module tsx introuvable à la racine | Changement de stratégie : binaire local `apps/api` ; troisième essai réussi |

## Risques et mitigations

- Complexité existante (~25 700 lignes de module, 65 composants Partner) → réemployer les structures acquises. Aucun dossier préparatoire supplémentaire sans parcours utilisable.
- Base locale partagée → sauvegarde `pg_dump` avant chaque migration, migrations additives uniquement.
- Preview utilisateur active depuis `D:\Projects` → fusion et vérification dans `D:\Projects\coverview-astra-integration`, une seule avance rapide à la fin de A.

## Hors périmètre ou dépendances externes

URL Google réelle, fournisseurs email/SMS de production, téléphonie et enregistrement automatique, signature qualifiée si les compagnies l'exigent, durées légales et analyse d'impact, référentiel vérifié des compagnies et produits, déploiement.
