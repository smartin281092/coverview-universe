# Système de présentation CoverView

## Résumé

Source commune des tokens et primitives de présentation de Wallet, de l’espace équipe et du site Astro. La direction actuelle suit [ADR-0007](../../adr/0007-xai-design-reference.md) et la [référence xAI fournie](../../references/xai-style-reference.md). ADR-0006 conserve la décision de partage statique avec Astro. Les surfaces fermées sont réservées aux bentos courts avec illustration ou chiffre justifié.

## Consommation

Les applications React importent `@coverview/ui/styles.css`, qui branche Tailwind et le thème commun. Astro importe `@coverview/ui/theme.css` : CSS ordinaire, fontes Inter et Geist Mono auto-hébergées, tokens et classes de présentation autonomes. Inter remplace les fontes propriétaires pour le corps et l’affichage éditorial ; Geist Mono est réservé aux métadonnées et contenus techniques. Ce chemin ne nécessite pas Tailwind. Les assets et tokens historiques de `assets/brand` sont conservés mais ne sont plus importés par ce package.

Les composants de présentation ne contiennent aucun hook, accès réseau ou référence au navigateur. Astro peut les rendre côté serveur sans directive `client:*`. L’intégration de rendu React appartient à l’application Astro ; une page statique n’exige aucune hydratation.

| Composant        | Contrat principal                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Container`      | `size="wide"` ou `"reading"`, props div et enfants                                                                    |
| `Section`        | `tone="white"`, `"soft"` ou `"dark"` ; `spacing="normal"` ou `"compact"` ; props section                              |
| `Stack`          | `gap="sm"`, `"md"` ou `"lg"` ; direction verticale/horizontale ; alignement start/center                              |
| `SectionHeading` | `title`, `eyebrow?`, `description?`, `level={1\|2\|3}`, taille display/large/medium, alignement start/center, `id?`   |
| `TextLink`       | Props anchor, enfants, flèche right/up/false                                                                          |
| `ButtonLink`     | Props anchor et variantes du bouton ; destiné notamment au rendu Astro statique                                       |
| `Button`         | Bouton React accessible ; composition `asChild` existante conservée pour les liens TanStack                           |
| `Bento`          | Titre et texte courts ; `level={2\|3}` (défaut 3) ; `illustration` ou `value` porte l’objet visuel ; label facultatif |
| `AccountLayout`  | Titres, explications et liste de repères injectés par l’app ; aucun état d’identité                                   |
| États            | Chargement, vide, erreur avec reprise, refus, introuvable et session expirée ; libellés et actions injectés           |

Les mêmes classes `cv-container`, `cv-section`, `cv-heading`, `cv-text-link`, `cv-button` et `cv-bento` sont utilisables dans du HTML Astro lorsque son emplacement de contenu le nécessite. `SectionHeading` reçoit l’ID sur le titre pour la relation `aria-labelledby` de la section.

## Règles de présentation

`src/theme.css` expose les tokens nommés xAI et les alias shadcn correspondants. Steel porte le petit texte essentiel ; Fog/Pewter restent aux éléments décoratifs ou désaccentués adaptés. Les états sont ouverts, sans fond, bordure ou ombre de card. Un bento n’emballe jamais une longue section, un formulaire ou un état vide. Les boutons principaux mesurent au minimum 44 px ; les variantes compactes de navigation suivent la référence. Focus visible et réduction des animations sont conservés. Les consommateurs gardent leur hiérarchie sémantique, leurs catalogues et leurs responsabilités d’accessibilité.

## Permissions et données

Aucune règle métier, autorisation, identité, donnée privée, cache ou appel réseau. Les libellés viennent des catalogues i18next des apps ou du contenu public. Un état de refus présente une décision du serveur sans la remplacer.

## Provenance et évolution

Le bouton et le skeleton partent des primitives shadcn déjà installées ; Radix et la composition `asChild` sont conservés. Le preset historique exécuté figure dans `preset-provenance.json` et dans le ledger S-000a. ADR-0007 gouverne le rendu actuel, sans ajouter une autre bibliothèque de composants.

`shadcn`, `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` et `tw-animate-css` sont les dépendances déjà issues de cette initialisation. Fontsource Inter et Geist Mono sont ajoutés pour les substitutions autorisées, sous licence OFL-1.1. Installation et lockfile sont gérés par la tâche racine ; versions exécutables et provenance restent attachées à ces artefacts.

## État réel

La refonte est locale. Les vérifications et l’inspection des écrans réels sont consignées par la tâche propriétaire dans le journal de reprise. Un typecheck ou le rendu d’un état ne prouve ni une connexion WorkOS, ni une habilitation externe.
