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
- [ ] Vérification cumulée : lint complet et suite de tests complète.
- [ ] Sauvegarde puis migration de la base locale (0046→0064 attendues, 0065 déjà enregistrée).
- [ ] Avance rapide de `D:\Projects` sur la fusion. Documents propriétaires mis à jour : plus de mention « hors catalogue ».

### C — Fonctions restantes, dans l'ordre

1. **Matching système et réattribution automatique bornée** (I.10.2–10.4, I.11.3, II.9). Classement expliqué depuis les déclarations validées, exclusion des conflits déclarés, départage par choix client, capacité et répartition, rémunération exclue. Écart manuel motivé. Après 24 h sans action utile : proposition au candidat suivant, nombre maximal configuré, puis reprise humaine CoverView.
2. **Profils publics et évaluations** (I.18, I.12) : profil publiable, trois dimensions séparées, note avec période, volume et méthode, prudence à faible volume, contestation, évaluation des apporteurs.
3. **Wallet d'un nouveau client** (I.6.2, scénario 3) : espace préparé, invitation et activation encadrées, sans révélation ni consentement implicite. Traitement des emails erronés et des adresses partagées.
4. **Comparaison** (I.13, III.7–10) : catégories de prestations normalisées, proposition automatique du contrat actuel quand l'objet est identifiable (confirmation sinon), orientation initiale automatique distincte de la recommandation finale, spécificités prévoyance.
5. **Pilotage quotidien** (I.7, II.6/10/14) : vues d'équipe et prédéfinies, indicateurs de carte, dashboard Admin complet.
6. **Temps réel et agenda** (III.16, I.12, I.21) : diffusion Partner↔Wallet, rendez-vous conjoint, rentabilité CoverView si ses données existent.
7. **Droits des personnes** (I.20, S-130/S-131) : export, rectification, conservation et suppression contrôlée, cloisonnement en base. Aucune durée légale inventée.
8. **Reliquats** : gestion d'équipe du responsable, restrictions fines et réexamens automatiques (I.4), contrat non déclaré signalé par le client (I.17.2), audit incomplet → demande de complément (I.13).

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
|   |       |        |         |          |

## Risques et mitigations

- Complexité existante (~25 700 lignes de module, 65 composants Partner) → réemployer les structures acquises. Aucun dossier préparatoire supplémentaire sans parcours utilisable.
- Base locale partagée → sauvegarde `pg_dump` avant chaque migration, migrations additives uniquement.
- Preview utilisateur active depuis `D:\Projects` → fusion et vérification dans `D:\Projects\coverview-astra-integration`, une seule avance rapide à la fin de A.

## Hors périmètre ou dépendances externes

URL Google réelle, fournisseurs email/SMS de production, téléphonie et enregistrement automatique, signature qualifiée si les compagnies l'exigent, durées légales et analyse d'impact, référentiel vérifié des compagnies et produits, déploiement.
