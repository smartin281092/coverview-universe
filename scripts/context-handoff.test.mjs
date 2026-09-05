import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handoffPath, main, validateHandoff, resumePrompt } from "./context-handoff.mjs";

test("un checkpoint incomplet ne produit pas un prompt de reprise", () => {
  const template = readFileSync(new URL("../templates/session-handoff.md", import.meta.url), "utf8");
  assert.throws(() => validateHandoff(template), /incomplet/);
  assert.doesNotThrow(() => validateHandoff(template.replace(/\{\{[^}]+\}\}/g, "aucun")));
  assert.throws(() => validateHandoff("court"), /Section/);
  assert.throws(() => validateHandoff("x".repeat(12001)), /trop long/);
});

test("création bornée au dépôt, sans écrasement ni mesure inventée", () => {
  const root = mkdtempSync(join(tmpdir(), "coverview-handoff-"));
  try {
    mkdirSync(join(root, "templates"));
    writeFileSync(join(root, "templates/session-handoff.md"), readFileSync(new URL("../templates/session-handoff.md", import.meta.url)));
    assert.throws(() => handoffPath(root, "../outside.md"), /roadmap/);
    assert.throws(() => handoffPath(root, "roadmap/handoffs/../../outside.md"), /roadmap/);
    assert.throws(() => main(["init", "roadmap/handoffs/invalid.md", "101"], root), /Pourcentage/);
    main(["init", "roadmap/handoffs/test.md"], root);
    assert.match(readFileSync(join(root, "roadmap/handoffs/test.md"), "utf8"), /non disponible/);
    assert.throws(() => main(["init", "roadmap/handoffs/test.md"], root), /EEXIST/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("le prompt référence le checkpoint et la session canonique sans recopier l'historique", () => {
  const prompt = resumePrompt("roadmap/handoffs/test.md");
  assert.match(prompt, /contexte propre/);
  assert.match(prompt, /PROG-12/);
  assert.match(prompt, /roadmap\/handoffs\/test.md/);
});
