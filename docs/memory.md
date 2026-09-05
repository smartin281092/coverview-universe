# Mémoire projet

> **Résumé** : `MEMORY.md` est un sas, pas une destination. Les learnings de fin de slice y entrent comme candidats, sont revus par l'humain, puis promus vers leur vraie place (satellite, README, ADR) ou conservés avec date d'expiration. Jamais d'accumulation automatique, jamais de source de vérité concurrente.

## MEM-01 — Un seul fichier, deux sections

`MEMORY.md` à la racine du projet : `## Actives` et `## Candidats`. Profil solo : pas de répertoires ni de store dédié tant que les Actives tiennent en ≲ 100 lignes ; au-delà, promotion ou purge forcée avant tout ajout.

## MEM-02 — Format d'entrée (origine HRN-STATE-007)

```
- MEM-012 · piège · Les migrations drizzle-kit échouent si le schéma importe
  du code applicatif — garder schema.ts pur. (S-003, 2026-08-02 · confiance haute
  · revoir avant 2026-11-01 · actif)
```

Champs : identifiant stable `MEM-xxx` · type (`convention` | `décision` | `fait` | `piège` | `préférence`) · énoncé en 1–3 phrases, normatif (DOIT/DEVRAIT) quand applicable · preuve (slice, date) · confiance · `revoir avant` (défaut : +90 jours) · statut (`actif` | `déprécié`). **Une entrée sans date de revue est un bug.**

## MEM-03 — Extraction en fin de slice (origine HRN-STATE-006)

Chaque fin de slice DOIT déposer ses candidats (conventions découvertes, pièges rencontrés, décisions prises, préférences exprimées) en section `Candidats` — **dont toute réponse à une question bloquante** (PROG-17), de type `décision`, qui est presque toujours promue vers un README de module ou un ADR plutôt que conservée en `Actives`. JAMAIS d'écriture directe en `Actives` : l'activation passe par une revue humaine explicite.

## MEM-04 — Promotion : la mémoire est un sas

La validation (« valide MEM-012 », ou lors du GO du plan suivant) déclenche la promotion vers la **bonne destination** :

- convention technique récurrente → le satellite `docs/` concerné, ou le README du module ;
- décision structurante → un ADR ;
- piège ou préférence sans meilleur foyer → reste en `Actives`, avec expiration.

Une entrée promue est retirée de `MEMORY.md` (une ligne de trace PEUT rester). `MEMORY.md` n'est JAMAIS une source de vérité concurrente de la hiérarchie DOC-04.

## MEM-05 — Contradiction et expiration (origine HRN-STATE-009)

Une entrée contredite par une slice récente passe `déprécié` avec référence de la slice contradictoire — jamais écrasée : la traçabilité des revirements vaut plus que la propreté du fichier. Les entrées dont la date de revue est passée sont revalidées, promues ou dépréciées à la prochaine revue de roadmap (PROG-11).

## MEM-06 — Chargement

Les `Actives` se chargent pour toute tâche significative (elles sont bornées par MEM-01). Les `Candidats` ne se chargent que pour leur revue. La mémoire n'est jamais injectée en bloc dans une tâche triviale.
