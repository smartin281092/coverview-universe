# Wallet — coquille cliente

## Résumé

Première interface de Wallet : navigation, état vide et disponibilité réelle du socle. Français dès le départ, textes externalisés dans `src/locales/fr/common.json`.

## Périmètre

`/` affiche une coquille sans contrat, analyse ni document. `/preview` présente les personas fictives renvoyées par le backend local ; une sélection radio ne change que l’affichage de cette page. `/states` montre les primitives d’états. Les deux dernières routes sont réservées à `import.meta.env.DEV`. Les liens ouvrent une autre page et aucun contenu hors FAQ ne se déplie (FRONT-14).

## Règles métier et invariants

Aucune règle métier, aucun identifiant de base ni secret frontend. Le réseau passe par `@coverview/api-client` ; les réponses sont validées par ses schémas. Source canonique : [API platform](../api/src/platform/README.md). TanStack Query conserve santé/personas fraîches 15 secondes, libère le cache inutilisé après une minute, relit au retour de focus et ne relance pas automatiquement les erreurs. Le bouton de retry montre l’action en cours et empêche les doubles clics. Aucun événement, mutation, job ni stockage local.

## Permissions

Aucune authentification réelle dans S-000a. Le profil fictif ne constitue ni une session ni un droit ; le serveur reste seul responsable de l’exposition locale des données. La connexion WorkOS `coverview` appartient à S-000b.

## État réel

Code de coquille livré ; aucune fonctionnalité métier présentée comme active. Les tests et la preuve navigateur sont consignés dans le ledger S-000a. Les exemples de refus/expiration sont explicitement marqués comme exemples locaux.

## Développement et dépendances

`pnpm --filter client dev` écoute uniquement sur `127.0.0.1:4101` avec port strict. `build` produit le bundle Vite ; `typecheck` vérifie TypeScript strict. `VITE_API_URL` est une URL publique optionnelle : par défaut `http://127.0.0.1:4100` en développement, origine de la page en build. Un déploiement avec API séparée doit fournir son origine explicite ; aucun déploiement n’est réalisé ici.

Stack imposée : React/Vite, TanStack Router (routes par code), TanStack Query (server state), i18next/react-i18next (catalogues), Tailwind et [UI shadcn partagée](../../packages/ui/README.md). Les packages directs ont des licences MIT, sauf Lucide ISC. Aucun store global ni bibliothèque de formulaires ajouté sans formulaire réel.

Sources officielles consultées : [TanStack Router](https://tanstack.com/router/latest/docs/framework/react), [Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [shadcn CLI](https://ui.shadcn.com/docs/cli). Versions stables résolues via le registre npm le 2026-09-05, fixées dans le lockfile par l’installation racine.
