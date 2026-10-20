# Accès Admin du 20 octobre 2026 — premier administrateur et pages visibles

Entrée : demande de l’utilisateur du 20 octobre 2026 : « Dans Admin quand je me connecte avec mon compte Google sebastien@coverview.ch je n’ai accès à aucune page bien que j’ai configuré mon app authenticator. Aussi, si je ne suis pas connecté je ne dois pas voir les différentes pages de l’admin dans le menu (juste avoir Site public comme lien) et pareil un utilisateur ne doit jamais voir une page à laquelle il n’a pas accès. » Mandat PROG-23. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| A-1 | Pourquoi aucune page ? | Le compte n’avait pas la permission `administration.access`, que rien n’attribue d’office (`identity.admin.1`). Attribution tracée en production : [trace](../evidence/production-admin-grant-2026-10-20.md). | Base de production lue avant mutation |
| A-2 | Menu sans connexion ? | Aucun lien d’Admin : seulement « Site public ». | Demande explicite |
| A-3 | Menu connecté sans permission ? | « Mon accès Admin » (sa propre page, qui dit ce qui lui manque) et « Site public » ; aucune page d’Admin. | « Jamais une page à laquelle il n’a pas accès » |
| A-4 | Permission sans vérification MFA récente ? | Même menu qu’A-3 ; une page d’Admin ouverte par son adresse mène à la vérification. | Accès réel seulement après le challenge distinct |
| A-5 | Page d’Admin ouverte par son adresse sans accès ? | Jamais affichée : retour à l’accès de la personne (ou à la vérification, A-4). Les routes de l’API restent refusées côté serveur (G-02) ; le menu ne fait que masquer. | Défense en profondeur |
| A-6 | Partner et Wallet ? | Inchangés : leur menu n’apparaît déjà qu’une fois connecté. | Lecture des deux coquilles |

## Definition of Done — oracles

- [x] Attribution en production : une ligne, préconditions contrôlées — trace.
- [x] Règle d’accès des pages — V2 (tests unitaires) (journal 2).
- [x] Admin non connecté : menu réduit, page d’Admin redirigée — V3 (navigateur intégré) (journal 3).
- [ ] Admin connecté avec et sans vérification — V5 (titulaire, après mise en production).

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Attribution | lecture de la base de production, puis transaction contrôlée | compte, identité WorkOS, email, session active et Authenticator confirmés ; `iap_ba8a4930-1382-470a-ad65-0331008ec83a` à 16:09:49 UTC | challenge MFA par le titulaire |
| 2 | Règle d’accès | `admin-access.test.ts`, `tsc`, ESLint | 7/7 tests Admin ; types et lint verts | — |
| 3 | Admin non connecté | navigateur intégré, preview locale | `/users` ramené à `/` ; en-tête : logo et « Site public » seulement, aucun lien de navigation ; page de connexion affichée | états connectés en V5 après mise en production |
