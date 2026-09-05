# API HTTP

> **Résumé** : Conventions HTTP uniformes, erreurs structurées à codes stables, autorisation serveur systématique, spécification complète d'idempotence (clé, stockage, TTL, rejeu), endpoints orientés use case.

## API-01 — Conventions cohérentes

Uniformiser : URLs (CONV-03), méthodes, statuts, erreurs, pagination, filtres, tris, dates (ISO 8601 — DATA-10), identifiants (DATA-12).

## API-02 — Erreurs structurées

```json
{
  "error": {
    "code": "PROJECT_ACCESS_DENIED",
    "message": "You do not have access to this project.",
    "requestId": "req_123"
  }
}
```

Codes stables (majuscules, préfixés par domaine), enregistrés dans `packages/contracts`. JAMAIS de stack trace en production. Mapping cohérent avec la taxonomie BACK-08 (400 validation, 401 authn, 403 authz, 404 absent, 409 conflit, 422 état métier invalide, 5xx interne/externe).

## API-03 — Autorisation côté serveur (G-02)

Chaque opération vérifie : identité, tenant, rôle, permissions, propriété, état de la ressource. Voir `permissions.md`.

## API-04 — Idempotence : spécification

Les endpoints de création et les opérations critiques (paiements, soumissions, déploiements, imports, commandes externes) DOIVENT supporter une clé d'idempotence.

- **Protocole** : header `Idempotency-Key` (UUID généré par le client). Le client le renvoie à l'identique en cas de retry.
- **Stockage** : table dédiée `idempotency_keys(key, tenant_id, endpoint, request_hash, response_status, response_body, locked_at, created_at)` avec contrainte unique `(tenant_id, endpoint, key)`.
- **Comportement** :
  - clé inconnue → traiter, enregistrer la réponse ;
  - même clé + même `request_hash` → rejouer la réponse enregistrée (même statut, même corps) sans réexécuter ;
  - même clé + payload différent → `422 IDEMPOTENCY_KEY_REUSED` ;
  - requête concurrente sur la même clé (verrou/`locked_at`) → `409` avec `Retry-After`.
- **TTL** : 24 h par défaut ; purge par cron.
- **Webhooks entrants** : idempotence par identifiant externe de l'événement (SEC-05), même mécanique.

## API-05 — Endpoints orientés use cases

Pour les opérations complexes, préférer un endpoint métier explicite (`/deployments/:id/cancel`) à des modifications génériques de champs. NE JAMAIS permettre la modification arbitraire d'un statut critique via un patch générique (PAT-15).
