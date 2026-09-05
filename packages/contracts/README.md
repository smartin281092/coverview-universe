# Contrats publics

## Résumé

Schémas Zod exécutables consommés par Fastify et le client HTTP commun.

## Périmètre

Santé et projection des personas fictives locales. Aucun modèle ORM, accès réseau ou secret.

## Règles métier et invariants

Les types publics dérivent des schémas (CTR-02/CTR-05). Les personas sont un contrat de démonstration du socle, pas des rôles ou identités produit.

## Permissions

L'exposition des personas est contrôlée par `apps/api/src/platform/config.ts` et le serveur. La validation d'un DTO ne confère aucun droit.

## État réel

Contrats techniques du socle ; aucune API métier déclarée.
