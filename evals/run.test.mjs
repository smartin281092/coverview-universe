import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { providerCommand, parseAnswers, scoreAnswers, invokeProvider, resolveCommand } from "./run.mjs";

test("Codex reçoit le modèle et Ultra explicitement, le prompt par stdin", () => {
  const command = providerCommand({}, "C:/temp/answer with spaces.txt");
  assert.equal(command.model, "gpt-6-astra");
  assert.equal(command.effort, "ultra");
  assert.ok(command.args.includes('model_reasoning_effort="ultra"'));
  assert.ok(command.args.includes("read-only"));
  assert.equal(command.args.at(-1), "-");
  assert.equal(command.args.at(-2), "C:/temp/answer with spaces.txt");
});

test("Claude reste disponible et une surcharge exige un tableau d'arguments", () => {
  assert.equal(providerCommand({ EVAL_PROVIDER: "claude", EVAL_MODEL: "model-explicite" }).bin, "claude");
  assert.throws(() => providerCommand({ EVAL_CMD: "codex --model anything" }), /EVAL_CMD retiré/);
  assert.throws(() => providerCommand({ EVAL_EXECUTABLE: "node" }), /ensemble/);
  assert.throws(() => providerCommand({ EVAL_EXECUTABLE: "node", EVAL_ARGS_JSON: '{"wrong":true}' }), /tableau/);
});

test("un satellite inventé, une réponse absente ou dupliquée échouent", () => {
  const corpus = [{ id: "R-001", load: ["data.md"], exclude: ["design.md"] }, { id: "R-002", load: [] }];
  assert.throws(() => parseAnswers('[{"id":"R-001","load":[]},{"id":"R-001","load":[]}]', corpus), /dupliqué/);
  assert.throws(() => parseAnswers('préface [{"id":"R-001","load":[]}]', corpus), /parsable/);
  const result = scoreAnswers(parseAnswers('[{"id":"R-001","load":["docs/data.md","invented.md"]}]', corpus), ["data.md", "design.md"], corpus);
  assert.deepEqual(result.map((r) => r.passed), [false, false]);
  assert.deepEqual(result[0].unknown, ["invented.md"]);
  assert.equal(result[1].absent, true);
});

test("le fournisseur reçoit les espaces, substitutions et stdin sans shell", () => {
  const root = mkdtempSync(join(tmpdir(), "coverview-eval-test-"));
  try {
    const runner = join(root, "fake provider.mjs");
    writeFileSync(runner, 'let input="";for await(const chunk of process.stdin)input+=chunk;process.stdout.write(JSON.stringify({args:process.argv.slice(2),input}));');
    const args = [runner, "literal $(whoami) `echo secret` & ; a b"];
    const response = invokeProvider({ provider: "custom", bin: process.execPath, args }, "only the routing prompt", root);
    assert.deepEqual(JSON.parse(response), { args: args.slice(1), input: "only the routing prompt" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Ultra incompatible produit une erreur dédiée sans nouvelle tentative", () => {
  assert.throws(() => invokeProvider({ provider: "custom", bin: process.execPath, args: ["-e", 'process.stderr.write("unknown variant ultra");process.exit(1)'] }, "prompt"), /refuse Ultra/);
});

test("un exécutable absolu évite les shims Windows", () => {
  const command = { bin: process.execPath, args: ["--version"] };
  assert.deepEqual(resolveCommand(command, "win32", { PATH: "" }), command);
});

test("une fixture vide échoue sans lancer de CLI ni polluer l'historique modèle", () => {
  const root = mkdtempSync(join(tmpdir(), "coverview-eval-fixture-"));
  const history = new URL("./history.jsonl", import.meta.url);
  const before = existsSync(history) ? statSync(history).mtimeMs : null;
  try {
    const fixture = join(root, "empty answer.json");
    writeFileSync(fixture, "[]");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./run.mjs", import.meta.url)), "--fixture", fixture], { encoding: "utf8", shell: false, windowsHide: true, timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Fixture hors ligne/);
    assert.equal(existsSync(history) ? statSync(history).mtimeMs : null, before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
