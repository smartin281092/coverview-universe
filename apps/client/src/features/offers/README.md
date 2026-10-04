# Offres Wallet

## Résumé

`/offers` présente les demandes et propositions du profil Wallet sélectionné. Les [règles et permissions canoniques](../../../../api/src/modules/partner-workspace/README.md) appartiennent à Partner.

## Périmètre

Création d'une demande indépendante sur un profil existant, offres groupées par Lead/objet, comparaison des prestations normalisées, lecture des sources, choix, question, modification et demande de conserver le contrat actuel.

## Règles métier et invariants

Les informations absentes restent « non renseigné ». La confirmation enregistre un choix et n'annonce aucune signature ni acceptation de compagnie. Les mutations portent la révision du Lead et la version précise d'offre. Relecture périodique HTTP ; aucune room ni diffusion temps réel présentée comme active.

## Permissions

`IdentityBoundary`, profil actuellement possédé et seules offres publiées. L'email seul n'ouvre aucun dossier. Consentement explicite lors de la nouvelle demande. Les détails privés du conseiller ne sont jamais renvoyés par l'API Wallet.

## État réel

Build/types et écran vide/formulaire mobiles vérifiés. Publication et décisions vérifiées dans PostgreSQL isolé ; recette avec offre réelle non effectuée faute de session Partner habilitée. Rattachement au contrat actuel, signature, contrat final et historique détaillé client restent à compléter dans [le plan](../../../../../roadmap/plans/partner-core.plan.md).
