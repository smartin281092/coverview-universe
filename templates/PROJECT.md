# PROJECT — <Nom du produit>

> Généré par la procédure « Start project » (docs/bootstrap.md). Ce fichier est l'identité du produit ; sa présence signifie « projet initialisé ».

## Problème et valeur
<Le problème résolu, en 2-4 phrases. Pour qui, pourquoi maintenant.>

## Personas
- <Persona 1 — rôle, besoin principal>
- <Persona 2>

## Applications activées
`api` + `client` + `admin` + `www` <+ apps additionnelles nommées à l'interview>

## Langues
<fr (défaut), autres> — i18n prêt dès le jour 1.

## Tenancy
<B2B organisations (défaut) | B2C comptes personnels> — voir ADR-0002.

## Authentification
<email + mot de passe, sessions cookie ; OAuth : … ; MFA : admin obligatoire ; magic link : …> — voir ADR-0003.

## Modules et parcours v1
1. <Parcours 1>
2. <Parcours 2>
3. <Parcours 3>

Paiements : <Stripe oui/non>

## Hors-périmètre v1 (explicite)
- <Ce qu'on ne fait volontairement pas>

## Carte des modules

> Une ligne par module backend. Maintenue par `/new-module`. C'est l'index : il évite de parcourir `modules/` pour savoir ce qui existe.

| Module | Rôle en une ligne | Capacités transverses possédées (DOC-12) |
|---|---|---|
| <nom> | <rôle> | <capacité, ou —> |

## Règles transverses

> Règles métier ne se rattachant à aucun module (DOC-11, cas 3). Peu nombreuses par nature. Identifiants stables, alimentés par `/ship`.
> Au-delà d'une trentaine d'entrées, extraire vers `PRODUCT_RULES.md` à la racine et ne laisser ici qu'un renvoi — le motif de routage est récursif (DOC-13, HRN-KNOW-011).

- **`x.<sujet>.<n>`** — <règle vérifiable> · <modules concernés>

## Offre commerciale

> Le catalogue exécutable vit dans `packages/catalog` (`catalog.md`) et en est la source de vérité. Cette section n'en est qu'un résumé lisible : positionnement, segments visés, logique de packaging. **Ne pas y recopier plans, prix ni entitlements** (DOC-10).

<Positionnement, segments, logique de découpage de l'offre — ou « aucune offre payante en v1 ».>

## Hypothèses posées (à invalider si fausses — G-01)
- <Hypothèse explicite issue de l'interview>

## Déploiement
Cible : <VPS Docker + Caddy (défaut) | autre> — domaine(s) : <…>

## Décisions
ADR-0001 (harness/stack) · ADR-0002 (tenancy) · ADR-0003 (auth)
