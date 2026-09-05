# ADR-0004 — Preset et marque CoverView

Date : 2026-09-05 · Statut : références utilisateur adoptées ; extensions chromatiques proposées.

## Contexte et décision

L'utilisateur fournit une commande de preset shadcn, une image avec cinq couleurs, le logo et des fonds. Remplacer le preset du harness d'origine par celui de DSN-01. La source palette conservée, les valeurs exactes, les rôles dérivés et les preuves de contraste vivent dans `docs/brand.md` et son JSON de référence, pas dans cet ADR.

La règle de navigation compacte demandée relève de FRONT-14, y compris pour les rendus Reveal de la bible. Elle change la manière d'accéder aux détails, sans retirer leur contenu.

## Alternatives et conséquences

Écarter les couleurs par défaut du preset lorsqu'elles contredisent la source. Conserver les cinq couleurs originales et distinguer les variantes accessibles proposées ; un contrôle numérique ne prouve pas le rendu d'un écran. Garder les assets originaux intacts.

## Intégration

Le CSS et JSON de marque sont prêts pour la première slice UI. Aucune app, police, mode sombre ou composant n'a encore été installé. Vérifier l'application du preset et le rendu réel lors de cette slice.
