# Documentation des fonctionnalités et décisions

> **Résumé** : Un README vivant par module : 5 sections obligatoires jamais vides, le reste à la demande ; hiérarchie des sources de vérité ; ADR pour tout choix structurant.

## DOC-01 — Un README par module significatif

Chaque module backend (`modules/deployments/README.md`) et chaque feature frontend significative (`features/deployments/README.md`) a un README vivant. La documentation canonique du domaine vit côté backend ; les README frontend, plus courts, décrivent pages, parcours, permissions utilisées, événements WebSocket consommés et comportements UI, et **référencent** la documentation canonique sans la recopier.

## DOC-02 — Template : 5 sections obligatoires

Sections **obligatoires** (toujours présentes, jamais vides) :

1. **Résumé** — finalité, utilisateurs, valeur.
2. **Périmètre** — ce que le module gère et ne gère pas.
3. **Règles métier et invariants** — les règles importantes, statuts et transitions.
4. **Permissions** — permissions utilisées, rôles système concernés, règles de propriété et de tenant.
5. **État réel** — fonctionnel / partiellement fonctionnel / simulé / expérimental / déprécié / non implémenté.

Sections **optionnelles**, ajoutées uniquement quand elles apportent quelque chose : applications consommatrices, parcours utilisateurs, modèle métier, architecture du module, données et persistance (dont politique de soft delete — DATA-13), API et contrats, événements métier, WebSockets et rooms (politique d'exposition — RT-08), jobs et cron, gestion des erreurs, observabilité, tests importants, limitations et dette, décisions (liens ADR).

INTERDIT : générer des sections vides ou rituelles pour « remplir le template ». Un README court et exact vaut mieux qu'un README long et creux.

## DOC-03 — Exhaustif sur l'intention, jamais une recopie du code

Documenter : intention, fonctionnement métier, parcours, invariants, permissions, flux critiques, contrats publics, risques, état réel. NE PAS recopier : chaque fonction, type, colonne, détail lisible dans le code, chaque test.

## DOC-04 — Hiérarchie des sources de vérité

En cas de divergence : 1) règles métier validées ; 2) contrats et contraintes exécutables ; 3) comportement réel du code ; 4) tests ; 5) README. Une divergence se corrige — et le code peut lui-même être faux par rapport au besoin métier (dans ce cas : G-01, demander).

## DOC-05 — Mise à jour obligatoire

Vérifier le README **et les sous-documents concernés** (DOC-13) à chaque tâche qui modifie : périmètre, parcours, règle métier, permission, rôle, statut, transition, API, événement, room, politique WebSocket, job, cron, intégration, modèle de données, état réel.

L'extension aux sous-documents n'est pas cosmétique : on oublie plus facilement de mettre à jour un fichier qu'on n'a pas ouvert. La scission améliore le coût de contexte et dégrade la fraîcheur — DOC-05 est ce qui compense la seconde.

## DOC-06 — Documentation progressive

Un nouveau module commence avec les 5 sections obligatoires, courtes. On enrichit avec la complexité — jamais l'inverse.

## DOC-07 — ADR

Créer un ADR (`adr/NNNN-titre.md`) quand un choix : affecte plusieurs modules, est difficile à inverser, introduit une technologie, modifie une frontière, change le modèle de permissions ou multi-tenant, change le protocole temps réel, introduit un BFF. Contenu : contexte, décision, alternatives, conséquences, stratégie de migration. Un ADR ne se supprime pas : il se remplace (statut `superseded`).

## DOC-08 — Mémoire et documentation

`MEMORY.md` (docs/memory.md) est un sas de candidats, jamais une source de vérité concurrente : toute convention validée est promue vers le satellite, le README du module ou un ADR (MEM-04), puis l'entrée est retirée ou expirée. La hiérarchie DOC-04 reste inchangée.

## DOC-09 — Choisir la surface par son déclencheur (origine HRN-KNOW-009)

Une instruction destinée à l'agent peut vivre sur cinq surfaces. Le choix DOIT se faire sur **qui décide du chargement**, jamais sur la commodité d'écriture.

| Surface | Qui déclenche | Déterminisme | Ce qui y va |
|---|---|---|---|
| Racine (`CLAUDE.md`) | toujours chargé | total | invariants applicables à toute tâche, table de routage |
| Satellite (`docs/`) | la table de routage §5 | total | connaissance thématique, normes, conventions |
| Commande (`.claude/commands/`) | l'humain, explicitement | total | rituels : planifier, livrer, réviser, auditer |
| Skill | **le modèle**, d'après la description | probabiliste | savoir-faire optionnel et épisodique, dont la pertinence dépend du contexte |
| Hook / lint / CI | la machine, sur événement | total, non contournable | toute contrainte mécaniquement vérifiable (G-15) |

Trois questions pour trancher : la règle s'applique-t-elle à **toutes** les tâches ou à certaines ? est-ce une **norme** ou une **procédure** ? est-il **acceptable qu'elle ne se charge pas** ? Trois réponses « toutes / norme / non » ⇒ racine ou satellite. « Certaines / procédure / oui » ⇒ skill.

Le principe sous-jacent : **une règle qui existe pour corriger le jugement du modèle ne peut pas dépendre du jugement du modèle.** Corollaire symétrique — mettre en satellite un savoir-faire utile à une fraction des tâches gaspille du contexte en permanence ; le routage §5 existe précisément pour éviter les deux erreurs.

Ce harness n'utilise donc **aucune skill** pour son référentiel : le routage avec exclusions est déterministe là où une skill ne l'est pas. Les skills restent légitimes pour un savoir-faire portable et épisodique (production d'un format de fichier, procédure rare), ajouté **par-dessus** le référentiel — jamais à sa place.

## DOC-10 — Une règle, une surface (origine HRN-KNOW-010, miroir HRN-INTAKE-006)

Une même règle NE DOIT JAMAIS exister sur deux surfaces chargées indépendamment. Deux copies ont deux rythmes de mise à jour : elles divergent, l'agent en applique une, et personne ne sait laquelle. Une surface référence l'autre par son identifiant de règle ; elle ne la recopie pas.

**Exception nommée : le résumé de racine.** Écrite en absolu, la règle ci-dessus est violée par l'architecture même du harness — `CLAUDE.md` §6 résume `program.md`, §7 résume ARCH-01, G-01 résume PROG-15. Un invariant que zéro instance ne tient ne protège rien (HRN-INFRA-010) : mieux vaut le borner que le proclamer.

Un résumé en racine est légitime **à trois conditions cumulatives** :

1. il cite l'**identifiant** de la règle satellite qui fait autorité ;
2. il n'ajoute **aucune clause normative absente** du satellite — c'est le critère opérationnel, et il est vérifiable : toute clause présente en racine et absente du satellite désigné est la clause qui divergera ;
3. il va **de la racine vers un satellite**, jamais entre deux satellites.

Le troisième point est le vrai interdit. Racine et satellite ont un rapport hiérarchique connu : en cas d'écart, le satellite fait foi (§4). Deux satellites se chargent **indépendamment l'un de l'autre** — une tâche peut charger l'un sans l'autre — donc rien ne dit lequel l'agent aura lu, ni lequel fait autorité. C'est le cas qui reste strictement interdit.


## DOC-11 — Où atterrit une règle métier tranchée (destination de PROG-17)

Trois destinations, un arbitrage en cascade — la première qui s'applique gagne :

1. **La règle appartient à une capacité d'un module** → sous-document de cette capacité (`modules/<module>/docs/<capacité>.md`, DOC-13). C'est le cas courant.
2. **La règle vaut pour tout le module** (invariant, statut, transition) → §3 du README du module.
3. **La règle ne se rattache à aucun module** → section `Règles transverses` de `PROJECT.md`, avec identifiant stable.

Une règle NE DOIT JAMAIS être écrite à deux de ces endroits (DOC-10) : les deux autres la référencent par son identifiant. Si l'arbitrage hésite entre 1 et 2, c'est 2 — une règle promue trop haut reste trouvable, une règle enterrée trop bas ne l'est pas.

## DOC-12 — Feature transverse : un module propriétaire déclaré

Une capacité qui traverse plusieurs modules (invitations = organisations + email + billing) DOIT déclarer **un module propriétaire**, qui héberge la documentation canonique. Les autres modules la référencent depuis leur README sans la recopier. Le propriétaire est celui qui porte les **invariants** de la capacité, pas celui qui en écrit le plus de code.

Sans propriétaire déclaré, la documentation atterrit dans le README du dernier module touché et devient invisible depuis les autres.

## DOC-13 — Budget du README de module et scission

Un README de module croît avec le module. Sans plafond, un domaine mature atteint plusieurs centaines de lignes chargées intégralement pour la moindre tâche — c'est exactement le monolithe documentaire que CLAUDE.md §5 évite à la racine. Le motif de routage est **récursif** (HRN-KNOW-011) : au-delà de son budget, un README devient à son tour une racine locale.

**Budget** : ~150 lignes **hors table de routage** — même formulation que HRN-KNOW-001, et pour la même raison : la table est dense et croît avec le nombre de sous-documents, la compter pousserait à sous-router.

**Déclencheurs de scission** — au moins un des trois :

1. le README dépasse son budget ;
2. le module porte **quatre capacités métier distinctes ou plus**, chacune avec ses propres règles ;
3. **deux sections ne sont jamais lues ensemble** pour une même tâche.

Le troisième critère est le vrai signal ; les deux premiers n'en sont que des proxys observables.

**Ce qui reste dans le README, toujours** : les 5 sections obligatoires (DOC-02) réduites à ce qui vaut pour tout le module — résumé, périmètre, invariants transverses au module, vue d'ensemble des permissions, état réel — **plus la table de routage**. **Ce qui part** : le détail par capacité, dans `modules/<module>/docs/<capacité>.md`, un fichier par capacité métier et non par fichier de code.

**Garde anti-scission prématurée** : un module naît avec son README seul (DOC-06). Un sous-document qu'aucune condition de la table de routage ne charge est un document mort — le créer est une erreur, pas une anticipation.

## DOC-14 — Table de routage de module

Un README scindé DOIT porter sa table, au même format que CLAUDE.md §5 : condition d'entrée → sous-document, suivie des exclusions utiles (HRN-KNOW-008).

```markdown
## Routage

| Si la tâche porte sur… | Lire aussi |
|---|---|
| Proration, changement de palier, crédit résiduel | `docs/proration.md` |
| Impayés, relances, période de grâce | `docs/dunning.md` |
| Émission, numérotation, avoirs | `docs/invoicing.md` |

Exclusions : une tâche de proration ne charge ni `dunning.md` ni `invoicing.md`.
```

L'agent charge **toujours** le README du module concerné — il est court et sert d'index — puis uniquement les sous-documents désignés. La table `§5` de la racine reste inchangée : la scission n'ajoute aucune ligne au niveau global.

Limite assumée : `evals/run.mjs` ne teste que le routage `§5` (EVAL-01), auquel il fournit la racine en entrée. **Le routage intra-module n'est vérifié par aucune éval.** Construire un second harnais pour un routage local serait disproportionné en profil solo — c'est une dégradation choisie (HRN-INFRA-010), pas un oubli.

## DOC-15 — Identifiants des règles de module

Les règles du référentiel d'ingénierie s'écrivent `MAJUSCULE-NN` (`BILL-04`, `PERM-09`). Les règles **métier** d'un module NE DOIVENT PAS emprunter ce format : `BILL-11` serait ambigu avec le satellite `docs/billing.md`.

Format imposé, en minuscules et en trois segments : `<module>.<capacité>.<n>` — `billing.proration.3`, `billing.dunning.1`, `organizations.invitations.2`. Visuellement distinct, greppable, sans collision possible d'espace de noms. Les identifiants sont **stables** : on ne renumérote pas, on déprécie.