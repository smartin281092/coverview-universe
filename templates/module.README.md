# Module `<nom>`

> Template DOC-02. Les 5 sections obligatoires sont toujours présentes et jamais vides.
> Budget : ~150 lignes hors table de routage (DOC-13). Au-delà, scinder — ne pas comprimer.

## Résumé

<Finalité du module, utilisateurs concernés, valeur apportée. 2 à 4 phrases.>

## Périmètre

**Géré ici** : <capacités portées par ce module>
**Non géré ici** : <ce qui appartient à un autre module, avec le nom du module>

<Si ce module est propriétaire d'une capacité transverse (DOC-12), le dire ici et nommer les modules qui la référencent.>

## Règles métier et invariants

Seules les règles valant pour **tout le module** figurent ici (DOC-11, cas 2). Le détail par capacité vit dans les sous-documents.

- **`<module>.<capacité>.<n>`** — <règle, formulée de façon vérifiable> (DOC-15)

<Statuts et transitions du domaine, si le module en porte.>

## Permissions

<Vue d'ensemble : permissions utilisées, rôles concernés, règles de propriété et de tenant. Le détail par capacité part en sous-document. Voir `docs/permissions.md` pour la distinction permission / entitlement / feature flag (PERM-09).>

## État réel

<fonctionnel | partiellement fonctionnel | simulé | expérimental | déprécié | non implémenté>

<Une ligne par capacité si l'état diffère entre elles. Cette section est la plus lue et la plus vite périmée : la mettre à jour à chaque slice (DOC-05).>

---

## Routage

> Section présente **uniquement** si le module a été scindé (DOC-13/DOC-14).
> Un sous-document qu'aucune ligne ne charge est un document mort : le supprimer ou le router.

| Si la tâche porte sur… | Lire aussi |
|---|---|
| <condition d'entrée observable> | `docs/<capacité>.md` |

Exclusions : <ce qu'il ne faut pas charger et quand — le bruit coûte autant que l'absence, HRN-KNOW-008>.

---

## Sections optionnelles

À n'ajouter que lorsqu'elles apportent quelque chose (DOC-02) : applications consommatrices · parcours utilisateurs · modèle métier · architecture du module · données et persistance (soft delete, DATA-13) · API et contrats · événements métier · WebSockets et rooms (RT-08) · jobs et cron · gestion des erreurs · observabilité · tests importants · limitations et dette · décisions (liens ADR).

**INTERDIT** : générer une section vide ou rituelle pour « remplir le template ».
