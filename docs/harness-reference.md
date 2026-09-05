# Harness générique — document de référence (v1.2)

> **Statut dans ce dépôt** : document source conservé intégralement, **hors routage par défaut** (ne charger que sur demande explicite). Ce harness est instancié ici en **profil minimal / solo** (HRN-INFRA-009, maturité L2–L3) ; la forme dégradée retenue pour chaque invariant (§15.2, HRN-INFRA-010) est consignée dans `ADR-0001` à l'initialisation du projet.
>
> Détail de l'instanciation : les couches opératoires sont portées par `CLAUDE.md`, `docs/bootstrap.md`, `docs/program.md` et `docs/memory.md` ; les couches plateforme (§7, §8, §15) ne sont pas des instructions pour l'agent de code — elles décrivent l'infrastructure d'un harness logiciel et servent de matériau de référence (ou de spec produit).

---

# Harness générique — Architecture de référence

> **Statut** : scaffolding **v1.2**. Document normatif destiné à être *instancié* pour chaque harness concret
> (coding agent, agent de recherche, agent ops/SRE, pipeline data, agent support, agent QA…).
> **Langage normatif** : `DOIT` (obligatoire), `DEVRAIT` (recommandé, dérogation à justifier), `PEUT` (optionnel).
> **IDs stables** : ne jamais renuméroter. Une règle retirée passe en `DEPRECATED`, elle ne disparaît pas.
>
> **Changelog v1.2** — issus d'une revue critique de la v1.1 :
> choix de surface d'extension (`HRN-KNOW-009/010`, §6.1) rendu explicite maintenant que les plateformes
> exposent des capacités auto-sélectionnées à côté des documents routés ; évals de la couche connaissance
> (`HRN-EVAL-008/009/010`) — la v1.1 exigeait des évals sans dire lesquelles, donc aucune n'était écrite ;
> classement des inconnues par conséquence (`HRN-TASK-006`, `HRN-INTAKE-008`, `HRN-DLV-006`) — la v1.1 autorisait
> toute inconnue à devenir une hypothèse explicite, ce qui rendait `HRN-P-011` contournable par écrit ;
> routage récursif (`HRN-KNOW-011`) — le motif racine/satellites n'était appliqué qu'au niveau global ;
> liste d'invariants §15.1 scindée
> en deux paliers (`HRN-INFRA-010`) — la liste unique de la v1.1 était intenable en profil solo, donc
> systématiquement violée ; budget de la racine (`HRN-KNOW-001`) exprimé hors table de routage.
>
> **Changelog v1.1** — ajouts issus d'une revue critique de la v1 :
> couche Programme (roadmap/backlog multi-run), compilation *idée → prompt optimisé → revue humaine*
> (`HRN-INTAKE-*`, état `PLAN_REVIEW`), couche Connaissance en documents satellites routés (`HRN-KNOW-*`),
> mécanique opérationnelle de mémoire (`HRN-STATE-006..009`), couche Livraison (`HRN-DLV-*`),
> pilotage humain en cours de run (`HRN-LOOP-009`), contrat de sous-agent, profil minimal solo/local.

---

## 0. Définition

Un **harness** est la couche logicielle déterministe qui entoure un modèle non-déterministe pour en faire un
système fiable. Le modèle décide ; le harness contraint, alimente, exécute, vérifie, trace et récupère.

```
Modèle  = moteur (interchangeable, se périme en ~6 mois)
Harness = châssis, transmission, freins, tableau de bord, banc d'essai (actif durable)
```

Corollaire de design : **la qualité d'un système agentique est plafonnée par son harness, pas par son modèle.**
Un modèle médiocre dans un excellent harness bat un excellent modèle dans une boucle naïve, sur toute tâche
où l'erreur est détectable.

---

## 1. Principes fondateurs

| ID | Principe |
|---|---|
| `HRN-P-001` | Tout ce qui peut être déterministe **DOIT** sortir du prompt et entrer dans le code. Le prompt est le dernier recours, pas le premier. |
| `HRN-P-002` | **Pas d'oracle, pas d'autonomie.** Le niveau d'autonomie accordé **DOIT** être plafonné par la force du vérificateur disponible. |
| `HRN-P-003` | Le contexte est un **budget**, pas un réservoir. Chaque token présent **DOIT** avoir une justification de présence. |
| `HRN-P-004` | Toute action **DOIT** être réversible, sandboxée, ou soumise à un *gate*. Jamais aucune des trois. |
| `HRN-P-005` | Un run **DOIT** être rejouable : mêmes entrées + mêmes réponses modèle enregistrées ⇒ même trajectoire. |
| `HRN-P-006` | Les erreurs sont des **entrées** : un message d'erreur est un prompt. Il **DOIT** être conçu comme tel. |
| `HRN-P-007` | L'état vit **hors** du modèle (fichiers, journal, store). Le contexte est un cache, pas la mémoire. |
| `HRN-P-008` | Un agent bien outillé bat trois agents mal instrumentés. Le multi-agent est une optimisation tardive, pas un point de départ. |
| `HRN-P-009` | Le harness **DOIT** être testable sans modèle (mocks/replay) et le modèle évaluable sans UI (evals headless). |
| `HRN-P-010` | Ce qui n'est pas tracé n'existe pas. Ce qui n'est pas évalué régresse. |
| `HRN-P-011` | **Un prompt exécuté est un artefact.** Il **DOIT** avoir existé comme objet versionné et revoyable *avant* l'exécution — jamais improvisé dans le flux. |

---

## 2. Vue d'ensemble

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │  P. PROGRAMME (multi-run)  roadmap · backlog · dépendances · learnings │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  0a. COMPILATION   idée → brief → PromptPlan ─► REVUE HUMAINE ─► ok    │
   │  0b. CONTRAT       RunSpec (DoD, budgets, politique, modèle épinglé)   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  1. ORCHESTRATEUR — plan → act → observe → verify (+ PLAN_REVIEW)      │
   │     budgets · conditions d'arrêt · reprise · escalade · pilotage humain│
   └───┬───────────────┬───────────────┬───────────────┬────────────────┬───┘
       ▼               ▼               ▼               ▼                ▼
 ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
 │2. CONTEXTE│   │2b. SAVOIR │   │3. OUTILS  │   │4. SUBSTRAT│   │5. VÉRIF.  │
 │ assembly  │   │ satellites│   │ schémas   │   │ sandbox   │   │ oracles   │
 │ compaction│   │ manifest  │   │ perms     │   │ fs/net    │   │ verdicts  │
 │ retrieval │   │ routage   │   │ erreurs   │   │ runtime   │   │ gates     │
 └───────────┘   └───────────┘   └───────────┘   └───────────┘   └───────────┘
       └───────────────┴───────┬───────┴───────────────┴────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  6. ÉTAT & MÉMOIRE   journal · checkpoints · promotion des learnings   │
   │  7. TRANSVERSAL      politique/sécurité · observabilité · coûts · evals│
   └───────────────────────────────────┬────────────────────────────────────┘
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  8. LIVRAISON   paquet structuré : artefacts · diff · verdicts · coûts │
   │                 + brouillon du PromptPlan suivant (retour vers P)      │
   └────────────────────────────────────────────────────────────────────────┘
```

**Séparation cardinale** : *control plane* (décide, planifie, applique la politique, stocke) ≠ *data plane*
(exécute dans un sandbox jetable). Le data plane **DOIT** être considéré comme compromis par défaut.

**Deux corpus de texte, deux rôles** — à ne jamais confondre :
`prompts/` = côté *système* (identité, outils, format — anneaux R0/R1, quasi immuable) ;
`knowledge/` = côté *projet* (documents satellites routés à la demande — anneau R3, évolutif). Cf. §6.

---

## 3. Couche 0 — Programme, compilation, contrat

La couche la plus négligée et la plus rentable. Trois étages, du plus large au plus étroit.

### 3.1 Programme (au-dessus du run) — `HRN-PROG`

Un run est une unité d'exécution. Un projet est une **séquence de runs**. Sans étage de programme,
la planification vit dans la tête de l'humain et se perd.

| ID | Règle |
|---|---|
| `HRN-PROG-001` | Tout projet multi-run **DOIT** maintenir deux artefacts versionnés : `ROADMAP.md` (jalons, intentions) et `backlog.yaml` (tâches typées, statuts, dépendances). C'est la **mémoire de planification**, distincte du plan intra-run (`HRN-LOOP-005`). |
| `HRN-PROG-002` | Cycle de vie d'une tâche : `idea → specified → ready → running → review → done`. Une tâche ne **DOIT** passer `ready` que si son `PromptPlan` (§3.2) est approuvé. |
| `HRN-PROG-003` | Les dépendances inter-tâches **DOIVENT** être explicites ; l'orchestrateur de programme ne lance pas une tâche dont les dépendances ne sont pas `done`. |
| `HRN-PROG-004` | Chaque fin de run **DOIT** mettre à jour le backlog (statut, artefacts produits, learnings candidats) — automatiquement, avec revue. |
| `HRN-PROG-005` | La fin d'un run **DEVRAIT** compiler un **brouillon de `PromptPlan` pour la tâche suivante** du backlog, pendant que le contexte est chaud — soumis à revue humaine avant toute exécution, jamais auto-exécuté. |
| `HRN-PROG-006` | La roadmap **DEVRAIT** être relue à cadence fixe à la lumière des métriques d'évals et de coûts : le programme s'adapte aux mesures, pas l'inverse. |

```yaml
# program/backlog.yaml
- id: T-014
  title: "Console admin : supervision capacité des VPS"
  status: ready              # idea → specified → ready → running → review → done
  depends_on: [T-009]
  prompt_plan: program/plans/T-014.plan.md
  runs: []                   # run_ids rattachés
```

### 3.2 Compilation : idée → prompt optimisé → revue — `HRN-INTAKE`

Entre l'idée brute et le `RunSpec`, il existe une étape à part entière : le **compilateur de tâche**.
Il transforme une intention floue en prompt structuré, exposé à la revue humaine *avant* exécution.

| ID | Règle |
|---|---|
| `HRN-INTAKE-001` | Aucune idée brute ne **DOIT** partir directement en exécution. Elle **DOIT** passer par la compilation qui produit un `PromptPlan` persisté. |
| `HRN-INTAKE-002` | Le `PromptPlan` **DOIT** séparer : objectif reformulé, hypothèses posées, inconnues restantes, DoD proposée, budgets proposés, manifest de contexte (quels satellites charger), risques + mitigations. |
| `HRN-INTAKE-003` | La **revue humaine du `PromptPlan` DOIT** être exigée si : coût estimé > seuil, actions irréversibles au périmètre, ou ambiguïté haute. En dessous, l'auto-approbation **PEUT** être configurée — journalisée comme telle (`auto_approved`). |
| `HRN-INTAKE-004` | Le `PromptPlan` approuvé **DOIT** être versionné et référencé par le `RunSpec`. Toute déviation majeure en cours de run ⇒ retour en `PLAN_REVIEW` (§4), pas de dérive silencieuse. |
| `HRN-INTAKE-005` | Le compilateur **DEVRAIT** proposer, pas décider : les inconnues non résolues deviennent soit des questions bornées (`HRN-TASK-004`), soit des hypothèses *explicites* dans le prompt — jamais des choix implicites. |
| `HRN-INTAKE-006` | Le prompt final **DOIT** référencer les documents de connaissance (par ID / manifest), pas les dupliquer. La duplication crée des divergences que personne ne détecte. |
| `HRN-INTAKE-007` | Deux `PromptPlan` successifs pour une même tâche **DOIVENT** être diffables (`diff_from`) : la revue porte sur le delta, pas sur une relecture intégrale. |
| `HRN-INTAKE-008` | Les questions bloquantes (`HRN-TASK-006`) **DOIVENT** figurer **en tête** du `PromptPlan`, en forme fermée : options énumérées et défaut proposé. L'approbation **DOIT** porter les réponses — une approbation nue d'un plan à questions bloquantes n'est pas une décision, c'est une abstention, et elle transfère silencieusement l'autorité métier au modèle. |

```ts
type PromptPlan = {
  plan_id: string;
  task_id?: string;                  // lien backlog
  source_idea: string;               // l'idée brute, conservée telle quelle
  objective: string;                 // reformulation opérationnelle
  assumptions: Assumption[];         // réversibles uniquement (HRN-TASK-006), avec rayon d'impact
  blocking_questions: Question[];    // hors plafond — réponse requise avant approbation (HRN-INTAKE-008)
  unknowns: string[];                // inconnues réversibles restantes (⇒ HRN-TASK-004)
  proposed_dod: Check[];
  proposed_budgets: Budgets;
  context_manifest: string[];        // satellites & mémoires à charger (R3)
  risks: { desc: string; mitigation: string }[];
  status: "draft" | "approved" | "rejected" | "auto_approved";
  answers?: Record<string, string>;  // réponses aux blocking_questions — partie intégrante de l'approbation
  reviewer?: string;
  diff_from?: string;                // plan_id précédent si itération
};
```

### 3.3 Contrat d'exécution — `HRN-TASK`

| ID | Règle |
|---|---|
| `HRN-TASK-001` | Chaque run **DOIT** être initialisé par un `RunSpec` typé et persisté, jamais par un texte libre seul. |
| `HRN-TASK-002` | Le `RunSpec` **DOIT** contenir une *Definition of Done* machine-vérifiable ou explicitement marquée `oracle: human`. |
| `HRN-TASK-003` | Les budgets (temps, tokens, coût, étapes, appels outils) **DOIVENT** être fixés à l'admission, pas découverts en cours de route. |
| `HRN-TASK-004` | Une tâche dont l'ambiguïté dépasse un seuil **DEVRAIT** déclencher une phase de clarification bornée (≤ N questions) avant exécution. |
| `HRN-TASK-005` | Le modèle et sa version **DOIVENT** être épinglés dans le `RunSpec` (reproductibilité). Pas d'alias flottant en production. |
| `HRN-TASK-006` | Les inconnues **DOIVENT** être classées par **conséquence**, pas par sujet. Une inconnue est *bloquante* si elle se matérialise en état persisté, détermine un droit, porte sur de l'argent / un délai / une action irréversible, ou exigerait une migration de données pour être infirmée. Une inconnue bloquante **DOIT** devenir une question et **NE DOIT JAMAIS** devenir une hypothèse posée. Elle **NE DOIT PAS** compter dans le plafond de `HRN-TASK-004` : un plafond qui étrangle les questions coûteuses protège la vélocité au mauvais endroit. |

```ts
type RunSpec = {
  run_id: string;                    // ULID
  tenant_id: string;
  prompt_plan_id: string;            // HRN-INTAKE-004
  contract: {
    deliverables: Artifact[];        // ce qui doit exister à la fin
    done_when: Check[];              // oracle machine (tests, invariants, schémas)
    out_of_scope?: string[];
  };
  budgets: {
    max_steps: number;
    max_tokens_in: number;
    max_tokens_out: number;
    max_cost_usd: number;
    wall_clock_s: number;
    max_tool_calls?: Record<string, number>;
  };
  policy: {
    permissions: Permission[];       // fs.read, fs.write, net.egress, exec, secrets.*
    gates: GateRule[];               // actions exigeant validation humaine
    egress_allowlist: string[];
  };
  model: { provider: string; id: string; params: Record<string, unknown> };
  substrate: { image: string; cpu: number; mem_mb: number; timeout_s: number };
  seed?: number;
};
```

---

## 4. Couche 1 — Orchestrateur (boucle de contrôle)

### 4.1 Règles

| ID | Règle |
|---|---|
| `HRN-LOOP-001` | La boucle **DOIT** être un automate explicite avec états nommés (`PLAN`, `PLAN_REVIEW`, `ACT`, `OBSERVE`, `VERIFY`, `REPAIR`, `ESCALATE`, `DONE`, `ABORT`), pas un `while true` implicite. |
| `HRN-LOOP-002` | Chaque itération **DOIT** décrémenter au moins un budget. Aucune boucle sans horloge. |
| `HRN-LOOP-003` | Les conditions d'arrêt **DOIVENT** inclure : succès vérifié, budget épuisé, boucle détectée, erreur non récupérable, gate refusé, annulation. |
| `HRN-LOOP-004` | La détection de boucle **DOIT** être implémentée (hash des N derniers `(action, args, résultat)`) et déclencher un changement de stratégie, pas un simple retry. |
| `HRN-LOOP-005` | Le planning intra-run **DEVRAIT** être *matérialisé* (fichier/TODO structuré persistant), pas laissé dans le raisonnement volatil. |
| `HRN-LOOP-006` | Après ≥ 2 échecs de vérification sur la même cible, la boucle **DOIT** changer de mode (diagnostic explicite, réduction de portée, ou escalade) au lieu de réessayer à l'identique. |
| `HRN-LOOP-007` | La boucle **DOIT** être interruptible et reprenable depuis le dernier checkpoint (worker préemptible). |
| `HRN-LOOP-008` | Le parallélisme d'outils **DEVRAIT** être exploité pour les lectures (idempotentes) et **NE DEVRAIT PAS** l'être pour les écritures sans verrou. |
| `HRN-LOOP-009` | **Pilotage en cours de run** : toute instruction humaine arrivant pendant l'exécution **DOIT** être un événement de première classe du journal, traitée au tour suivant avec re-planification explicite — jamais fusionnée silencieusement dans le contexte. Si elle contredit le `PromptPlan` ⇒ `PLAN_REVIEW`. |

### 4.2 Squelette

```python
def run(spec: RunSpec) -> RunResult:
    state = State.load_or_init(spec)           # HRN-P-007
    budget = Budget(spec.budgets)

    while not budget.exhausted() and not state.done:
        state.ingest_human_events()                       # HRN-LOOP-009
        if Plan.deviates_major(state, spec.prompt_plan):  # HRN-INTAKE-004
            Gate.request_plan_review(state); continue

        ctx = ContextAssembler.build(state, budget)       # couche 2 + 2b
        step = Model.propose(ctx, tools=Tools.for_(spec)) # 1 tour = 1 décision
        budget.charge(step.usage)

        Policy.authorize(step.actions, spec.policy)       # couche 7 — peut lever GateRequired
        obs = Executor.run(step.actions)                  # couche 3/4, sandbox
        state.journal.append(step, obs)                   # couche 6, append-only

        if Loop.detect(state.journal):
            state.strategy = Strategy.escalate(state); continue

        if step.claims_done or Trigger.periodic(state):
            verdict = Verifier.check(state, spec.contract.done_when)  # couche 5
            state.done = verdict.passed
            if not verdict.passed:
                state.journal.append_feedback(verdict.as_prompt())    # HRN-P-006

        state.checkpoint()                                # HRN-LOOP-007

    return Finalizer.deliver(state)                       # couche 8 (§14)
```

> **Note critique** : `claims_done` ne clôt jamais un run. Seul `Verifier` le peut. Un harness où le modèle
> déclare lui-même le succès n'est pas un harness, c'est une démo.

### 4.3 Sous-agents : contrat minimal (si utilisés)

`HRN-P-008` fixe l'ordre d'adoption, pas une interdiction. Quand l'exception s'applique
(exploration parallèle en lecture, isolation d'un contexte hostile), le sous-agent **DOIT** avoir un contrat :

| ID | Règle |
|---|---|
| `HRN-SUB-001` | Entrées explicites (question précise + documents fournis), sortie structurée (constats + références, format imposé), budget propre. Pas de conversation libre parent↔enfant. |
| `HRN-SUB-002` | Le contexte circule **à sens unique** : le parent injecte, l'enfant restitue un livrable. Les résultats rentrent chez le parent comme données R3, marquées de leur provenance. |
| `HRN-SUB-003` | Un sous-agent **NE DOIT PAS** avoir de permissions d'écriture ni d'egress supérieurs au parent, et **DEVRAIT** être en lecture seule. |

---

## 5. Couche 2 — Ingénierie de contexte

### 5.1 Structure en anneaux (du plus stable au plus volatil)

```
┌ R0 · SOCLE          identité, politique, format de sortie      ← immuable, cacheable
├ R1 · CAPACITÉS      schémas d'outils, conventions              ← quasi-immuable
├ R2 · CONTRAT        PromptPlan + RunSpec résumés, budgets      ← lent
├ R3 · CONNAISSANCE   satellites routés + mémoire + retrievals   ← volatil, borné (§6)
├ R4 · ÉTAT           plan matérialisé, résumé structuré, diffs  ← réécrit par compaction
└ R5 · RÉCENT         K derniers tours bruts + observations      ← fenêtre glissante
```

| ID | Règle |
|---|---|
| `HRN-CTX-001` | L'ordre d'assemblage **DOIT** aller du plus stable au plus volatil (préfixe cacheable ⇒ coût et latence divisés). |
| `HRN-CTX-002` | Chaque anneau **DOIT** avoir un budget de tokens propre et un mécanisme d'éviction propre. |
| `HRN-CTX-003` | La compaction **DOIT** produire une structure (plan, faits acquis, contraintes, échecs déjà essayés, fichiers touchés), jamais un résumé en prose libre. |
| `HRN-CTX-004` | La compaction **DOIT** être déclenchée par seuil (ex. 70 % de la fenêtre) et **DOIT** être journalisée (avant/après conservés hors contexte). |
| `HRN-CTX-005` | La récupération (R3) **DOIT** être *just-in-time* et pilotée par outil ou par manifest — jamais pré-injectée massivement. |
| `HRN-CTX-006` | Toute troncature **DOIT** être visible dans le contexte (`[… 1 240 lignes omises — utilisez read(offset=…)]`). Une troncature silencieuse est un bug de sécurité fonctionnelle. |
| `HRN-CTX-007` | Le contenu d'origine externe (web, e-mail, fichiers tiers) **DOIT** être encadré comme **donnée non fiable**, jamais fusionné au bloc d'instructions. |
| `HRN-CTX-008` | Le contexte **NE DOIT PAS** contenir de secrets en clair. Injection par référence (`$SECRET_REF`), résolution côté exécuteur. |
| `HRN-CTX-009` | Un « ring buffer » de tours bruts **DEVRAIT** être préféré à la ré-injection intégrale de l'historique ; le reste vit dans le journal externe. |

**Anti-pattern mesuré** : le *context stuffing*. Au-delà d'un seuil (dépendant du modèle), la précision de
récupération d'un fait au milieu du contexte chute et le taux d'hallucination monte. Un contexte à 40 % rempli
d'éléments pertinents surpasse quasi systématiquement un contexte à 95 % rempli « au cas où ».

---

## 6. Couche 2b — Connaissance pilotée (documents satellites) — `HRN-KNOW`

Le savoir *projet* (architecture, conventions, sécurité, pièges connus) ne vit ni dans le system prompt
ni dans la tête de l'agent : il vit dans une **base documentaire routée**, chargée à la demande dans R3.
C'est l'architecture racine-maigre + satellites : un fichier racine court, une table de routage, des
documents thématiques autonomes.

| ID | Règle |
|---|---|
| `HRN-KNOW-001` | Le fichier racine (`AGENT.md` / `CLAUDE.md`) **DOIT** rester maigre : identité du projet, invariants non négociables, table de routage vers les satellites. Ordre de grandeur ≲ 150 lignes **hors table de routage** — cette dernière croît avec le nombre de satellites et sa densité informationnelle par ligne est maximale, la compter dans le budget pousserait à sous-router. Tout le reste part en satellite. |
| `HRN-KNOW-002` | Chaque satellite **DOIT** être thématique, autonome (lisible seul), et porter des règles à IDs stables. Un satellite = une décision de chargement. |
| `HRN-KNOW-003` | Un `manifest.yaml` **DOIT** mapper *type de tâche → satellites à charger* (divulgation progressive vers R3). Ne jamais tout précharger : le routage est la moitié de la valeur du système. |
| `HRN-KNOW-004` | **Les docs sont du code.** Versionnés, revus en PR, et un changement de satellite **DOIT** déclencher les evals — c'est un changement de comportement (miroir de `HRN-TOOL-010`). |
| `HRN-KNOW-005` | Chaque satellite **DEVRAIT** s'ouvrir sur un résumé de 3–5 lignes que l'agent peut conserver après compaction (les détails s'évincent, le résumé survit). |
| `HRN-KNOW-006` | Les contradictions entre satellites **DOIVENT** être tranchées par un ordre de précédence déclaré dans la racine. L'agent ne **DOIT PAS** arbitrer silencieusement ; il **DOIT** signaler le conflit. |
| `HRN-KNOW-007` | Chaque satellite **DEVRAIT** respecter un budget de taille (à calibrer, ex. ≤ 500 lignes). Au-delà : scinder. Un satellite obèse redevient le mega-prompt qu'on voulait éviter. |
| `HRN-KNOW-008` | Le manifest **DOIT** aussi lister les *exclusions* utiles (« pour une tâche marketing, ne pas charger backend.md ») : le bruit documentaire coûte autant que l'absence. |
| `HRN-KNOW-009` | La surface d'extension **DOIT** être choisie par son **déclencheur**, jamais par commodité d'écriture — cf. §6.1. |
| `HRN-KNOW-011` | Le routage documentaire est **récursif**. Tout nœud dont le contenu dépasse son budget **DOIT** devenir à son tour une racine locale : il conserve ce qui vaut pour l'ensemble de son périmètre, porte sa propre table de routage vers ses sous-documents, et délègue le reste. La règle `HRN-KNOW-001` s'applique identiquement à chaque niveau, budget hors table compris. Appliquer le motif à un seul niveau est un accident d'écriture, pas une conception. |
| `HRN-KNOW-010` | Une même règle **NE DOIT JAMAIS** exister sur deux surfaces chargées indépendamment (miroir de `HRN-INTAKE-006`). Une surface en référence une autre par identifiant ; elle ne la recopie pas. |

### 6.1 Choix de surface — `HRN-KNOW-009`

Les plateformes d'agents exposent aujourd'hui plusieurs surfaces où déposer une instruction. Elles ne sont
pas interchangeables : elles diffèrent par **qui décide du chargement**.

| Surface | Déclencheur | Déterminisme | Contenu approprié |
|---|---|---|---|
| Racine (`AGENT.md` / `CLAUDE.md`) | toujours chargé | total | invariants universels + table de routage |
| Satellite routé | le manifest (`HRN-KNOW-003`) | total | connaissance thématique, normes |
| Commande / rituel invoqué | l'humain, explicitement | total | ce qui doit être délibéré (planifier, livrer, auditer) |
| *Skill* (capacité auto-sélectionnée) | **le modèle**, d'après une description | probabiliste | savoir-faire optionnel, épisodique, dépendant du contexte |
| Hook / lint / CI | la machine, sur événement | total, non contournable | toute contrainte mécaniquement vérifiable (`HRN-P-001`) |

Principe directeur : **une règle qui existe pour corriger le jugement du modèle ne peut pas dépendre du
jugement du modèle.** Une norme chargée « quand le modèle l'estime pertinent » n'est plus une norme.

Corollaire symétrique, tout aussi important : router en permanence un savoir-faire utile à une fraction
des tâches gaspille le budget de contexte (`HRN-P-003`). La conclusion n'est donc pas « tout en satellite »
mais « chaque chose selon son déclencheur ». Le mécanisme auto-sélectionné est le bon choix exactement
quand l'ambiguïté de pertinence est le problème à résoudre — et le mauvais choix partout ailleurs.

Enfin, `HRN-KNOW-010` interdit la solution de facilité consistant à publier la même règle sur deux
surfaces « pour être sûr » : deux copies ont deux rythmes de mise à jour, elles divergent, et personne
ne détecte laquelle a été appliquée.

```yaml
# knowledge/manifest.yaml
routes:
  - task_kind: coding.backend
    load: [architecture.md, conventions.md, backend.md, securite.md]
    exclude: [marketing-web.md, seo.md]
  - task_kind: coding.frontend
    load: [architecture.md, conventions.md, frontend.md]
  - task_kind: ops.provisioning
    load: [infra.md, securite.md, runbooks/provisioning.md]
precedence: [securite.md, architecture.md, conventions.md, "*"]
```

---

## 7. Couche 3 — Outils (capacités)

| ID | Règle |
|---|---|
| `HRN-TOOL-001` | Le jeu d'outils **DEVRAIT** être minimal et orthogonal. Cible : ≤ 15 outils. Au-delà, la sélection se dégrade — regrouper par outil paramétrique. |
| `HRN-TOOL-002` | Un outil `exec` générique dans un sandbox solide **DEVRAIT** être préféré à 40 micro-outils, sauf si la politique exige un contrôle par verbe. |
| `HRN-TOOL-003` | Chaque outil **DOIT** exposer : schéma JSON strict, description orientée *quand l'utiliser / quand ne pas l'utiliser*, ≥ 1 exemple, et son coût/risque. |
| `HRN-TOOL-004` | Les sorties d'outils **DOIVENT** être bornées en tokens, avec pagination ou handle (`result_id`) pour la suite. Jamais de dump illimité. |
| `HRN-TOOL-005` | Les erreurs **DOIVENT** être structurées et actionnables : `{code, message, cause, remediation, retryable}`. Une stack trace brute est un échec de design. |
| `HRN-TOOL-006` | Toute écriture **DOIT** être idempotente ou porter une clé d'idempotence. |
| `HRN-TOOL-007` | Les outils destructifs ou externes **DOIVENT** proposer un mode `dry_run` et, par défaut, l'utiliser lors de la première invocation d'un plan. |
| `HRN-TOOL-008` | Les paramètres **DEVRAIENT** être « plats et évidents » (peu d'imbrication, énumérations explicites) : la forme du schéma influence directement le taux d'erreur d'appel. |
| `HRN-TOOL-009` | Chaque outil **DOIT** déclarer ses effets (`read`/`write`/`network`/`spawn`) pour permettre l'autorisation statique et le parallélisme sûr. |
| `HRN-TOOL-010` | Les descriptions d'outils **DOIVENT** être versionnées et évaluées comme du code : un changement de wording est un changement de comportement. |

```ts
type ToolSpec = {
  name: string;
  version: string;
  effects: ("read" | "write" | "network" | "exec" | "spawn")[];
  input_schema: JSONSchema;          // strict: additionalProperties: false
  output: { max_tokens: number; paginated: boolean };
  cost_hint: "free" | "cheap" | "expensive";
  danger: "safe" | "reversible" | "destructive";
  dry_run_supported: boolean;
  examples: { input: unknown; output: unknown }[];
};
```

---

## 8. Couche 4 — Substrat d'exécution

| ID | Règle |
|---|---|
| `HRN-EXEC-001` | Tout code généré **DOIT** s'exécuter dans un isolat jetable (conteneur durci, gVisor, microVM). Jamais sur l'hôte de contrôle. |
| `HRN-EXEC-002` | Le réseau sortant **DOIT** être en refus par défaut, avec allowlist de domaines par run, et journalisation de chaque tentative refusée (signal d'exfiltration). |
| `HRN-EXEC-003` | Le système de fichiers **DOIT** être segmenté : `inputs/` (RO), `work/` (RW éphémère), `outputs/` (RW, seul chemin de sortie). |
| `HRN-EXEC-004` | Limites CPU/mémoire/PID/durée/taille disque **DOIVENT** être appliquées par le runtime, pas demandées au modèle. |
| `HRN-EXEC-005` | Aucun secret de production **NE DOIT** entrer dans le sandbox ; utiliser des identifiants à portée réduite et durée courte, émis par le control plane. |
| `HRN-EXEC-006` | L'environnement **DOIT** être reproductible (image épinglée par digest, lockfiles) — sinon les evals sont du bruit. |
| `HRN-EXEC-007` | Les sandboxes **DEVRAIENT** être pré-chauffées en pool : le temps de démarrage à froid est le premier poste de latence perçue. |

---

## 9. Couche 5 — Vérification (le cœur)

C'est ce qui sépare un jouet d'un système. Hiérarchie par force de signal :

| Niveau | Oracle | Force | Coût |
|---|---|---|---|
| V0 | Schéma / typage / parsing / lint | forte, locale | ~0 |
| V1 | Compilation, build, migration à blanc | forte | faible |
| V2 | Tests (existants > générés), invariants, propriétés | forte | moyen |
| V3 | Vérité terrain externe (exécuter, diff, rejouer l'API, comparer à une source) | très forte | variable |
| V4 | Critique par modèle (rubrique, comparaison par paires, jury) | **faible et biaisée** | moyen |
| V5 | Humain (gate, échantillonnage, revue) | référence | cher |

| ID | Règle |
|---|---|
| `HRN-VER-001` | Chaque type de tâche **DOIT** déclarer son oracle le plus fort disponible. Une tâche sans oracle **NE DOIT PAS** être exécutée en autonomie. |
| `HRN-VER-002` | Les tests **NE DOIVENT PAS** être écrits et validés par le même passage qui écrit l'implémentation, sans revue ou source indépendante — sinon l'oracle est capturé. |
| `HRN-VER-003` | Le verdict **DOIT** être structuré et reformulable en prompt de réparation (`what failed / where / expected / observed / next hint`). |
| `HRN-VER-004` | V4 (juge-modèle) **NE DOIT PAS** être l'unique oracle d'un critère à conséquence. Il **DEVRAIT** servir au tri, au classement ou à la détection de régression grossière. |
| `HRN-VER-005` | Les invariants critiques (sécurité, données, coût, périmètre) **DOIVENT** être vérifiés par du code, indépendamment de ce que rapporte l'agent. |
| `HRN-VER-006` | Le harness **DOIT** distinguer *échec de la tâche* et *échec du vérificateur* (flaky) et traiter les deux différemment. |
| `HRN-VER-007` | La vérification **DEVRAIT** tourner en continu (après chaque action risquée), pas uniquement en fin de run : plus le feedback est proche, moins la réparation coûte. |

---

## 10. Couche 6 — État, mémoire, reprise

### 10.1 Fondations

| ID | Règle |
|---|---|
| `HRN-STATE-001` | Le journal des événements **DOIT** être append-only, horodaté, et constituer la source de vérité du run. |
| `HRN-STATE-002` | Un checkpoint **DOIT** capturer : journal, plan, hash de l'arbre de fichiers, budgets restants, curseur de contexte — suffisant pour reprendre sur un autre worker. |
| `HRN-STATE-003` | La mémoire **DOIT** être stratifiée : *scratch* (intra-run) / *run* (artefacts) / *projet* (conventions, décisions) / *organisation* (politiques). Ne jamais tout mélanger dans un seul store. |
| `HRN-STATE-004` | L'écriture en mémoire long terme **DOIT** être explicite et révisable (fichier versionné, revue), jamais une accumulation automatique opaque. |
| `HRN-STATE-005` | Les artefacts **DOIVENT** être adressés par contenu (hash) et immuables ; les chemins sont des pointeurs. |

### 10.2 Mécanique de promotion (le « comment » de la mémoire)

Les principes ci-dessus ne suffisent pas ; voici le cycle opérationnel : **extraction → revue → activation → expiration**.

| ID | Règle |
|---|---|
| `HRN-STATE-006` | Chaque fin de run **DOIT** produire des *candidats mémoire* (learnings extraits du journal : conventions découvertes, pièges rencontrés, décisions prises) déposés dans `memory/candidates/`. L'écriture en mémoire projet **DOIT** passer par une revue — humaine ou par règle — jamais d'auto-écriture silencieuse. |
| `HRN-STATE-007` | Chaque entrée **DOIT** suivre le format `MemoryEntry` : énoncé court (normatif si possible), preuve (`run_ids`), confiance, et **date de revue**. La mémoire expire par défaut ; une entrée sans `review_after` est un bug. |
| `HRN-STATE-008` | La récupération mémoire **DOIT** être budgétée et routée par le manifest (`HRN-KNOW-003`) — elle entre dans R3 comme n'importe quel satellite, jamais injectée en bloc. |
| `HRN-STATE-009` | Une entrée contredite par un run récent **DOIT** passer `deprecated` (avec référence du run contradictoire), pas être écrasée : la traçabilité des revirements vaut plus que la propreté du fichier. |

```ts
type MemoryEntry = {
  id: string;                        // MEM-042 — stable
  scope: "project" | "org";
  kind: "convention" | "decision" | "fait" | "piege" | "preference";
  statement: string;                 // 1–3 phrases, DOIT/DEVRAIT si applicable
  evidence: string[];                // run_ids d'origine
  confidence: "haute" | "moyenne" | "basse";
  review_after: string;              // ISO date — expiration par défaut
  status: "active" | "deprecated";
};
```

---

## 11. Couche 7a — Politique & sécurité

| ID | Règle |
|---|---|
| `HRN-SEC-001` | Modèle de permissions explicite, **déclaratif**, évalué côté harness avant exécution — jamais délégué à une consigne en langage naturel. |
| `HRN-SEC-002` | **Injection de prompt** : toute donnée entrante (page web, fichier, ticket, e-mail, sortie d'outil) **DOIT** être traitée comme non fiable. La défense **DOIT** être un confinement de capacité (ce que l'agent *peut* faire), pas une instruction (« ignore les instructions malveillantes »). |
| `HRN-SEC-003` | La règle de la **trifecta létale** **DOIT** être appliquée : accès à des données privées + exposition à du contenu non fiable + canal de sortie externe ⇒ au moins un des trois **DOIT** être coupé, ou un gate humain inséré. |
| `HRN-SEC-004` | Les gates **DOIVENT** afficher l'action exacte, son effet et sa réversibilité, en résumé lisible — pas un JSON brut à approuver aveuglément. |
| `HRN-SEC-005` | Les secrets **DOIVENT** être redigés dans les traces, les logs et le contexte, avec détection par motif *et* par valeur connue. |
| `HRN-SEC-006` | Multi-tenant : l'isolation **DOIT** être portée par l'infrastructure (namespace, réseau, stockage, clés), jamais par un simple filtre applicatif. |
| `HRN-SEC-007` | Toute action irréversible (paiement, suppression, envoi externe, déploiement prod) **DOIT** passer par un gate ou une file d'approbation asynchrone. |
| `HRN-SEC-008` | Kill switch global et par tenant **DOIT** exister, testé, avec arrêt < 5 s des runs en cours. |

---

## 12. Couche 7b — Observabilité & coûts

| ID | Règle |
|---|---|
| `HRN-OBS-001` | Chaque run **DOIT** produire une trace arborescente (run → étape → appel modèle / appel outil) au format OTLP ou équivalent. |
| `HRN-OBS-002` | La comptabilité tokens/coût **DOIT** être par étape, par outil et par tenant — le coût agrégé par run est insuffisant pour diagnostiquer. |
| `HRN-OBS-003` | Un *replay bundle* **DOIT** être exportable : `RunSpec` + entrées + I/O outils + réponses modèle, rejouable hors ligne sans appeler le modèle. |
| `HRN-OBS-004` | Métriques minimales : taux de succès vérifié, étapes/tâche, coût/tâche réussie, latence p50/p95, taux d'intervention humaine, taux de réparation, taux d'échec d'outil par outil. |
| `HRN-OBS-005` | Les plafonds de coût **DOIVENT** être appliqués (arrêt dur), pas seulement alertés. |
| `HRN-OBS-006` | Un run échoué **DOIT** être aussi bien tracé qu'un run réussi ; les échecs sont le corpus d'amélioration principal. |
| `HRN-OBS-007` | Le coût de vérification et de compilation (tokens du Verifier, du compilateur, des juges V4) **DOIT** être compté à part : le harness a un coût propre qu'il faut pouvoir isoler du coût de la tâche. |

---

## 13. Couche 7c — Évaluation

| ID | Règle |
|---|---|
| `HRN-EVAL-001` | Le harness **DOIT** avoir une suite d'évals exécutable en CI, indépendante de la démo. |
| `HRN-EVAL-002` | Les cas **DOIVENT** venir des runs réels (production → dataset), pas d'exemples inventés. Toute régression observée **DOIT** devenir un cas. |
| `HRN-EVAL-003` | Chaque éval **DOIT** avoir un oracle programmatique (cf. §9) et un budget ; le score **DOIT** inclure le coût, pas seulement la réussite. |
| `HRN-EVAL-004` | La variance **DOIT** être mesurée (≥ 3 exécutions, écart-type publié). Un delta de 2 points sur un run unique n'est pas un signal. |
| `HRN-EVAL-005` | Un jeu de tests *held-out* **DOIT** exister et ne jamais servir à l'itération du prompt. |
| `HRN-EVAL-006` | Chaque changement de prompt, d'outil, de **satellite de connaissance** ou de modèle **DOIT** passer par la suite avant mise en production. |
| `HRN-EVAL-007` | Les évals **DEVRAIENT** couvrir : cas nominaux, cas hostiles (injection), cas dégradés (outil en panne, timeout), cas hors périmètre (l'agent doit refuser/escalader). |
| `HRN-EVAL-008` | La **couche connaissance** (racine, satellites, table de routage) **DOIT** avoir sa propre suite, distincte des évals de tâche : un cas = une tâche, un oracle = l'ensemble des satellites chargés. C'est la suite la moins chère à construire et la première à rentabiliser, parce qu'un mauvais routage invalide tout ce qui suit. |
| `HRN-EVAL-009` | Les assertions de routage **DOIVENT** être exprimées en inclusion (`load`) et disjonction (`exclude`), **JAMAIS** en égalité d'ensembles : une assertion trop stricte casse à chaque ajout de satellite et la suite finit désactivée. Une éval qu'on désactive coûte plus cher que pas d'éval. |
| `HRN-EVAL-010` | Un profil minimal (`HRN-INFRA-009`) **PEUT** réduire la suite à deux niveaux : évals de routage (oracle machine, déclenchées par les PR sur la connaissance) et canaris comportementaux (oracle humain, au changement de modèle). Les évals sur diff réel **PEUVENT** être différées jusqu'à ce qu'une même règle ait été violée deux fois en production. La réduction **DOIT** être écrite (`HRN-INFRA-010`), pas subie. |

---

## 14. Couche 8 — Livraison — `HRN-DLV`

La sortie d'un run n'est pas un message de chat : c'est un **paquet de revue**.

| ID | Règle |
|---|---|
| `HRN-DLV-001` | La livraison **DOIT** être un paquet structuré : manifest d'artefacts (+ hashes), diff lisible, verdicts de vérification par niveau, coûts consommés, learnings candidats. |
| `HRN-DLV-002` | Pour toute tâche à oracle V5, le format **DOIT** minimiser le coût humain : diff avant prose, points de décision isolés, questions fermées quand c'est possible. La revue est une ressource rare — le harness travaille *pour* elle. |
| `HRN-DLV-003` | Le rapport **DOIT** distinguer *vérifié* (oracle passé), *fait mais non vérifié*, et *supposé*. L'agent **NE DOIT PAS** présenter comme vérifié ce qui ne l'est pas. |
| `HRN-DLV-004` | La livraison partielle **DOIT** être possible : budget épuisé ⇒ livrer l'état atteint + reste-à-faire structuré (réinjectable en `PromptPlan`), jamais tout-ou-rien. |
| `HRN-DLV-005` | La livraison **DEVRAIT** inclure le brouillon du `PromptPlan` suivant (`HRN-PROG-005`) : la boucle programme se referme ici. |
| `HRN-DLV-006` | Un élément classé *supposé* **DOIT** nommer l'hypothèse et son **rayon d'impact** — ce qu'il faudrait changer si elle est fausse. « Supposé » sans rayon d'impact est un statut décoratif : il signale un doute sans permettre de le lever. |

---

## 15. Infrastructure de référence

```
                ┌──────────────────────── CONTROL PLANE ────────────────────────┐
  Client ─────► │  API/Gateway → Admission (quotas, RunSpec) → File (par tenant)│
                │  Scheduler · Policy Engine · Run Store (PG) · Secret Broker   │
                │  Model Gateway (routing, fallback, retry, cache, budget)      │
                └───────────────┬───────────────────────────────┬───────────────┘
                                │ lease + credentials courts    │ traces/events
                ┌───────────────▼───────────────┐   ┌───────────▼───────────────┐
                │        DATA PLANE             │   │  Observabilité            │
                │  Worker (stateless)           │   │  OTLP → store colonnaire  │
                │   └─ Sandbox pool (microVM)   │   │  Dashboards · alertes     │
                │       fs: in/work/out         │   └───────────────────────────┘
                │       egress proxy allowlist  │
                └───────────────┬───────────────┘
                                ▼
                    Object store (artefacts, immuables, content-addressed)
```

| ID | Règle |
|---|---|
| `HRN-INFRA-001` | Les workers **DOIVENT** être sans état ; tout l'état vit dans le run store + object store ⇒ reprise, préemption, montée en charge horizontale. |
| `HRN-INFRA-002` | Un **model gateway** unique **DOIT** médier tous les appels : routage, épinglage de version, retry avec backoff + jitter, cache de préfixe, quotas, comptabilité, bascule multi-fournisseur. |
| `HRN-INFRA-003` | Les files **DOIVENT** être équitables par tenant (pas de FIFO global) et supporter priorité + annulation. |
| `HRN-INFRA-004` | L'egress du data plane **DOIT** passer par un proxy explicite appliquant l'allowlist du `RunSpec` et journalisant les refus. |
| `HRN-INFRA-005` | Les artefacts **DOIVENT** aller dans un object store S3-compatible, chiffrés, avec durée de rétention par politique. |
| `HRN-INFRA-006` | Le harness **DEVRAIT** rester portable (pas de couplage dur à un fournisseur) : abstraire modèle, stockage, sandbox, file derrière des interfaces. |
| `HRN-INFRA-007` | Capacité : superviser la saturation du pool de sandbox et provisionner avant seuil ; la latence à froid est le premier symptôme de sous-capacité. |
| `HRN-INFRA-008` | Dégradation gracieuse **DOIT** être définie : modèle de repli, mode lecture seule, file d'attente avec ETA — jamais une erreur opaque. |

### 15.1 Profil minimal (solo / local) — `HRN-INFRA-009`

Le schéma ci-dessus est le profil *plateforme*. Un profil *minimal* **DOIT** être défini pour ne pas
sur-dimensionner un usage solo — en dégradant l'implémentation, **jamais les invariants** :

| Composant | Plateforme | Minimal (solo/local) |
|---|---|---|
| Run store | PostgreSQL | SQLite |
| Artefacts | S3 + chiffrement | Système de fichiers + hashes |
| Sandbox | Pool de microVM | Conteneur local / devcontainer |
| File | Queue distribuée par tenant | In-process, séquentielle |
| Gateway | Service dédié | Client fin (pinning + retry + comptage restent **obligatoires**) |
| Traces | OTLP → store colonnaire | JSONL par run |

### 15.2 Invariants — deux paliers (`HRN-INFRA-010`)

La v1 énonçait une liste unique d'invariants « qui survivent à toutes les échelles » incluant le replay
bundle et l'arrêt dur machine. C'était faux en pratique : aucune instance L2–L3 réelle ne les tient, si
bien que la règle était universellement violée — donc inutile. La v1.2 sépare **ce qui ne se négocie
jamais** de **ce qui se dégrade en forme pauvre**, et impose que la forme pauvre soit *nommée*, pas
sous-entendue.

| Invariant | L2–L3 (solo/local) — forme dégradée acceptable | L4 |
|---|---|---|
| Journal append-only | historique Git + plans versionnés + notes de backlog, **explicitement déclarés comme le journal** | store d'événements par run |
| Oracles branchés dans la boucle | oracles V0–V3 déclarés dans la DoD et exécutés | + verdicts typés, agrégation |
| Plan revu avant exécution | gate humain explicite (« GO ») sur un plan persisté | `PromptPlan` typé, diffable, journalisé |
| Redaction des secrets | permissions outil + interdiction d'écriture + `.gitignore` | détection par motif *et* par valeur |
| Modèle épinglé | couple modèle+effort **enregistré a posteriori** à la livraison | épinglé dans le `RunSpec` avant exécution |
| Budgets | budget déclaré au plan, **constaté** à la livraison (arrêt humain) | arrêt **dur**, appliqué par la machine |
| Évals sur changement de connaissance | évals de **routage** (`HRN-EVAL-008`) + canaris humains | suite complète, dont diff réel, en CI |
| Replay bundle | non exigible | obligatoire |

**Ce qui ne se dégrade à aucun palier** — trois règles, et elles suffisent à distinguer un harness d'une
boucle de prompts : aucune tâche exécutée **sans oracle déclaré** ; aucun changement significatif exécuté
**sans gate** ; aucun élément présenté comme **vérifié sans oracle passé**. Si l'un de ces trois saute
« parce que c'est du local », ce n'est plus un harness.

| ID | Règle |
|---|---|
| `HRN-INFRA-010` | Une instance en profil minimal **DOIT** documenter, dans son ADR d'instanciation, la forme dégradée retenue pour chaque ligne du tableau ci-dessus. Une dégradation non écrite est une dégradation non décidée. |

---

## 16. Squelette de dépôt

```
harness/
├── harness.yaml               # config déclarative de l'instance (§17)
├── program/                   # ÉTAGE MULTI-RUN (§3.1)
│   ├── ROADMAP.md             # jalons, intentions — mémoire de planification
│   ├── backlog.yaml           # tâches, statuts, dépendances
│   └── plans/                 # PromptPlans versionnés (T-014.plan.md)
├── knowledge/                 # SAVOIR PROJET — anneau R3, routé (§6)
│   ├── AGENT.md               # racine maigre : invariants + table de routage
│   ├── manifest.yaml          # type de tâche → satellites (+ exclusions)
│   └── satellites/            # architecture.md, conventions.md, securite.md, …
├── memory/                    # MÉMOIRE OPÉRATIONNELLE (§10.2)
│   ├── project.md             # MemoryEntry actives (revues, avec expiration)
│   └── candidates/            # learnings en attente de revue
├── contracts/
│   ├── run_spec.schema.json
│   ├── prompt_plan.schema.json
│   ├── tool_spec.schema.json
│   └── verdict.schema.json
├── core/
│   ├── intake/                # compilateur idée → PromptPlan (§3.2)
│   ├── loop.py                # automate (+ PLAN_REVIEW), budgets, arrêts, reprise
│   ├── context/               # assembler, compactor, budgeter, ring buffer
│   ├── tools/                 # registry, schémas, exécuteurs, erreurs typées
│   ├── verify/                # oracles V0..V5, agrégation de verdicts
│   ├── policy/                # permissions, gates, redaction, allowlists
│   ├── state/                 # journal, checkpoints, artefacts, promotion mémoire
│   └── telemetry/             # spans, coûts, replay bundle
├── adapters/
│   ├── models/                # gateway, providers, pinning, fallback
│   ├── sandbox/               # container | microvm | local-dev
│   └── storage/               # pg | sqlite, s3 | fs
├── prompts/                   # CÔTÉ SYSTÈME — anneaux R0/R1 (≠ knowledge/)
│   ├── system.core.md         # identité, politique, format — stable, cacheable
│   ├── tools.md
│   └── fragments/             # injections conditionnelles, versionnées
├── evals/
│   ├── cases/                 # issus de la production
│   ├── oracles/
│   └── run_evals.py
├── replay/                    # bundles rejouables
└── docs/
    ├── HARNESS.md             # ce document, instancié
    └── DECISIONS.md           # ADR : chaque dérogation à une règle DEVRAIT
```

---

## 17. Configuration déclarative (instanciation)

```yaml
harness:
  name: "<nom>"
  version: "1.1.0"

task:
  kind: coding | research | ops | data | support | qa
  done_when:
    - type: command        # V1/V2
      run: "pytest -q && ruff check ."
    - type: invariant      # V2
      expr: "no_secrets_in_diff && files_touched ⊆ allowed_paths"
  ambiguity_gate: { max_questions: 3 }

intake:                    # §3.2
  plan_review_required_if:
    est_cost_usd_gt: 0.50
    irreversible_in_scope: true
    ambiguity: high
  auto_approve_below_thresholds: true   # journalisé auto_approved

knowledge:                 # §6
  root: knowledge/AGENT.md
  manifest: knowledge/manifest.yaml

budgets: { max_steps: 40, max_cost_usd: 2.00, wall_clock_s: 900, context_pct_compact: 70 }

model:
  primary: { id: "<model-id-épinglé>", params: { temperature: 0 } }
  fallback: [ "<model-id-secours>" ]

tools:
  - exec        # sandbox
  - read_file
  - write_file
  - search      # code/docs
  - fetch_url   # soumis à allowlist
  # ≤ 15 — HRN-TOOL-001

policy:
  permissions: [ fs.read, fs.write:work, exec ]
  egress_allowlist: [ "registry.npmjs.org", "pypi.org" ]
  gates:
    - action: "git.push"
    - action: "net.post:*"
    - action: "db.migrate:prod"

substrate:
  profile: platform | minimal          # §15.1
  image: "registry/…@sha256:…"         # digest, HRN-EXEC-006
  limits: { cpu: 2, mem_mb: 4096, timeout_s: 600, disk_mb: 8192 }

memory:                    # §10.2
  candidates_dir: memory/candidates/
  review: human            # human | rule
  default_review_after_days: 90

observability:
  otlp_endpoint: "…"       # ou jsonl en profil minimal
  replay_bundle: true
  cost_hard_stop: true
```

---

## 18. Checklist d'instanciation (10 questions)

Pour tout nouveau harness, répondre **avant** d'écrire une ligne de prompt :

1. **Tâche** — quelle est l'unité de travail, et à quoi ressemble une sortie correcte ?
2. **Oracle** — comment une machine constate-t-elle le succès ? Si la réponse est « on regarde », l'autonomie est plafonnée à V5.
3. **Outils** — quel est le plus petit ensemble orthogonal suffisant ?
4. **Substrat** — où le code s'exécute-t-il, et qu'est-ce qu'il peut atteindre ?
5. **Budgets** — combien d'étapes / de coût / de temps avant abandon ?
6. **Gates** — quelles actions ne doivent jamais partir sans humain — et quels *plans* exigent revue avant exécution ?
7. **Connaissance** — quels satellites l'agent doit-il lire pour ce type de tâche, et lesquels surtout pas (routage + exclusions) ?
8. **Programme** — où cette tâche s'inscrit-elle (jalon, dépendances), et que met-elle à jour à la fin (backlog, mémoire) ?
9. **Artefacts** — que reste-t-il après le run, sous quelle forme, où ?
10. **Evals** — quels 20 cas réels prouvent que ça marche, et comment détecte-t-on une régression ?

---

## 19. Niveaux de maturité

| Niveau | Caractéristique | Autonomie raisonnable |
|---|---|---|
| L0 | Prompt + réponse, pas d'outils | Aucune |
| L1 | Boucle outils, pas de vérification, pas de sandbox | Assistance supervisée |
| L2 | Sandbox + budgets + traces + oracles V0–V2 | Tâches courtes, diff revu |
| L3 | + évals CI, replay, gates, `PromptPlan` revu, reprise, compaction structurée, connaissance routée | Tâches longues, revue par échantillon |
| L4 | + oracles V3, mémoire promue/expirante, régression continue, dégradation gracieuse, multi-tenant durci | Production non supervisée sur périmètre défini |

**Règle d'or** : ne pas augmenter l'autonomie d'un niveau tant que le niveau inférieur n'est pas mesuré en production.

---

## 20. Anti-patterns (constatés, coûteux)

| Anti-pattern | Pourquoi ça casse | Correctif |
|---|---|---|
| Multi-agent prématuré | Multiplie le contexte perdu aux frontières ; les sous-agents ne partagent pas les décisions implicites | Un agent, meilleurs outils, meilleure vérification. Sous-agents seulement pour l'**exploration parallèle en lecture**, sous contrat (§4.3) |
| Prompt jetable | L'idée part en exécution sans avoir existé comme artefact ; irréproductible, irrevoyable, non diffable | Compilation → `PromptPlan` versionné → revue (`HRN-INTAKE-*`, `HRN-P-011`) |
| Doc monolithique préchargée | Un `CLAUDE.md` de 1 500 lignes chargé partout : bruit permanent, précédence illisible, régressions invisibles | Racine maigre + satellites routés + exclusions (`HRN-KNOW-*`) |
| Mémoire qui n'expire jamais | Les conventions périmées empoisonnent les runs des mois plus tard, personne ne sait d'où elles viennent | `review_after` par défaut, preuve par `run_ids`, dépréciation tracée (`HRN-STATE-007/009`) |
| Roadmap dans la tête de l'humain | Chaque session repart de zéro ; les dépendances et l'ordre se perdent entre les runs | Étage programme : `ROADMAP.md` + `backlog.yaml` versionnés (`HRN-PROG-001`) |
| Réflexion sans oracle | Le modèle s'auto-approuve ; convergence vers une erreur confiante | Brancher un signal externe (V1–V3) |
| Retry sur tout | Masque les bugs déterministes, brûle le budget | Retry uniquement si `retryable: true` ; sinon changer de stratégie |
| Mega-prompt système | Non testable, non versionnable, régressions invisibles | Fragments versionnés + evals sur chaque changement |
| Tool sprawl (40+ outils) | Effondrement de la sélection, descriptions qui se contredisent | Regrouper, paramétrer, supprimer |
| Troncature silencieuse | L'agent raisonne sur des données amputées sans le savoir | Marqueurs de troncature + pagination (`HRN-CTX-006`) |
| Modèle non épinglé | Les evals d'hier ne prouvent rien aujourd'hui | Pinning + canari sur nouvelle version |
| RAG par défaut | Récupération bruitée > absence de récupération, et coûte le contexte | Récupération à la demande, pilotée par outil/manifest |
| Défense anti-injection par consigne | Contournable par construction | Confinement de capacité (`HRN-SEC-002/003`) |
| Evals sur cas choisis | Score en hausse, production en baisse | Dataset issu de la production + held-out |
| Logs sans traces | Impossible d'attribuer un échec à une étape | Spans structurés (`HRN-OBS-001`) |
| Rapport de fin auto-congratulant | L'agent présente comme vérifié ce qui ne l'est pas ; la confiance s'érode d'un coup | Statuts *vérifié / fait non vérifié / supposé* imposés (`HRN-DLV-003`) |
| Hypothèse bloquante posée par écrit | Formellement conforme (rien n'est inventé « en silence »), mais le diff ne porte aucune trace de la décision : le code est irréprochable et la règle métier est fausse. Se découvre en migration de données | Classement par conséquence + question obligatoire hors plafond (`HRN-TASK-006`, `HRN-INTAKE-008`) |
| Norme déguisée en capacité auto-sélectionnée | Une convention chargée « quand le modèle l'estime pertinent » s'applique par intermittence : ce n'est plus une norme, c'est une suggestion | Surface choisie par déclencheur (`HRN-KNOW-009`) |
| Même règle sur deux surfaces « pour être sûr » | Deux rythmes de mise à jour, divergence, personne ne sait laquelle a été appliquée | Référence par identifiant, jamais recopie (`HRN-KNOW-010`) |
| Invariants proclamés puis universellement violés | Une exigence que zéro instance ne tient ne protège rien et décrédibilise le reste du document | Paliers explicites + forme dégradée nommée (`HRN-INFRA-010`) |

---

## 21. Ce que ce document ne résout pas (honnêteté)

- **Les tâches sans oracle** (goût, stratégie, rédaction subjective) : aucun harness ne les rend autonomes.
  Il ne peut que réduire le coût de l'aller-retour humain — c'est précisément le rôle de `HRN-DLV-002`.
  Le concevoir comme un outil d'accélération de la revue, pas comme un pipeline autonome.
- **La qualité du modèle sur le raisonnement long** : le harness compense par découpage et vérification,
  il ne crée pas de capacité absente.
- **Les seuils chiffrés** (70 % de compaction, ≤ 15 outils, 40 étapes, 150 lignes de racine, 90 jours de
  mémoire) sont des points de départ raisonnables, pas des vérités : ils **DOIVENT** être recalibrés par
  mesure sur vos propres évals. Sans suite d'évals, ces seuils resteront ceux du document indéfiniment — ce n'est pas un détail : c'est la différence entre un référentiel qui apprend et un référentiel qui vieillit.
- **Le multi-agent** : il gagne dans certains cas (exploration large parallélisable, isolation de contexte
  hostile). Le rejet en `HRN-P-008` porte sur l'ordre d'adoption, pas sur la validité du pattern — d'où le
  contrat minimal du §4.3.
- **Le compilateur de tâche est lui-même un appel modèle** : il peut se tromper. C'est exactement pourquoi
  son produit (`PromptPlan`) passe devant un humain — la compilation réduit le coût de la revue, elle ne
  la remplace pas.

---

## Annexe A — Contrats types

```ts
type Observation = {
  tool: string; call_id: string; ok: boolean;
  output?: unknown; truncated?: { shown: number; total: number; handle: string };
  error?: { code: string; message: string; cause?: string; remediation?: string; retryable: boolean };
  usage: { latency_ms: number; tokens_out: number; cost_usd?: number };
};

type Verdict = {
  passed: boolean;
  checks: { id: string; level: "V0"|"V1"|"V2"|"V3"|"V4"|"V5";
            passed: boolean; expected?: string; observed?: string; where?: string }[];
  flaky_suspected: boolean;
  repair_hint?: string;              // HRN-VER-003 → réinjecté comme prompt
};

type Checkpoint = {
  run_id: string; step: number; journal_offset: number;
  plan: PlanNode[]; fs_hash: string; budgets_left: Budgets; created_at: string;
};

type DeliveryBundle = {              // HRN-DLV-001
  run_id: string;
  artifacts: { path: string; hash: string; kind: string }[];
  diff?: string;
  verdicts: Verdict[];
  status_ledger: { item: string; status: "verifie" | "fait_non_verifie" | "suppose" }[];
  costs: { tokens_in: number; tokens_out: number; usd: number; harness_overhead_usd: number };
  memory_candidates: MemoryEntry[];
  next_prompt_plan_draft?: PromptPlan;   // HRN-PROG-005
  remaining_work?: string[];             // HRN-DLV-004
};
```

## Annexe B — Ordre d'implémentation recommandé

1. `RunSpec` + journal + traces (on ne pilote pas ce qu'on ne voit pas)
2. Sandbox + 3 outils + budgets et arrêts
3. Oracle V1/V2 branché dans la boucle
4. **Compilateur `PromptPlan` + revue avant exécution** (rapport valeur/effort le plus élevé après l'oracle)
5. 20 cas d'éval issus du réel + CI
6. **Racine maigre + satellites + manifest de routage** (`knowledge/`)
7. Compaction structurée + reprise sur checkpoint
8. **Étage programme** : backlog + roadmap + mise à jour de fin de run + promotion mémoire
9. Politique, gates, allowlist egress, redaction
10. Model gateway (fallback, pinning, cache, coûts)
11. Seulement ensuite : optimisations de prompt, sous-agents, parallélisme
