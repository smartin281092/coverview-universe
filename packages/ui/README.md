# Système de présentation CoverView

## Résumé

Source commune des tokens et primitives de présentation de Wallet, de l’espace équipe et du site Astro. [ADR-0008](../../adr/0008-shadcn-geist-montech.md) gouverne le preset shadcn et les fontes Geist/Montech. La composition ouverte d’[ADR-0007](../../adr/0007-xai-design-reference.md) et le partage statique avec Astro d’[ADR-0006](../../adr/0006-marketing-design-system.md) restent applicables.

## Périmètre et consommation

Les trois frontends importent `@coverview/ui/styles.css`, qui branche Tailwind et le thème commun. Dans `apps/www/src/styles/global.css`, la directive `@source "../../../../packages/ui/src"` permet à Astro de compiler les utilitaires des composants partagés. Importer uniquement `theme.css` ne suffit pas à leur rendu complet. Les assets et tokens historiques de `assets/brand` sont conservés mais ne sont plus importés par ce package.

`src/theme.css` charge Geist Variable via Fontsource pour les titres et le corps, ainsi que les OTF locaux MONTECH V.02 Regular et Medium pour les usages auparavant attribués à Geist Mono. L’alias `--cv-font-mono` reste compatible avec les consommateurs ; Montech n’est toutefois pas une fonte à chasse fixe. Les fichiers, graisses 400/500, métadonnées et provenance sont décrits dans le [README Montech](src/fonts/montech/README.md).

Les composants de présentation statique ne contiennent aucun accès réseau ni état métier. Astro peut les rendre côté serveur sans directive `client:*`. Le composant interactif `Sheet`, ajouté pour le menu Wallet, utilise Radix Dialog dans l’application React ; sa gestion du focus ne doit pas être assimilée à une présentation Astro sans hydratation.

| Composant        | Contrat principal                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Container`      | `size="wide"` ou `"reading"`, props div et enfants                                                                    |
| `Section`        | `tone="white"`, `"soft"` ou `"dark"` ; `spacing="normal"` ou `"compact"` ; props section                              |
| `Stack`          | `gap="sm"`, `"md"` ou `"lg"` ; direction verticale/horizontale ; alignement start/center                              |
| `SectionHeading` | `title`, `eyebrow?`, `description?`, `level={1\|2\|3}`, taille display/large/medium, alignement start/center, `id?`   |
| `TextLink`       | Props anchor, enfants, flèche right/up/false                                                                          |
| `ButtonLink`     | Props anchor et mêmes `buttonVariants` que `Button` ; destiné notamment au rendu Astro statique                       |
| `Button`         | Primitive shadcn générée ; composition `asChild` conservée pour les liens TanStack                                     |
| `Card`           | Primitive générée avec ses slots de contenu ; composition `asChild`, aplat clair sans bordure ni ombre                  |
| `Skeleton`       | Primitive générée de chargement, utilisée par les états partagés                                                       |
| `Input`, `Label` | Primitives générées ; valeurs, association accessible et validation restent à la charge du formulaire                  |
| `Sheet` et slots | Panneau modal généré depuis le même preset ; titre et description accessibles, focus Radix, fermeture traduite fournie par le consommateur |
| `Bento`          | Compose `Card` autour d’un `article` ; titre et texte courts, `level={2\|3}`, illustration ou valeur justifiée         |
| `Tabs` et slots | Onglets shadcn/Radix générés avec le même preset ; sélection contrôlée, navigation clavier, contenus associés et libellés fournis par l’application |
| `AccountLayout`  | Titres, explications et liste de repères injectés par l’app ; slot `heading` facultatif pour l’en-tête applicatif ; aucun état d’identité |
| États            | Chargement, vide, erreur avec reprise, refus, introuvable et session expirée ; libellés et actions injectés           |

Les classes de composition `cv-container`, `cv-section`, `cv-heading` et `cv-text-link` restent utilisables dans du HTML Astro lorsque son emplacement de contenu le nécessite. Les actions composent `Button` ou `ButtonLink` pour conserver les variantes communes. `SectionHeading` reçoit l’ID sur le titre pour la relation `aria-labelledby` de la section.

Pour toute nouvelle page à onglets, utiliser la composition `cv-tabbed-page` avec l’en-tête puis le contenu à onglets comme enfants directs : elle conserve 24 px entre la description de page et les onglets, sur toutes les largeurs. `AccountLayout layout="tabs"` applique cette composition et garde les onglets sous le titre sur grand écran. Les groupes d’actions utilisent `flex flex-wrap items-center gap-3` : 12 px entre boutons, avec retour à la ligne selon la largeur disponible.

Les usages de `--cv-font-mono`, y compris l’utilitaire `font-mono` et les sur-titres de `SectionHeading`, utilisent l’espacement commun `--cv-mono-letter-spacing`. Les H1 applicatifs ont une marge basse de 6 px ; la description de `SectionHeading` n’ajoute plus de marge haute. [Correction et vérifications](../../roadmap/evidence/identity-tabs-heading-spacing.md).

## Règles de présentation et invariants

Une primitive dont le `display` est déclaré hors couche CSS peut primer sur l’utilitaire Tailwind `hidden`. Pour masquer son lien au breakpoint voulu, masquer son conteneur, comme dans le shell Wallet, puis contrôler le rendu. À 320 px, tenir compte de la largeur consommée par une scrollbar classique : un `min-width: 320px` peut provoquer un débordement. [Défauts reproduits et corrections S-013a](../../roadmap/evidence/S-013a.md).

`src/preset.css` conserve les tokens clairs Mist générés ; `src/theme.css` porte les fontes et adaptations communes, et `src/styles.css` leur raccord Tailwind, notamment les rayons du preset. Ces fichiers exécutables font autorité sur les valeurs. Les règles visuelles courantes sont celles d’ADR-0008 ; les sections et états restent ouverts, les cards rares. Un bento n’emballe pas une longue section, un formulaire ou un état vide. Les consommateurs gardent leur hiérarchie sémantique, leurs catalogues, le focus visible et leurs responsabilités d’accessibilité.

## Permissions et données

Aucune règle métier, autorisation, identité, donnée privée, cache ou appel réseau. Les libellés viennent des catalogues i18next des apps ou du contenu public. Un état de refus présente une décision du serveur sans la remplacer.

## Provenance et évolution

La génération du 6 septembre utilise réellement `apply --preset b38oXC5rf --yes`, puis `add button skeleton card input label`, dans `.planning-local/preset-shadcn`. Les composants intégrés proviennent de cette sortie, avec les adaptations décrites dans ADR-0008 ; Radix et la composition `asChild` sont conservés. [preset-provenance.json](preset-provenance.json) consigne ces exécutions, leurs sources générées et l’initialisation précédente ; le ledger S-000a conserve les vérifications de cette première étape.

`shadcn`, `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` et `tw-animate-css` restent les dépendances de ce système ; aucune deuxième bibliothèque UI n’est ajoutée. `@fontsource-variable/geist` remplace les paquets Inter et Geist Mono via pnpm. Montech est fourni par les fichiers locaux documentés ci-dessus. Les manifestes et le lockfile portent les dépendances et leurs versions résolues.

## État réel

`Dialog` et ses slots sont générés par `shadcn add dialog --yes` dans le même projet de preset le 7 septembre. L'import du bouton commun, l'overlay via token et les libellés de fermeture injectés sont les seules adaptations ; source et empreinte dans le fichier de provenance. Le Wallet compose ce dialogue pour les compagnies et corrections du profil, avec boutons accessibles et défilement intérieur sur smartphone. Aucune dépendance ajoutée.

`Select` est généré par `shadcn add select --yes` dans ce même preset. Il remplace les listes natives du Wallet avec focus/clavier Radix et les styles du menu du preset. Les options conservent une cible tactile de 44 px et un espace réservé à la coche ; le viewport reçoit un padding commun. Comme `Sheet`, `SelectContent` accepte `portalContainer` pour garder le menu dans la frontière privée pendant la revalidation d’identité. Les consommateurs associent le label au `SelectTrigger`, contrôlent la valeur et traduisent les options. Source et empreinte sont consignées dans la provenance ; aucune dépendance ajoutée.

Le contrôle du 7 septembre par `shadcn add select --yes --overwrite` retourne une source identique. `shadcn preset decode b38oXC5rf` confirme le menu `inverted-translucent`, Mist, l’accent subtil et le rayon par défaut. La palette sombre nécessaire à la classe `dark` du menu avait été omise lors de l’intégration des seuls tokens clairs. `src/preset.css` reprend désormais les tokens sombres officiels utilisés par `[data-slot="select-content"].dark`, sans activer un thème sombre sur les autres surfaces. Transparence à 70 %, flou, rayons, focus clair et coche à droite restent ceux du composant généré. La [documentation officielle Select](https://ui.shadcn.com/docs/components/radix/select) distingue le placement `item-aligned` par défaut et `popper` au bord du déclencheur ; le placement ne modifie pas cette palette.

`Badge` et `badgeVariants` sont générés par `shadcn add badge --yes` depuis le même preset. Les variantes officielles, dont `secondary`, restent disponibles ; les consommateurs injectent textes et éventuelles classes de composition. Empreinte brute dans la provenance. Aucune dépendance ajoutée : Radix, CVA et `cn` sont déjà présents.

La refonte est locale. Les vérifications et l’inspection des écrans réels sont consignées par la tâche propriétaire dans le [ledger shadcn et typographie](../../roadmap/evidence/shadcn-typography.md). Un typecheck ou le rendu d’un état ne prouve ni une connexion WorkOS, ni une habilitation externe.
