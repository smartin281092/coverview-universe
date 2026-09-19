# ADR-0008 — Preset shadcn, Geist et Montech

Statut : accepté par instruction explicite utilisateur, 6 septembre 2026.

Évolution du 19 septembre 2026 : [ADR-0009](0009-lausanne.md) remplace Geist par Lausanne. Les décisions restantes ci-dessous sont conservées.

## Contexte

L’utilisateur demande de reprendre le preset shadcn imposé avec ses composants réels, de remplacer Inter par Geist pour les titres et le corps, et Geist Mono par la fonte de son archive Montech V02. Cette décision remplace la typographie, les tokens et les composants de présentation d’[ADR-0007](0007-xai-design-reference.md). Sa composition ouverte issue de la [référence xAI](../references/xai-style-reference.md) reste applicable. Le partage statique avec Astro autorisé par [ADR-0006](0006-marketing-design-system.md) est conservé.

## Décision

Le preset de [DSN-01](../docs/design.md#dsn-01--initialisation-imposée) a été réappliqué dans le projet de génération isolé `.planning-local/preset-shadcn`, puis les primitives `button`, `skeleton`, `card`, `input` et `label` y ont été ajoutées par la CLI shadcn. Leurs sorties alimentent `packages/ui` : tokens Mist et rayons du preset, primitives partagées et adaptations demandées. Le fond reste blanc ; les cards sont rares, en aplat clair, sans bordure ni ombre. Les longues sections restent ouvertes.

`ButtonLink` réutilise les variantes de `Button`. `Bento` compose `Card` autour d’un élément `article`. Les consommateurs utilisent ces primitives communes ; aucune autre bibliothèque de composants n’est introduite.

Geist Variable est auto-hébergée via `@fontsource-variable/geist` pour les titres et le corps. MONTECH V.02 est chargée localement depuis les fichiers OTF Regular et Medium fournis, aux graisses 400 et 500, pour les usages précédemment attribués à Geist Mono. Montech n’est pas une police à chasse fixe : le nom historique de l’alias CSS ne change pas cette propriété. La provenance exacte, les métadonnées et les informations de licence présentes dans l’archive sont documentées dans le [README des fontes Montech](../packages/ui/src/fonts/montech/README.md).

Les trois frontends consomment `@coverview/ui/styles.css`. Astro compile aussi les utilitaires des composants partagés grâce à sa directive `@source` vers les sources UI. Le rendu React de présentation reste statique, sans hydratation ajoutée. Le [README UI](../packages/ui/README.md) décrit les imports et les contrats des composants.

## Alternatives et migration

Conserver les contrôles CSS de la refonte xAI ou ajouter une seconde bibliothèque ne répondrait pas à la demande de réutiliser le preset réel. La migration remplace donc les adaptations précédentes dans le système commun puis dans ses consommateurs. Les paquets Inter et Geist Mono sont remplacés par Geist via pnpm ; Montech reste un asset local. Les versions exécutables et les dépendances résolues vivent dans les manifestes et le lockfile.

## Conséquences

Le changement porte sur la présentation commune de `www`, Wallet et l’espace équipe. Il ne modifie ni les règles métier, ni les données, ni l’identité, ni les permissions, ni la politique de préversion. Il n’autorise aucune publication et ne constitue pas une validation de connexion WorkOS. Le [plan de correction](../roadmap/handoffs/shadcn-typography.md) porte son périmètre ; les résultats de compilation et de lecture du rendu sont consignés séparément par la tâche propriétaire.
