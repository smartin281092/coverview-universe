# UI partagée

## Résumé

Primitives de présentation consommées par Wallet et l’espace équipe. Le site `www` utilise seulement les assets et tokens de marque, sans dépendance à ce package.

## Périmètre

Bouton, skeleton et états chargement, vide, erreur avec retry, accès refusé, introuvable et session expirée. Les libellés sont injectés par les catalogues i18next de chaque application. Aucun accès réseau, store ou page applicative dans ce package.

## Règles métier et invariants

Aucune règle métier. Les composants `Button` et `Skeleton` proviennent de `pnpm dlx shadcn@latest add button skeleton --yes`. Les deux projets Vite de préparation ont exécuté avec succès `pnpm dlx shadcn@latest apply --preset b38oXC5rf --yes` le 2026-09-05. Le suffixe `--yes` répond à la confirmation du mandat ; le preset reste celui de DSN-01.

Configuration obtenue : Radix Mira, Geist, Lucide, rayon par défaut, menus inverted-translucent/subtle. Les couleurs Mist et le thème sombre générés sont retirés au profit de l’import canonique `assets/brand/tokens.css` (BRD-03). Police, rayons et structure Mira sont conservés. Adaptations accessibles du bouton : focus opaque avec décalage, survol primaire via le token de marque et bordure de contrôle renforcée (BRD-02).

Les composants générés sont renommés en PascalCase selon CONV-01. Le fichier de réexport `utils.ts` généré par la CLI est inutile et n’est pas livré (ARCH-09) ; la CLI utilise directement le package officiel `cn`. Les dossiers de préparation `.preset-work/` sont ignorés et ne participent à aucun build.

## Permissions

Aucune autorisation décidée par l’UI. Un état « accès refusé » affiche une décision du consommateur ; il ne l’applique jamais à la place du serveur.

## État réel

Preset exécuté sur les deux coquilles et composants générés. Build, types et rendu vérifiés par les oracles consignés dans [le ledger S-000a](../../roadmap/evidence/S-000a.md).

## Dépendances et provenance

Les packages `shadcn` (CSS Mira), `radix-ui` (composition accessible), `class-variance-authority`, `cn`, `lucide-react` et `tw-animate-css` sont ceux ajoutés par la CLI officielle. `cn` provient de `shadcn-ui/cn`, pas d’un homonyme. Licences MIT/Apache-2.0/ISC ; l’audit d’installation est géré à la racine. Geist est auto-hébergée via Fontsource et conserve sa licence de police **OFL-1.1**, signalée car hors allowlist de licences de code DEP-01 ; elle est explicitement requise par le preset.

Sources officielles consultées le 2026-09-05 : [shadcn apply](https://ui.shadcn.com/docs/cli#apply), [preset](https://ui.shadcn.com/docs/cli#preset), métadonnées `latest` du registre npm. Les versions exécutables sont celles du manifeste et du lockfile, sans seconde liste documentaire.
