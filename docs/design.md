# Design système des apps (UI)

> **Décision actuelle** : appliquer [ADR-0006](../adr/0006-marketing-design-system.md) et le système commun documenté dans [UI](../packages/ui/README.md). Cette décision prévaut sur l’ancienne direction du preset et sur la restriction de partage statique avec `www` ci-dessous.

> **Résumé** : une seule bibliothèque de composants — shadcn/ui initialisée avec le preset imposé — des tokens pour toute valeur visuelle, des primitives d'états partagées, une seule stack de formulaires. La cohérence prime sur la nouveauté : l'agent réutilise l'existant avant de créer.

## DSN-01 — Initialisation imposée

> **Portée historique** : la procédure ci-dessous documente l’initialisation d’ADR-0004. [ADR-0006](../adr/0006-marketing-design-system.md) la remplace pour la direction visuelle actuelle : réutiliser le système commun, sans réappliquer l’ancien thème ni écraser ses adaptations par une nouvelle application du preset.

Dans chaque app React (`client`, `admin`, apps additionnelles), l'UI s'initialise avec le preset du harness :

```bash
pnpm dlx shadcn@latest apply --preset b38oXC5rf
```

Commande exacte demandée le 2026-09-05 (ADR-0004). `apply` vise un projet déjà initialisé : préparer l'app Vite et sa configuration shadcn dans la slice UI avant de l'appliquer. Vérifier le diff du preset puis appliquer les tokens CoverView de `docs/brand.md` ; ne pas conserver silencieusement ses couleurs par défaut. La commande est enregistrée, pas exécutée pendant l'initialisation documentaire. Référence : [CLI officielle shadcn](https://ui.shadcn.com/docs/cli#apply), consultée le 2026-09-05.

Les composants s'ajoutent uniquement via `pnpm dlx shadcn@latest add <composant>`. Une seule bibliothèque de composants par app — JAMAIS une deuxième en parallèle. Commande de référence à maintenir si la CLI shadcn évolue ; tout changement de preset passe par un ADR.

## DSN-02 — Tokens partout

Couleurs, rayons, espacements et typographie passent par les variables du preset (CSS variables / thème Tailwind). AUCUNE valeur hex ni taille magique en dur dans un composant. Le mode sombre, s'il est activé, ne vit que dans les tokens.

## DSN-03 — Primitives d'états partagées

Construire une fois, dès la première slice UI, puis réutiliser partout : skeleton de chargement, état vide avec action, état d'erreur avec retry, accès refusé, introuvable. Les états FRONT-10 ont chacun leur composant partagé — pas des `div` ad hoc réinventées par écran.

## DSN-04 — Une seule stack de formulaires

react-hook-form + resolver Zod branché sur les schémas de `packages/contracts` (CTR-04) : validation identique au backend, messages d'erreur cohérents et accessibles (FRONT-12), états de soumission gérés (FRONT-13).

## DSN-05 — App shell unique par app

Navigation, header et layout construits une fois ; les pages composent le shell, jamais l'inverse. Densité et échelle d'espacement constantes dans toute l'app.

## DSN-06 — Icônes

lucide-react uniquement (livré avec shadcn) ; tailles et graisses cohérentes.

## DSN-07 — `www` à part

> **Exception actuelle** : [ADR-0006](../adr/0006-marketing-design-system.md) autorise explicitement le partage des composants de présentation de `packages/ui` avec Astro par rendu statique, sans hydratation. Le défaut restrictif ci-dessous ne s’applique plus à cette composition.

Le site marketing partage les tokens de marque (couleurs, typo) mais PAS la bibliothèque de composants React par défaut — îlots uniquement (MKT-04). Sa direction visuelle relève de `marketing-web.md`.

## DSN-08 — Le défaut de l'agent est la réutilisation

Avant tout nouveau composant ou motif visuel : chercher l'existant, copier la page la plus proche, composer avec les primitives. Aucun nouveau pattern visuel sans besoin réel (ARCH-04). La cohérence de l'ensemble vaut plus que l'originalité d'un écran.
