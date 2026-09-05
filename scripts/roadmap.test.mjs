import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  compileCoverage,
  resolveRanges,
  safePath,
  sortSlices,
  validateModel,
} from "./roadmap-lib.mjs";

// Small independent examples exercise planning integrity, not the generated text
// or the production inventory. They do not claim a product implementation works.
const units = [
  { id: "source.heading", kind: "heading", source_anchors: ["p0009"] },
  { id: "source.first", kind: "paragraph", source_anchors: ["p0010"] },
  { id: "source.second", kind: "paragraph", source_anchors: ["p0011"] },
];
const inventory = { sha256: "synthetic-inventory", units };
const knownQuestions = "| bible.question.020 | Profils de calcul |";

function slice(id = "S-001", overrides = {}) {
  return {
    id,
    title: "Consulter un résultat autorisé",
    milestone: "M1",
    objective: "Le client retrouve son résultat sauvegardé.",
    depends_on: [],
    apps: ["api", "client"],
    modules: ["simulation"],
    mode: "local-fixtures",
    priority: 10,
    session_budget: 1,
    journey: ["Ouvrir son résultat et consulter sa source."],
    data: ["Un résultat versionné."],
    permissions: ["Un résultat tiers est refusé côté serveur."],
    events_jobs: [],
    fixtures: ["Deux propriétaires de résultats distincts."],
    integrations: { simulated: [], real: [], activation_slices: [] },
    criteria: [
      {
        criterion: "Le résultat appartient au client autorisé.",
        source_ranges: [[10, 10]],
        oracle: "V2",
        test: "Refuser la lecture du résultat du second client.",
      },
    ],
    questions: [],
    satellites: [],
    exclusions: [],
    risks: ["Lecture croisée de données privées."],
    out_of_scope: [],
    split_trigger: "Scinder à la création du prochain scénario.",
    ...overrides,
  };
}

function state(entries = {}) {
  return { schema_version: 1, slices: entries };
}

function question(ref = "bible.question.020") {
  return {
    ref,
    question: "Valider le profil avant un résultat personnel ?",
    options: ["Attendre la validation du profil", "Fournir un profil approuvé"],
    recommended: 0,
    blocks: "Les résultats personnels du profil.",
  };
}

function validate(slices, programState = state()) {
  return validateModel(slices, units, programState, knownQuestions);
}

test("les dépendances passent avant la priorité et une roadmap spécifiée reste valide", () => {
  const parent = slice("S-001", { priority: 100 });
  const child = slice("S-002", { depends_on: [parent.id], priority: 1 });
  assert.deepEqual(validate([child, parent]).map((entry) => entry.id), [parent.id, child.id]);
});

test("un cycle ne peut devenir un ordre d'exécution", () => {
  assert.throws(
    () => sortSlices([
      slice("S-001", { depends_on: ["S-002"] }),
      slice("S-002", { depends_on: ["S-001"] }),
    ]),
    /Cycle/i,
  );
});

test("une dépendance absente ou un identifiant de slice dupliqué est refusé", () => {
  assert.throws(() => sortSlices([slice("S-001", { depends_on: ["S-999"] })]), /Dépendance inconnue/i);
  assert.throws(() => sortSlices([slice(), slice()]), /dupliqués/i);
});

test("les plages mal formées, inversées, hors bible et sans source sont refusées", () => {
  for (const ranges of [null, [[0, 10]], [[11, 10]], [[10.5, 11]], [[10]], [[10, 3063]], [[20, 21]]]) {
    assert.throws(() => resolveRanges(units, ranges), /Plage/i, JSON.stringify(ranges));
  }
  assert.deepEqual(resolveRanges(units, [[10, 11]]), ["source.first", "source.second"]);
  assert.deepEqual(resolveRanges(units, []), []); // User-sourced foundation criteria can have no bible range.
});

test("une plage invalide est aussi rejetée à la frontière du modèle", () => {
  const entry = slice();
  entry.criteria[0].source_ranges = [[11, 10]];
  assert.throws(() => validate([entry]), /Plage invalide/i);
});

test("les identifiants source dupliqués ne gonflent pas la couverture", () => {
  const duplicate = { ...inventory, units: [...units, units[1]] };
  assert.throws(() => compileCoverage([slice()], duplicate, [], []), /IDs source dupliqués/i);
});

test("une intégration ne peut promettre une activation absente ou réflexive", () => {
  for (const id of ["S-999", "S-001"]) {
    const entry = slice();
    entry.integrations.activation_slices = [id];
    assert.throws(() => validate([entry]), /activation inconnue ou réflexive/i);
  }
  const entry = slice();
  entry.integrations.activation_slices = ["S-002"];
  assert.doesNotThrow(() => validate([entry, slice("S-002", { mode: "integration" })]));
});

test("une question métier inconnue n'est pas une référence recevable", () => {
  assert.throws(() => validate([slice("S-001", { questions: [question("bible.question.999")] })]), /question invalide/i);
  assert.doesNotThrow(() => validate([slice("S-001", { questions: [question()] })]));
});

test("une référence de question tronquée ne correspond pas à un autre identifiant", () => {
  assert.throws(() => validate([slice("S-001", { questions: [question("bible.question.02")] })]), /question invalide/i);
});

test("un défaut proposé doit désigner une option existante", () => {
  const invalid = question();
  invalid.recommended = 2;
  assert.throws(() => validate([slice("S-001", { questions: [invalid] })]), /défaut\/options invalides/i);
});

test("WIP=1 interdit deux exécutions propriétaires même approuvées", () => {
  assert.throws(
    () => validate([slice("S-001"), slice("S-002")], state({
      "S-001": { status: "running", approval: "GO S-001" },
      "S-002": { status: "running", approval: "GO S-002" },
    })),
    /Plusieurs slices running/i,
  );
});

test("ready, running, review et done exigent une autorisation enregistrée", () => {
  for (const status of ["ready", "running", "review", "done"]) {
    assert.throws(
      () => validate([slice()], state({ "S-001": { status, approval: "  " } })),
      /autorisation effective absente/i,
      status,
    );
  }
  assert.doesNotThrow(() => validate([slice()], state({ "S-001": { status: "specified" } })));
});

test("un GO nu ne résout aucune question bloquante avant ready ou exécution", () => {
  const entry = slice("S-001", { questions: [question()] });
  for (const status of ["ready", "running", "review", "done"]) {
    assert.throws(
      () => validate([entry], state({ "S-001": { status, approval: "GO S-001" } })),
      /réponse et preuve absentes/i,
      status,
    );
  }
  assert.doesNotThrow(() => validate([entry], state({ "S-001": { status: "specified" } })));
});

test("une décision répond à la question exacte et conserve réponse et preuve", () => {
  const pending = question();
  const entry = slice("S-001", { questions: [pending] });
  const decision = {
    ref: pending.ref,
    question: pending.question,
    answer: "Attendre la validation du profil.",
    evidence: "Décision fournie par le porteur dans le plan approuvé.",
  };
  const programState = state({
    "S-001": { status: "ready", approval: "GO S-001 · réponse consignée", decisions: [decision] },
  });
  assert.doesNotThrow(() => validate([entry], programState));

  for (const change of [
    { ref: "bible.question.999" },
    { question: "Une ancienne formulation désormais différente ?" },
    { answer: " " },
    { evidence: " " },
  ]) {
    const invalid = structuredClone(programState);
    Object.assign(invalid.slices["S-001"].decisions[0], change);
    assert.throws(() => validate([entry], invalid), /réponse et preuve absentes/i);
  }
});

test("deux questions distinctes du même groupe source nécessitent deux décisions", () => {
  const first = question();
  const second = { ...question(), question: "Quelle preuve valide la convergence ?" };
  const entry = slice("S-001", { questions: [first, second] });
  const programState = state({ "S-001": {
    status: "ready",
    approval: "GO S-001 · décisions enregistrées",
    decisions: [{ ref: first.ref, question: first.question, answer: "Option proposée acceptée.", evidence: "Réponse du porteur." }],
  } });
  assert.throws(() => validate([entry], programState), /réponse et preuve absentes/i);
  programState.slices["S-001"].decisions.push({
    ref: second.ref, question: second.question, answer: "Cas indépendants validés.", evidence: "Réponse spécifique au second arbitrage.",
  });
  assert.doesNotThrow(() => validate([entry], programState));
});

test("une slice ne démarre qu'après la fin effective de toutes ses dépendances", () => {
  const slices = [slice(), slice("S-002", { depends_on: ["S-001"] })];
  const programState = state({
    "S-001": { status: "specified" },
    "S-002": { status: "running", approval: "GO S-002" },
  });
  assert.throws(() => validate(slices, programState), /dépendances non terminées/i);
  programState.slices["S-001"] = { status: "done", approval: "GO S-001" };
  assert.doesNotThrow(() => validate(slices, programState));
});

test("les statuts ou slices inconnus ne peuvent entrer dans l'état du programme", () => {
  assert.throws(() => validate([slice()], state({ "S-999": { status: "specified" } })), /État de slice inconnu\/invalide/i);
  assert.throws(() => validate([slice()], state({ "S-001": { status: "shipped" } })), /État de slice inconnu\/invalide/i);
});

test("une même source ne peut être à la fois contexte et implémentation", () => {
  assert.throws(
    () => compileCoverage([slice()], inventory, [], [{ source_ids: ["source.first"], reason: "Simple contexte." }]),
    /contexte et ailleurs/i,
  );
  assert.throws(
    () => compileCoverage([slice()], inventory, [], [
      { source_ids: ["source.second"], reason: "Contexte." },
      { source_ids: ["source.second"], reason: "Encore contexte." },
    ]),
    /contexte et ailleurs/i,
  );
});

test("un lien source complémentaire doit nommer un vrai critère et sa raison", () => {
  for (const link of [
    { source_ranges: [[11, 11]], reason: "Même comportement documenté ailleurs." },
    { criterion_ref: "S-999-C01", source_ranges: [[11, 11]], reason: "Référence absente." },
    { criterion_ref: "S-001-C01", source_ranges: [[11, 11]], reason: "" },
  ]) {
    assert.throws(() => compileCoverage([slice()], inventory, [link], []), /Lien complémentaire invalide/i);
  }
});

test("la couverture distingue source attribuée, contexte et reste à traiter", () => {
  const partial = compileCoverage([slice()], inventory, [], [
    { source_ids: ["source.heading"], reason: "Titre structurel de la source." },
  ]);
  assert.equal(partial.summary.assigned_units, 2);
  assert.equal(partial.summary.implementation_units, 1);
  assert.deepEqual(partial.unassigned, ["source.second"]);

  const complete = compileCoverage([slice()], inventory, [{
    criterion_ref: "S-001-C01",
    source_ranges: [[11, 11]],
    reason: "Le même comportement est rappelé à cet ancrage.",
  }], [{ source_ids: ["source.heading"], reason: "Titre structurel de la source." }]);
  assert.equal(complete.summary.assigned_units, 3);
  assert.equal(complete.summary.criteria, 1);
  assert.deepEqual(complete.unassigned, []);
  assert.deepEqual(complete.assignments[0].source_ids, ["source.first", "source.second"]);
  assert.match(complete.meaning, /aucune preuve d’implémentation/i);
});

test("un chemin d'artefact ne peut sortir du dépôt", () => {
  const root = resolve("planning-root");
  assert.equal(safePath(root, "roadmap/state.json"), resolve(root, "roadmap/state.json"));
  assert.throws(() => safePath(root, "../outside.json"), /hors dépôt/i);
});
