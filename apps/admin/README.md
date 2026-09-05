# Espace équipe — coquille administrateur

## Résumé

Surface indépendante destinée aux équipes CoverView. Cette slice livre uniquement la navigation, un état vide et la disponibilité réelle du socle ; aucun CRM ni dossier opérationnel.

## Périmètre

`/` affiche le socle. `/preview` et `/states` sont des pages de développement : profils fictifs locaux et démonstration explicite des états UI. Les profils viennent de l’API ; leur sélection est un état React local qui ne crée aucune session. Navigation et détails sur des pages séparées, conformément à FRONT-14.

## Règles métier et invariants

Texte français externalisé dans `src/locales/fr/common.json`. Aucun credential PostgreSQL, aucune lecture DB, mutation, room ou job. Réseau via `@coverview/api-client` uniquement. Santé et personas utilisent un cache TanStack Query frais 15 secondes, collecté après une minute, réactualisé au focus, sans retry automatique ; le retry manuel indique son état et empêche les doubles clics. Source canonique : [API platform](../api/src/platform/README.md).

## Permissions

Le nom `admin` n’accorde aucun droit. Aucun rôle administrateur ni session réelle dans S-000a ; WorkOS `coverview` appartient à S-000b. L’API décide seule de l’exposition locale des fixtures. Les routes d’exemples sont désactivées hors build de développement.

## État réel

Code de coquille livré. Les données et états d’exemple portent leur caractère fictif. Vérifications finales : ledger S-000a ; ce README ne remplace ni build ni parcours exécuté.

## Développement et dépendances

`pnpm --filter admin dev` écoute sur `127.0.0.1:4102`, port strict. `build` produit un bundle Vite indépendant ; `typecheck` applique TypeScript strict. `VITE_API_URL` optionnelle : API locale en développement, origine de la page en build. Une API déployée séparément exige sa propre origine explicite.

Stack et provenance partagées avec [Wallet](../client/README.md#développement-et-dépendances) ; composants et preset dans [UI](../../packages/ui/README.md). Les pages, routes, catalogues et état local restent propres à cette application (ARCH-13).
