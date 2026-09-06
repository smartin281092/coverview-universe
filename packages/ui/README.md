# Système de présentation CoverView

## Résumé

Source commune des tokens et primitives de présentation de Wallet, de l’espace équipe et du site Astro. La direction actuelle suit [ADR-0006](../../adr/0006-marketing-design-system.md) : blanc, neutres sobres, typographie ample, actions bleues discrètes et sections ouvertes. Les surfaces fermées sont réservées aux bentos courts avec illustration ou chiffre justifié.

## Consommation

Les applications React importent `@coverview/ui/styles.css`, qui branche Tailwind et le thème commun. Astro importe `@coverview/ui/theme.css` : CSS ordinaire, police Geist auto-hébergée, tokens et classes de présentation autonomes. Ce chemin ne nécessite pas Tailwind pour dessiner les composants. Les assets et tokens historiques de `assets/brand` sont conservés mais ne sont plus importés dans les apps par ce package.

Les composants de présentation ne contiennent aucun hook, accès réseau ou référence au navigateur. Astro peut les rendre côté serveur sans directive `client:*`. L’intégration de rendu React appartient à l’application Astro ; une page statique n’exige aucune hydratation.

| Composant | Contrat principal |
|---|---|
| `Container` | `size="wide"` ou `"reading"`, props div et enfants |
| `Section` | `tone="white"`, `"soft"` ou `"dark"` ; `spacing="normal"` ou `"compact"` ; props section |
| `Stack` | `gap="sm"`, `"md"` ou `"lg"` ; direction verticale/horizontale ; alignement start/center |
| `SectionHeading` | `title`, `eyebrow?`, `description?`, `level={1\|2\|3}`, taille display/large/medium, alignement start/center, `id?` |
| `TextLink` | Props anchor, enfants, flèche right/up/false |
| `ButtonLink` | Props anchor et variantes du bouton ; destiné notamment au rendu Astro statique |
| `Button` | Bouton React accessible ; composition `asChild` existante conservée pour les liens TanStack |
| `Bento` | Titre et texte courts ; `illustration` ou `value` doit porter l’objet visuel ; label facultatif |
| `AccountLayout` | Titres, explications et liste de repères injectés par l’app ; aucun état d’identité |
| États | Chargement, vide, erreur avec reprise, refus, introuvable et session expirée ; libellés et actions injectés |

Les mêmes classes `cv-container`, `cv-section`, `cv-heading`, `cv-text-link`, `cv-button` et `cv-bento` sont utilisables dans du HTML Astro lorsque son emplacement de contenu le nécessite. `SectionHeading` reçoit l’ID sur le titre pour la relation `aria-labelledby` de la section.

## Règles de présentation

`src/theme.css` est la source des couleurs, de la typographie et des primitives CSS. Les états sont ouverts, sans fond, bordure ou ombre de card. Un bento n’est jamais l’emballage d’une longue section, d’un formulaire ou d’un état vide. Les boutons conservent une hauteur minimale de 44 px ; le focus visible et la réduction des animations respectent les préférences du navigateur. Les consommateurs conservent leur hiérarchie sémantique, leurs catalogues et leurs responsabilités d’accessibilité.

## Permissions et données

Aucune règle métier, autorisation, identité, donnée privée, cache ou appel réseau. Les libellés viennent des catalogues i18next des apps ou du contenu public. Un état de refus présente une décision du serveur sans la remplacer.

## Provenance et évolution

Le bouton et le skeleton partent des primitives shadcn déjà installées ; Radix et la composition `asChild` sont conservés. Le preset historique exécuté figure dans `preset-provenance.json` et dans le ledger S-000a. ADR-0006 remplace sa direction chromatique et ses conteneurs visuels, sans ajouter une autre bibliothèque.

`shadcn`, `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` et `tw-animate-css` sont les dépendances déjà issues de cette initialisation. Geist via Fontsource conserve sa licence OFL-1.1. Aucun package ajouté pour la refonte ; versions et licences exécutables restent attachées au manifeste et au lockfile.

## État réel

La refonte est locale. Les vérifications et l’inspection des écrans réels sont consignées par la tâche propriétaire dans le journal de reprise. Un typecheck ou le rendu d’un état ne prouve ni une connexion WorkOS, ni une habilitation externe.
