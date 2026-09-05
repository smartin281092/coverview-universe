# Programme, slices et livraison

> **Résumé** : la planification vit dans des artefacts versionnés (`ROADMAP.md`, `roadmap/backlog.yaml`), jamais en tête ni en conversation. L'unité de travail est la vertical slice, une seule en cours à la fois, avec plan persisté validé avant exécution et livraison classée vérifié / fait non vérifié / supposé.

## PROG-01 — Deux artefacts versionnés (origine HRN-PROG-001)

`ROADMAP.md` (jalons, intentions) et `roadmap/backlog.yaml` (slices typées, statuts, dépendances) DOIVENT exister et rester à jour. C'est la mémoire de planification du projet — distincte du plan intra-tâche.

## PROG-02 — L'unité de travail est la vertical slice

Chaque entrée du backlog est par défaut une slice verticale (ARCH-01) : livrable, testable par un utilisateur, identifiant stable `S-xxx` (jamais renuméroté).

## PROG-03 — Cycle de vie (origine HRN-PROG-002)

`idea → specified → ready → running → review → done`. Une slice significative ne passe `ready` que lorsque son plan est approuvé (G-17). `review` = compte rendu livré, en attente de validation humaine. `done` = définition de terminé (CLAUDE.md §7) satisfaite.

## PROG-04 — WIP = 1

Une seule slice en `running` à la fois. Le focus est l'arme du solo : terminer avant d'ouvrir. Toute idée surgissant en cours de route va dans le backlog en `idea` — jamais en exécution immédiate.

## PROG-05 — Dépendances explicites (origine HRN-PROG-003)

`depends_on` renseigné ; ne jamais lancer une slice dont les dépendances ne sont pas `done`.

## PROG-06 — Format du backlog

```yaml
# roadmap/backlog.yaml
- id: S-004
  title: "Wallet : soumission et suivi des leads"
  status: ready            # idea → specified → ready → running → review → done
  milestone: M1
  depends_on: [S-001]
  plan: roadmap/plans/S-004.plan.md
  session: ""              # modèle + effort réellement utilisés, renseigné à la livraison (PROG-12)
  cost: ""                 # coût constaté (PROG-14) — le seul poste de dépense du solo
  notes: []                # artefacts, décisions, liens compte rendu
```

## PROG-07 — Plan de slice : persisté, diffable, validé (origine HRN-INTAKE)

- Depuis `templates/slice.plan.md` : **questions bloquantes en tête** (PROG-15), objectif reformulé, hypothèses posées — réversibles uniquement, inconnues réversibles restantes (→ ≤ 3 questions bornées, G-01), DoD avec oracles (PROG-10), modules et apps, permissions, données, événements, satellites à charger et exclusions, risques + mitigations, hors-périmètre.
- Le prompt/plan **référence** les satellites par nom, il ne les recopie jamais (origine HRN-INTAKE-006).
- Soumission ⇒ **attendre « GO S-xxx »**. Si le plan porte des questions bloquantes, le GO DOIT porter les réponses (« GO S-xxx · 1a 2b » ou « GO S-xxx · défauts ») — un GO nu sur un plan à questions bloquantes n'est pas une approbation, c'est une abstention. Une itération de plan est un diff du précédent, pas une réécriture à relire intégralement (origine HRN-INTAKE-007).
- Déviation majeure en cours d'exécution (périmètre, schéma, contrat) ⇒ stopper, retour en revue de plan — jamais de dérive silencieuse (origine HRN-INTAKE-004).

## PROG-08 — Fin de slice = livraison structurée (origine HRN-DLV)

1. Compte rendu factuel avec **ledger** vérifié / fait non vérifié / supposé (G-18, CLAUDE.md §6.5), **plus la session réelle** : modèle et effort effectivement utilisés (PROG-12).
2. Backlog mis à jour : statut, artefacts, notes — la session réelle y est reportée (`session:`).
3. Candidats mémoire déposés dans `MEMORY.md` (MEM-03) — **dont toute réponse à une question bloquante** (PROG-17).
3bis. Si un écart au référentiel a été constaté : cas déposé dans `evals/cases.mjs` (EVAL-05). Sinon, rien — cette étape est vide la plupart du temps et doit le rester.
4. Brouillon du plan de la slice suivante, produit tant que le contexte est chaud — soumis à revue, jamais auto-exécuté (origine HRN-PROG-005).

## PROG-09 — Livraison partielle (origine HRN-DLV-004)

Temps ou budget épuisé ⇒ livrer l'état atteint + un reste-à-faire structuré réinjectable dans le plan. Jamais de tout-ou-rien, jamais d'état ambigu : le ledger dit exactement où en est chaque élément.

## PROG-10 — Échelle d'oracles (origine HRN-VER)

| Niveau | Oracle | Exemples ici |
|---|---|---|
| V0 | Typage, lint, parsing | `pnpm typecheck`, `pnpm lint` |
| V1 | Build, migration à blanc | `pnpm build`, `db:migrate` sur base jetable |
| V2 | Tests, invariants | `pnpm test` (permissions, tenancy, métier) |
| V3 | Vérité terrain | parcours réel exécuté, appel API réel, seed → UI |
| V5 | Humain | revue du diff, validation du compte rendu |

Chaque DoD déclare l'oracle **le plus fort disponible** par critère. Une tâche sans oracle machine est explicitement marquée `oracle: humain` — elle ne se conclut jamais en autonomie (origine HRN-VER-001). Après 2 échecs de vérification sur la même cible : changer de mode, pas de retry identique (CLAUDE.md §6.4).

**Le plus fort *disponible*, pas le plus fort imaginable.** Un critère NE DOIT PAS déclarer un oracle V3 ou V5 lorsqu'un V2 le couvre entièrement : chaque V3/V5 inscrit dans une DoD est une interruption humaine, et une DoD qui en fabrique par excès de zèle transforme le gate en formalité qu'on finit par expédier. Une slice purement backend se clôt légitimement en V2 (PROG-18) ; réserver V3 à ce qu'un test ne peut pas constater — un rendu, un parcours multi-écrans, un comportement de tiers réel.

## PROG-11 — Revue de roadmap (origine HRN-PROG-006)

À chaque fin de jalon, ou toutes les ~5 slices : relire `ROADMAP.md` à la lumière du réel (usage, douleurs, coûts), réordonner le backlog, purger les `idea` mortes, traiter les entrées mémoire expirées (MEM-05). Le programme s'adapte aux mesures, pas l'inverse.

## PROG-12 — Session recommandée : modèle et effort

Chaque plan de slice et chaque proposition de slice suivante DOIT porter une ligne **Session recommandée** : modèle + niveau d'effort + justification en une ligne.

- Niveaux d'effort : `low` · `medium` · `high` · `xhigh` · `max` (réglables par `/effort` ou le sélecteur de `/model` ; l'échelle est **calibrée par modèle** — un même nom ne représente pas la même profondeur d'un modèle à l'autre, d'où la recommandation en **paire** modèle+effort). `ultrathink` est un mot-clé de tour, à réserver à un blocage ponctuel — il ne remplace pas le réglage de session.
- La recommandation s'ancre sur des **traits objectifs de la slice**, jamais sur une impression : surface touchée, réversibilité, ambiguïté, criticité.

La recommandation s'exprime en **tiers**, jamais en noms de modèles : les noms se périment en quelques mois et figer une génération dans le référentiel reproduit exactement l'erreur que BOOT-05 interdit pour les dépendances. Une seule table de correspondance, datée, vit en fin de section — c'est le seul endroit à mettre à jour.

| Profil de slice | Tier · effort |
|---|---|
| Contenu, libellés, style local, correction triviale | `T-rapide` · low–medium |
| Slice CRUD suivant des motifs déjà présents dans le repo | `T-standard` · medium–high |
| Schéma, permissions, tenancy, billing, autorisation temps réel, contrat public | `T-profond` · high–xhigh |
| Architecture ambiguë, migration transverse, debug bloqué après 2 échecs (§6.4) | `T-profond` · xhigh–max |
| Problème réellement inhabituel, hors motifs connus | `T-frontière` · high–xhigh |
| Bootstrap `S-000a` (socle outillé, fichiers livrés) | `T-standard` · medium–high |
| Bootstrap `S-000b`/`S-000c` (auth réelle, mise en ligne) | `T-profond` · high–xhigh |

**Escalade en cours de session** — deux signaux distincts : l'agent a sauté un fichier, n'a pas lancé les tests, ou a abandonné un refactor en route ⇒ monter l'**effort** ; l'agent avait tout le contexte, a réellement essayé et s'est trompé quand même ⇒ changer de **modèle**.

**Ce que la recommandation ne fait jamais** : abaisser la barre. Les gates (G-17), les oracles de la DoD (PROG-10) et le ledger (G-18) sont identiques quel que soit le couple choisi. Un modèle moins coûteux ne dispense d'aucune vérification — il change le budget, pas la définition de terminé.

**Correspondance tiers → modèles** — *unique point de mise à jour, à revoir à chaque génération de modèles* :

| Tier | Rôle | Modèles (constaté au 2026-08) |
|---|---|---|
| `T-rapide` | volume, faible enjeu, motifs évidents | Haiku 4.5, Sonnet 5 |
| `T-standard` | travail courant sur motifs connus du repo | Sonnet 5 |
| `T-profond` | raisonnement long, enjeu irréversible | Opus 5 |
| `T-frontière` | problème hors motifs, dernier recours | Fable 5 (repli automatique sur Opus 5 sur certains sujets) |

Un tier vide dans une organisation donnée retombe sur le tier immédiatement inférieur — jamais sur « on verra ».

## PROG-13 — Journal du programme (origine HRN-STATE-001, profil minimal HRN-INFRA-009)

Le harness de référence exige un journal append-only. En profil solo, il n'est pas absent : il est **porté par des artefacts existants**, et cette équivalence DOIT être assumée explicitement plutôt que subie.

| Fonction du journal | Porteur ici |
|---|---|
| Séquence horodatée et immuable des actions | historique Git (commits conventionnels, DEL-01) |
| Intention et périmètre de chaque unité de travail | `roadmap/plans/S-xxx.plan.md` versionnés |
| Résultat, statut, artefacts, session réelle | `roadmap/backlog.yaml` (notes, `session`) |
| Apprentissages et revirements | `MEMORY.md` avec dépréciation tracée (MEM-05) |

Corollaire opérationnel : **aucune slice ne se termine sur un état non committé** (DEL-01). Un travail non committé n'est pas dans le journal, donc n'a pas eu lieu.

## PROG-14 — Budget de slice

Chaque plan DOIT porter un budget indicatif : nombre de sessions attendues et point d'arrêt (« si la slice n'est pas passée en revue après N sessions, elle est redécoupée, pas prolongée »). Honnêteté sur la portée : ce budget n'est **pas** un arrêt dur machine — l'outillage ne l'applique pas. C'est un déclencheur de décision humaine, constaté à la livraison. Un dépassement n'est pas un échec ; un dépassement non constaté en est un.

**Le budget porte aussi sur l'argent.** Le harness de référence exige des plafonds de coût appliqués par la machine (`HRN-TASK-003`, `HRN-OBS-005`) ; le profil solo les dégrade en **constat a posteriori**, comme l'épinglage de modèle (PROG-12) — et cette dégradation est écrite dans `ADR-0001`, pas subie. Concrètement : le coût de la slice est relevé à la livraison et reporté dans `cost:` (PROG-06), à côté de la session réelle.

Ce n'est pas de la comptabilité pour elle-même. Pour un solo, les tokens sont un poste de dépense réel et le premier arbitrage quotidien : sans la série des coûts constatés, la recommandation de session (PROG-12) n'est jamais confrontée à ce qu'elle coûte, et la revue de roadmap (PROG-11) — qui prescrit de relire à la lumière « de l'usage, des douleurs, **des coûts** » — n'a rien à lire sur ce troisième terme.
## PROG-15 — Inconnue bloquante : question obligatoire, hors plafond

G-01 interdit d'inventer en silence. Il n'interdit pas d'**assumer par écrit** — et c'est par là que passe la panne réelle : une hypothèse plausible, écrite dans un plan lu à chaud, approuvée d'un « GO », puis matérialisée en base. Le code est irréprochable, le diff ne contient aucune trace de la décision, et l'écart se découvre des mois plus tard sous forme de migration de données.

Une inconnue est **bloquante** si **au moins une** de ces conditions est vraie :

1. elle se matérialise en **données persistées** (montant, statut, date d'effet, quantité, unité) ;
2. elle détermine un **droit**, une permission ou une visibilité ;
3. elle porte sur de l'**argent**, un **délai légal ou contractuel**, ou une action **irréversible** (envoi, suppression, facturation, publication) ;
4. l'infirmer après mise en production exigerait une **migration de données**, pas un simple changement de code.

Une inconnue bloquante DOIT devenir une question et NE DOIT JAMAIS devenir une hypothèse posée. **Elle ne compte pas dans le plafond de 3 questions** : ce plafond protège la vélocité sur les inconnues réversibles, il ne DOIT pas étrangler les seules questions dont l'absence de réponse coûte cher. En l'absence de question bloquante — le cas courant —, le plan n'en porte aucune et rien ne ralentit.

Le test est **objectif**, jamais un jugement d'importance : une inconnue qui coche une condition est bloquante même si elle paraît mineure.

## PROG-16 — Format des questions bloquantes (origine HRN-DLV-002, HRN-INTAKE-008)

La revue humaine est la ressource rare : le plan travaille pour elle, pas l'inverse. Les questions bloquantes DOIVENT donc être **en tête du plan, avant l'objectif**, et suivre ce format — question fermée, options énumérées, défaut proposé et assumé par l'agent :

```
## Questions bloquantes (PROG-15) — réponse requise avant GO
1. Prorata au changement de palier en cours de mois ?
   (a) au jour, effet immédiat            ← défaut proposé
   (b) au mois entamé, effet à l'échéance
   (c) pas de prorata
2. Crédit résiduel ?
   (a) porté sur la facture suivante      ← défaut proposé
   (b) remboursé sous 14 jours

→ Répondre : « GO S-004 · 1a 2b » — ou « GO S-004 · défauts »
```

NE JAMAIS poser une question ouverte quand une question fermée est possible : une question ouverte transfère le travail de formulation à l'humain, ce qui est exactement l'inverse du but. Toujours proposer un défaut : cinq secondes pour l'accepter, mais la décision reste explicitement la tienne et elle est datée dans un fichier versionné.

## PROG-17 — Les réponses bloquantes survivent à leur plan

Une réponse à une question bloquante est une **règle métier que tu viens d'énoncer et qui n'existe nulle part ailleurs**. Elle DOIT être déposée en candidat mémoire au `/ship` (MEM-03), puis promue vers sa destination selon l'arbitrage **DOC-11** : sous-document de capacité, §3 du README du module, ou section `Règles transverses` de `PROJECT.md` si elle ne se rattache à aucun module. Un ADR par-dessus si le choix est structurant (DOC-07). Laissée dans le fichier de plan, elle est perdue : personne ne relit un plan approuvé.

## PROG-18 — `/preview` : l'oracle V3/V5 de la slice

`/preview` rend opérationnels les niveaux de vérification que la machine ne couvre pas (PROG-09, V3 et V5) : elle lance les apps, affiche les identifiants et convertit les critères de DoD observables en points à vérifier, persona par persona.

- Elle est appelable **à tout moment**, indépendamment de l'état du backlog — y compris pour explorer un projet ou reprendre après une interruption. Elle n'est requise en fin de slice que si la DoD porte un critère V3 ou V5 ; une slice purement backend est close par V2.
- **L'agent ne conclut jamais.** Il ne voit pas l'écran : il produit le panneau, puis s'arrête. Classer un point en « vérifié » sur la foi d'un `/preview` sans retour de l'opérateur est une violation de G-18, pas un raccourci.
- Verdict conforme ⇒ `/ship`. Verdict négatif ⇒ l'observation est consignée dans le **journal de vérification** du plan (§6.4) : deux échecs sur la même cible imposent un changement de stratégie (HRN-LOOP-006).
- Le panneau se termine par le sujet de la prochaine slice `ready` — la boucle programme se referme ici comme au `/ship` (PROG-11).

## PROG-19 — Voie rapide : tout n'est pas une slice

La couche programme suppose partout la slice : entrée de backlog (PROG-02), WIP = 1 (PROG-04), plan validé (G-17), livraison structurée (PROG-08). Or un solo corrige un libellé, un lien, une couleur plusieurs fois par jour. Sans chemin explicite, ces tâches déclenchent soit la cérémonie complète — friction absurde —, soit rien du tout, et la traçabilité se perd là où elle était facile.

Une tâche **triviale ou standard non issue du backlog** (§6.1) suit la voie rapide :

- elle **n'ouvre pas de slice**, n'entre pas au backlog et **ne casse pas le WIP = 1** de la slice en cours ;
- elle ne produit ni plan persisté, ni candidats mémoire, ni brouillon de plan suivant ;
- elle produit **un commit conventionnel** (DEL-01) et **deux lignes** de compte rendu : ce qui a changé, et l'oracle passé.

**Le test de sortie de la voie rapide est objectif, jamais un jugement de taille.** Dès que la tâche touche une permission, un schéma de données, un contrat public, de l'argent, un délai ou une action irréversible, ce n'est plus une tâche : c'est une slice, avec plan et gate — même si le diff fait trois lignes. C'est le même test que PROG-15, appliqué au périmètre plutôt qu'aux inconnues, et pour la même raison : ce qui coûte cher ne se mesure pas en lignes.

Une voie rapide qui se répète est un signal, pas un acquis : trois correctifs de suite sur la même zone valent une slice de fond, à déposer en `idea`.

## PROG-20 — Forme réduite de la livraison

PROG-08 dimensionne la livraison sur la slice la plus risquée. Appliqué tel quel à une slice CRUD suivant un motif déjà présent — le cas majoritaire d'un SaaS en construction — il produit huit artefacts pour un travail qui n'a rien appris. Un rituel disproportionné n'est pas allégé : il est **abandonné en bloc**, et on perd aussi les 20 % qui comptaient. L'allègement doit donc être nommé, pas subi.

Une slice **standard** (aucune touche à l'argent, aux droits, au schéma, à un contrat public ou à une action irréversible) se clôt par les **étapes 1 et 2 seules** : compte rendu avec ledger, backlog à jour. Les étapes 3 (candidats mémoire) et 4 (brouillon de plan suivant) deviennent conditionnelles :

- étape 3 **uniquement si la slice a réellement appris quelque chose** — un piège rencontré, une convention découverte, une réponse à une question bloquante (PROG-17, toujours obligatoire). « Rien à déposer » est une réponse normale et fréquente ;
- étape 4 **uniquement si la slice suivante n'est pas déjà `ready`** avec un plan écrit.

Ce qui ne s'allège **jamais**, quelle que soit la taille : le ledger et son honnêteté (G-18), l'état committé (DEL-01), et le statut du backlog. Ce sont les trois porteurs du journal (PROG-13) — les retirer ne fait pas gagner du temps, ça efface la trace.

