# Wallet du 20 octobre 2026 — Actions, barre du bas et suivi des demandes

Entrée : deux demandes de l’utilisateur du 20 octobre 2026, avec mise en production autorisée.

1. « Dans Wallet : enlever le bouton compte de la barre du haut et remplace Offres dans la barre de navigation du bas par Demandes. Je ne vois rien dans Actions (ça dit Action indisponible), compte utilisé : sebastien@coverview.ch. Dans Actions, remplace les tabs par le même système de Tabs que pour la page d’un contrat. Dans la page /insurance-requests/inq_..., déplacer le bouton Toutes les demandes au-dessus du titre et le mettre en bouton ghost bleu bold (comme ailleurs dans l’app), enlève l’id en dessus de ce même bouton et ajoute l’image du produit d’assurance maladie dans la box de listing des demandes et vers la ligne correspondant au produit dans la page de suivi de la demande et enlève les boutons Ouvrir le profil et le bouton du dessous de cette même page de suivi de demandes. »
2. « Modifier le titre par le nom de la demande (Par exemple : assurance maladie 2027) et enlever le sous titre. Ajouter sous le titre 2 boutons pour : Ajouter pièce d’identité (si pas déjà enregistré dans les documents) avec un petit check entouré vert si c’est ok et un autre pour ajouter le contrat d’assurance maladie précédant de 2026 (ou un bouton pour dire qu’il n’en a pas). »

Mandat PROG-23. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| W-1 | Pourquoi « Action indisponible » ? | Les routes du centre d’action n’étaient enregistrées qu’avec les documents, fermés en production. Elles le sont désormais sans eux : profils, procurations et demandes aux compagnies viennent de la base. | `document-intelligence/index.ts`, tests action-center 19/19 |
| W-2 | Barre du bas sur téléphone ? | Profil, Documents, Demandes, Actions. Offres reste dans le menu. | Demande 1 |
| W-3 | Onglets d’Actions ? | Composant partagé `LineTabsList` de la page d’offre : piste grise, soulignement coloré par onglet. | Demande 1 |
| W-4 | Boutons retirés de la page de suivi ? | « Ouvrir le profil » et « Demander un accompagnement » quittent Wallet ; la route API d’accompagnement reste. | Demande 1 |
| W-5 | Nom de la demande ? | « Assurance maladie {année des primes} », enregistrée à la soumission (`year`, 0084). Le défaut 2027 décrit exactement l’existant, seule année du comparateur. Même nom dans la liste. | `healthYear` n’a jamais valu autre chose que 2027 (git) |
| W-6 | Boutons pour qui ? | Chaque personne dont le compte possède le dossier ; son nom s’affiche dès deux personnes. Seulement pendant le traitement (`submitted` à `offer_ready`). | Pièces par personne |
| W-7 | « Pièce d’identité enregistrée » ? | La pièce jointe d’identité du dossier de la personne, celle du profil et des procurations. Coche verte quand elle est prête ; le même sélecteur permet de l’ajouter ou la modifier. | `identity-attachment` existant |
| W-8 | Contrat de l’année précédente ? | Un document du dossier de la personne cité par la demande, ou la déclaration « Je n’ai pas de contrat 2026 ». « Modifier » retire la réponse. Le serveur vérifie le propriétaire du dossier et le document (même compte, même dossier, ni supprimé ni en quarantaine). | Test PostgreSQL réel |
| W-9 | Documents fermés en production ? | Boutons de dépôt désactivés avec une explication ; « Je n’ai pas de contrat » fonctionne. Ouverture des documents en production : question à l’utilisateur. | `DOCUMENTS_ENABLED=false` en production |

## Definition of Done — oracles

- [x] API : réponses par personne, propriétaire seul, états, document du bon dossier, concurrence, rejeu — V2 (journal 2).
- [x] Types, lint, frontières, tests unitaires Wallet, Admin et client API — V0/V2 (journal 3).
- [x] Builds Wallet et site avec réglages de production — V1 (journal 4).
- [x] Suite API complète sur la release — V2 (journal 6).
- [x] Production c55468b : sauvegarde, migration 0084, routes et bundles servis — V3 sans session (journal 7).
- [ ] Page authentifiée dans le navigateur — impossible en local sans connexion WorkOS réelle (journal 5) ; V5 du titulaire en production.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Lot 1 (787b2a2) | tests action-center et serveur, vitest Wallet, `tsc`, ESLint | 19/19 API, 26/26 Wallet ; types et lint verts | — |
| 2 | Contrat N-1 | `insurance-requests.test.ts` (Testcontainers) | 17/17, dont refus d’un tiers, d’une personne inconnue, d’un brouillon, d’un document d’un autre dossier ou en quarantaine ; rejeu sans effet ; réponses concurrentes conservées ; 409 après clôture ; garde HTTP CSRF et session | — |
| 3 | Statique | `tsc` (contracts, api-client, api, client, admin, www), ESLint, dependency-cruiser, vitest Wallet/Admin/api-client | verts ; 26, 7 et 17 tests | — |
| 4 | Builds | Vite (Wallet), Astro (www) | Wallet construit, 167 images produits ; site 45 pages, 167 images | — |
| 5 | Page Wallet locale | session fictive en base locale | refusée par l’API (503) : chaque session est confirmée auprès de WorkOS ; session révoquée, aucune connexion faite à la place du titulaire | V5 en production |
| 6 | Suite API | vitest complet, worktree figé sur c55468b | 83 fichiers, 799/799 | — |
| 7 | Production | images construites sur le serveur ; sauvegarde `20261021T0959Z-before-c55468b` (19 354 877 octets) et copie chiffrée age (19 359 797) ; bascule, 85 migrations | conteneurs sains ; `/health` 200 ; `/action-center/summary` 401 au lieu de 404 ; `previous-contract` 403 sans cookie ; `identity-attachment` 404 `PLATFORM_NOT_FOUND` (documents fermés, boutons de dépôt désactivés) ; demande du titulaire en `year` 2027, sans réponse ; bundles Wallet et site servent le nouveau code ; aucune erreur API | V5 du titulaire |
| 8 | Wallet connecté | navigateur intégré | aucune session de production ; aucune connexion faite à la place du titulaire | V5 du titulaire |

## Suite du 25 octobre 2026 — suivi d’une demande en deux colonnes

Entrée : « Dans Wallet : suivi d’une demande : quand l’espace en largeur le permet (typiquement PC voir tablette, mettre la section du produit sur la droite des etapes d’acheminement/réalisation de la demande. »

| ref | question | answer | evidence |
|---|---|---|---|
| W-10 | Produits à droite des étapes ? | Dès 768 px (tablette en portrait, 688 px de contenu), deux colonnes égales : à gauche les étapes, précédées de « Demande annulée » le cas échéant ; à droite chaque personne avec son produit, puis le total et la mention. Les actions à faire restent au-dessus, sur toute la largeur. Une colonne d’étapes de moins de 440 px met l’animation au-dessus des étapes, comme sur téléphone ; la première personne s’aligne sur la première étape. Sous 768 px, rien ne change. | Demande |

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 9 | Suivi en deux colonnes | page réelle de Wallet dans Chromium avec des réponses d’API simulées (identité et une demande fictive de deux personnes, offres réelles de l’API locale) : aucune session ni donnée réelle, la connexion locale passant par WorkOS (journal 5) ; `tsc`, ESLint, Prettier, vitest Wallet | 1440 et 1024 px : produits à droite, animation à côté des étapes ; 768 px : produits à droite, animation au-dessus des étapes ; 390 px : produits sous les étapes ; ni débordement ni erreur ; 26/26 tests | V5 du titulaire connecté |
| 10 | Production (`0f88672`) | image apps construite sur le serveur, Wallet 200 ([journal de production](deploy-full-2026-10-16.plan.md#journal-de-vérification)) | en ligne ; suivi non ouvert en production, aucune connexion faite à la place du titulaire | V5 du titulaire connecté |
