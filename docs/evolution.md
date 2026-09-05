# Compatibilité et évolutions

> **Résumé** : Chercher tous les consommateurs avant de modifier ; expand-contract pour tout changement incompatible ; événements versionnés strictement ; feature flags avec propriétaire et condition de suppression.

## EVO-01 — Rechercher les consommateurs

Avant de modifier : API, événement, table, schéma, réponse, permission, rôle, room, type d'événement WebSocket, clé de cache — rechercher **tous** les consommateurs (tous les frontends, workers, intégrations, mobiles anciens).

## EVO-02 — Expand-contract

Pour un changement incompatible : 1) introduire le nouveau contrat ; 2) supporter temporairement l'ancien ; 3) migrer les consommateurs ; 4) observer ; 5) supprimer l'ancien. NE JAMAIS supposer que backend et frontends se déploient au même instant (ARCH-13).

## EVO-03 — Versionnement des événements

Les événements persistants, distribués ou publics sont versionnés plus strictement que le code interne (`.v1` → `.v2` en parallèle, jamais de mutation silencieuse du payload).

## EVO-04 — Feature flags

Chaque flag a : une raison, un propriétaire, une valeur par défaut, une condition de suppression. Un flag n'est jamais une permission ni un entitlement (PERM-09). Les flags morts se suppriment.

## EVO-05 — Nouvelles permissions

Définir : comportement par défaut, rôles système qui la reçoivent, impact sur les utilisateurs existants, impact sur les WebSockets (RT-08, RT-11), impact sur chaque frontend.
