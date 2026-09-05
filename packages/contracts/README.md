# Contrats publics

## Résumé

Schémas Zod exécutables consommés par Fastify et le client HTTP commun.

## Périmètre

Santé, projection des personas fictives locales et DTO d’identité : configuration, profil/session sans token durable, espace du propriétaire, accès admin, liste bornée d’appareils, déconnexion, challenge/vérification MFA. Aucun modèle ORM, accès réseau ou secret.

## Règles métier et invariants

Les types publics dérivent des schémas (CTR-02/CTR-05). Les personas sont un contrat de démonstration du socle, pas des rôles ou identités produit.

## Permissions

L'exposition des personas est contrôlée par `apps/api/src/platform/config.ts` et le serveur. La validation d'un DTO ne confère aucun droit.

## État réel

Contrats du socle et d’identité ; l’existence d’un schéma ne prouve aucun accès WorkOS. Les entrées de mutation sont strictes, les dates en ISO et les codes d’erreur stables. Le code MFA est borné à six chiffres.
