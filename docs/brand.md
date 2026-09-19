# Marque CoverView

> **Direction actuelle** : [ADR-0008](../adr/0008-shadcn-geist-montech.md) gouverne le preset et les composants ; [ADR-0009](../adr/0009-lausanne.md) définit les fontes Lausanne/Montech du système [UI](../packages/ui/README.md). [ADR-0007](../adr/0007-xai-design-reference.md) conserve la composition ouverte de la [référence xAI fournie](../references/xai-style-reference.md). L’autorisation de partager la présentation statique d’ADR-0006 reste acquise. Le reste de ce document conserve l’historique des sources et leurs empreintes, sans imposer leur ancien thème.

État au 5 septembre 2026 : références initialisées ; aucune interface applicative encore réalisée. Les cinq aplats fournis sont la source de marque. Les compléments sémantiques sont une proposition dérivée, explicitement distinguée de cette source. Leur vérification numérique ne vaut pas validation du rendu d'un écran.

## Sources et routage

- [Planche originale copiée sans transformation](../assets/brand/palette-source.png) : image jointe à la demande de l'utilisateur, conservée dans le dépôt pour les sessions suivantes.
- [Tokens et inventaire exécutables](../assets/brand/tokens.json) : origine de chaque couleur, coordonnées d'échantillonnage, alias sémantiques, paires de contraste et empreintes des assets.
- [CSS de référence généré](../assets/brand/tokens.css) : palette claire à intégrer à la première slice UI. Le JSON est la source de ce fichier généré.
- [Initialisation shadcn, DSN-01](design.md#dsn-01--initialisation-imposée) : commande et preset autoritaires. Ce document n'en maintient pas une seconde copie.
- [Interactions et accessibilité](frontend.md), notamment FRONT-14 : consulter ce référentiel pour le comportement des pages, actions et FAQ. [Site public](marketing-web.md) : direction et contraintes propres au marketing.

## BRD-01 — Aplats fournis

> **Historique** : ces aplats restent des sources conservées. Leur usage imposé dans les interfaces est remplacé par [ADR-0006](../adr/0006-marketing-design-system.md).

Échantillonnage des pixels opaques au centre des rectangles, hors texte et anticrénelage ; coordonnées depuis le coin supérieur gauche de l'image originale 1281 × 619.

| Libellé source | Hex exact | Point (x, y) | Conservation |
|---|---|---|---|
| Surface / BG | `#F6F6F7` | 100, 190 | Fond global clair |
| Border | `#EEEEEF` | 100, 520 | Séparateurs décoratifs |
| body | `#84869C` | 440, 520 | Couleur source conservée sous `--brand-body` |
| Title / CTA | `#16153D` | 800, 520 | Titres et variante de CTA sombre |
| Primary | `#5356DA` | 1150, 520 | Accent principal, liens et actions primaires |

Le gris olive `#737366` est le fond de présentation de la planche : il ne figure dans aucun des cinq aplats nommés et n'est pas ajouté à la palette de marque. Aucun asset fourni n'a été recoloré.

## BRD-02 — Lisibilité et dérivations explicites

Sur le fond fourni, le `body` original atteint **3,31:1** ; sur blanc, **3,58:1**. Il ne remplit donc pas le minimum de 4,5:1 du texte courant. Le texte de grande taille relève d'un seuil distinct de 3:1. Ces seuils et leur portée sont documentés par le [W3C, contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

La proposition assombrit ce rôle en `#66687E`, enregistré comme couleur dérivée `bodyAccessible`, pour `--body` et `--muted-foreground` : **5,06:1** sur le fond et **4,72:1** sur la surface secondaire proposée. La couleur `#84869C` demeure intacte comme référence et convient aux bordures de champs proposées sur les surfaces claires contrôlées. Ce changement de rôle n'est pas présenté comme une couleur directement choisie par l'utilisateur.

| Paire évaluée | Contraste | Usage proposé |
|---|---|---|
| Titre `#16153D` / fond `#F6F6F7` | 16,09:1 | Titres et contenu à forte emphase |
| Blanc / primary `#5356DA` | 5,66:1 | Texte des boutons primaires |
| Primary / fond | 5,24:1 | Liens et focus sur fond clair |
| Border `#EEEEEF` / fond | 1,07:1 | Séparation décorative |
| Bordure renforcée `#84869C` / fond | 3,31:1 | Limite de champ identifiable |

La bordure source ne doit pas constituer seule l'indice nécessaire à l'identification d'un contrôle. `--input` et `--border-strong` proposent la bordure renforcée. Un anneau de focus violet autour d'un bouton violet a besoin d'un espacement sur surface claire : la paire chiffrée ne couvre que cette surface adjacente. Le critère de [contraste non textuel du W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) précise le seuil de 3:1 pour les informations visuelles nécessaires à l'identification des contrôles et de leurs états.

## BRD-03 — Palette sémantique claire proposée

> **Proposition remplacée** : [ADR-0006](../adr/0006-marketing-design-system.md) gouverne le rendu actuel. Ne pas importer cette palette historique à la place du thème commun référencé dans [UI](../packages/ui/README.md).

Les alias shadcn complets vivent dans le JSON et le CSS liés ci-dessus : fonds, foregrounds, cartes, popovers, boutons, surfaces secondaires, accents, bordures, champs, focus, cinq couleurs de graphiques et sidebar. La correspondance est une proposition d'application des aplats ; elle n'a pas encore été exécutée dans une app.

| Extension | Couleur ou paire proposée | Intention |
|---|---|---|
| Carte / popover | `#FFFFFF` | Surface élevée |
| Texte courant | `#66687E` | Dérivé sombre du body fourni |
| Primary au survol | `#494CC6` | Variation plus sombre de l'accent fourni |
| Accent doux | `#EEEEFD` | Variation claire violette |
| Surface secondaire | `#EEEEF3` | Neutre légèrement violet |
| Succès | `#166534` sur `#F0FDF4` | 6,81:1 |
| Avertissement | `#92400E` sur `#FFFBEB` | 6,84:1 |
| Erreur | `#B42318` sur `#FEF3F2` | 6,05:1 |
| Action destructive | Blanc sur `#B42318` | 6,57:1 |
| Information | `#3155A4` sur `#EFF6FF` | 6,51:1 |

Succès, avertissement, erreur et information sont des extensions fonctionnelles absentes de la planche, pas des couleurs de marque prétendument extraites. Les graphiques proposent cinq teintes existantes ; ajouter libellés, formes ou motifs selon le cas, puis vérifier les contrastes réellement adjacents. Cette palette ne prouve ni la distinction de séries superposées, ni l'accessibilité d'une page entière.

Aucun mode sombre, choix de police, rayon, espacement ou animation n'est déduit de l'image. Les paramètres non chromatiques commencent avec le preset ; toute adaptation suivra la slice UI et les références produit pertinentes.

## BRD-04 — Inventaire des assets fournis

| Fichier | Dimensions | Observation vérifiée | Usage proposé |
|---|---|---|---|
| [logo-coverview.svg](../assets/logo-coverview.svg) | 444 × 73 ; viewBox identique | Tracés noirs, fond transparent | Signature complète sur fond clair |
| [icon-coverview.svg](../assets/icon-coverview.svg) | 80 × 73 ; viewBox identique | Symbole noir, fond transparent | Espaces réduits, conserver les proportions |
| [favicon.png](../assets/favicon.png) | 140 × 145 | Symbole violet sur carte blanche arrondie, bords transparents | Source de favicon ; export carré à traiter ultérieurement |
| [dawn-bg.png](../assets/dawn-bg.png) | 1011 × 585 | Fond clair avec halos pêche, jaune et lavande | Fond décoratif doux |
| [center-highlight.png](../assets/center-highlight.png) | 472 × 236 | Halo violet et bleu, rayons blancs diffus | Accent décoratif local |

Les SVG ont été inspectés dans leur structure et leurs attributs : remplissages et traits noirs, aucun dégradé déclaré. Les trois PNG ont été ouverts visuellement et leurs dimensions lues dans les fichiers. Les couleurs des backgrounds sont des variations d'image, pas des tokens supplémentaires. Pour un texte superposé, contrôler le contraste au point effectivement couvert ; privilégier une surface de contenu stable quand le fond varie. Les originaux demeurent intacts.

## Vérification et reprise

Depuis la racine : `node scripts/verify-brand.mjs`. L'oracle contrôle la cohérence JSON/CSS, les empreintes de la planche et des cinq assets, et les 18 paires de contraste retenues sans arrondir les seuils. Il affiche séparément les limites connues du body et de la bordure d'origine ; elles ne sont pas comptées parmi les paires conformes.

Après une modification intentionnelle du JSON : `node scripts/verify-brand.mjs --write-css`, puis relancer sans option. Aucun package externe n'est nécessaire. L'oracle ne décode pas les pixels de la planche à chaque passage : son empreinte garantit la source échantillonnée initialement.

Vérifié : échantillons, contrastes numériques et intégrité des sources. Proposition à vérifier dans la première slice UI : disposition des couleurs, composants rendus, contrastes avec transparence ou fond illustré, focus, densité et responsive. Aucun shadcn installé et aucun thème branché à une application lors de cette initialisation.
