import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  childEnvironment,
  control,
  endpoint,
  portAvailable,
  probe,
  requireLocal,
} from "./preview.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRANSIENT = mkdtempSync(join(tmpdir(), "coverview-preview-tests-"));
after(() => {
  rmdirSync(TRANSIENT);
});

test("seule l'API hérite des secrets d'identité, sans mutation de l'environnement parent", () => {
  const environment = {
    PATH: "runtime",
    AUTH_ENABLED: "true",
    WORKOS_CLIENT_ID: "client_example",
    WORKOS_API_KEY: "FAKE_FOR_ENV_SELECTION",
    AUTH_SESSION_SECRET: "FAKE_FOR_ENV_SELECTION",
    workos_api_key: "FAKE_CASE_VARIANT",
  };
  const original = { ...environment };
  assert.deepEqual(childEnvironment("api", environment), original);
  for (const key of ["client", "admin", "www", "infrastructure", "control"]) {
    assert.deepEqual(childEnvironment(key, environment), {
      PATH: "runtime",
      AUTH_ENABLED: "true",
      WORKOS_CLIENT_ID: "client_example",
    });
  }
  assert.deepEqual(environment, original);
});

async function listener(handler = (_request, response) => response.end("ok")) {
  const server = createServer(handler);
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    server,
    port: server.address().port,
    close: () => new Promise((done) => server.close(done)),
  };
}

async function fixture({
  status = 200,
  infrastructureExit = 0,
  toolExit,
  tool = "fixture-tool",
  port,
  longPath = false,
} = {}) {
  if (!port) {
    const temporary = await listener();
    port = temporary.port;
    await temporary.close();
  }
  const base = mkdtempSync(join(TRANSIENT, "test-"));
  const root = longPath
    ? join(base, "nested-workspace-".repeat(4), "another-segment-".repeat(2))
    : base;
  const packageDir = join(root, "app", "node_modules", tool);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: tool, type: "module", bin: "cli.mjs" }),
  );
  writeFileSync(
    join(packageDir, "cli.mjs"),
    toolExit === undefined
      ? `import {createServer} from 'node:http'; createServer((_q,r)=>{r.statusCode=${status};r.end(JSON.stringify({astroBackground:process.env.ASTRO_DEV_BACKGROUND??null}));}).listen(Number(process.env.PORT),'127.0.0.1');`
      : `process.exit(${toolExit});`,
  );
  writeFileSync(
    join(root, "infra.mjs"),
    `import {appendFileSync} from 'node:fs'; appendFileSync('infra-calls.jsonl', JSON.stringify(process.argv.slice(2))+'\\n'); process.exit(${infrastructureExit});`,
  );
  writeFileSync(
    join(root, "preview.config.mjs"),
    `export const infrastructure = ${JSON.stringify({ command: process.execPath, args: [join(root, "infra.mjs")] })}; export const apps = ${JSON.stringify([{ key: "fixture", label: "Fixture", dir: "app", port, tool, args: [] }])}; export const startTimeoutMs=2500;`,
  );
  writeFileSync(
    join(root, "runner.mjs"),
    `import {main} from ${JSON.stringify(pathToFileURL(join(ROOT, "scripts", "preview.mjs")).href)}; try {await main(process.argv.slice(2),${JSON.stringify(root)});} catch(e) {console.error(e.message);process.exitCode=1;}`,
  );
  const run = (args, environment = {}) =>
    new Promise((done, reject) => {
      const child = spawn(process.execPath, [join(root, "runner.mjs"), ...args], {
        cwd: root,
        windowsHide: true,
        env: {
          ...process.env,
          APP_ENV: "local",
          NODE_ENV: "development",
          ASTRO_DEV_BACKGROUND: undefined,
          ...environment,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.once("error", reject);
      child.once("exit", (code) => done({ code, output }));
    });
  return {
    root,
    port,
    run,
    records: () => JSON.parse(readFileSync(join(root, ".preview", "pids.json"), "utf8")),
    cleanup: async () => {
      await run(["stop"]);
      assert.equal(
        await portAvailable(port),
        true,
        "Les processus de test doivent avoir libéré leur port avant nettoyage.",
      );
      const confined = relative(TRANSIENT, base);
      assert.ok(confined && !confined.startsWith("..") && !confined.includes(":"));
      rmSync(base, { recursive: true, force: true });
    },
  };
}

test("APP_ENV absent, staging, production et NODE_ENV seul refusés", () => {
  for (const environment of [
    {},
    { NODE_ENV: "development" },
    { APP_ENV: "staging" },
    { APP_ENV: "production" },
    { APP_ENV: "local", NODE_ENV: "production" },
  ]) {
    assert.throws(() => requireLocal(environment), /REFUSÉ/);
  }
  for (const APP_ENV of ["local", "development"])
    assert.doesNotThrow(() => requireLocal({ APP_ENV }));
});

test("la CLI refuse une configuration déployée avant de lancer quoi que ce soit", async () => {
  const item = await fixture();
  try {
    for (const environment of [
      { APP_ENV: undefined },
      { APP_ENV: "production" },
      { NODE_ENV: "production" },
    ]) {
      const result = await item.run(["start"], environment);
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /REFUSÉ/);
      assert.equal(existsSync(join(item.root, "infra-calls.jsonl")), false);
    }
  } finally {
    await item.cleanup();
  }
});

test("le probe exige un 2xx et refuse erreurs et redirections", async () => {
  const endpoint = await listener((request, response) => {
    response.statusCode = Number(request.url.slice(1));
    if (response.statusCode === 302) response.setHeader("Location", "/200");
    response.end();
  });
  try {
    assert.equal(await probe(`http://127.0.0.1:${endpoint.port}/200`), true);
    for (const status of [302, 404, 500, 503])
      assert.equal(await probe(`http://127.0.0.1:${endpoint.port}/${status}`), false);
    assert.equal(await portAvailable(endpoint.port), false);
  } finally {
    await endpoint.close();
  }
});

test("deux cycles start/start/stop conservent les PID puis libèrent les ports", async () => {
  const item = await fixture();
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const start = await item.run(["start"]);
      assert.equal(start.code, 0, start.output);
      const records = item.records();
      assert.ok(await control(item.root, records.fixture));
      assert.equal(
        await control(item.root, { ...records.fixture, pid: process.pid }),
        null,
        "Un PID réattribué ne prouve pas l'appartenance.",
      );
      assert.equal(await control(item.root, { pid: process.pid, token: randomUUID() }), null);
      const restart = await item.run(["start"]);
      assert.equal(restart.code, 0, restart.output);
      assert.deepEqual(item.records(), records);
      assert.equal((await item.run(["status"])).code, 0);
      const stop = await item.run(["stop"]);
      assert.equal(stop.code, 0, stop.output);
      assert.deepEqual(item.records(), {});
      assert.equal(await portAvailable(item.port), true);
      assert.equal((await item.run(["stop"])).code, 0);
    }
    assert.equal((await item.run(["stop", "--all"])).code, 0);
    const calls = readFileSync(join(item.root, "infra-calls.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.deepEqual(calls.at(-1), ["stop"]);
  } finally {
    await item.cleanup();
  }
});

test("un checkout au chemin long garde un canal court, privé et nettoyé", async () => {
  const item = await fixture({ longPath: true });
  try {
    assert.ok(Buffer.byteLength(join(item.root, ".preview", `${randomUUID()}.sock`)) > 107);
    for (const platform of ["linux", "darwin"]) {
      const path = endpoint(item.root, randomUUID(), platform);
      assert.ok(Buffer.byteLength(path) < 103, `${platform} : ${path}`);
    }
    for (let cycle = 0; cycle < 2; cycle++) {
      const start = await item.run(["start"]);
      assert.equal(start.code, 0, start.output);
      const record = item.records().fixture;
      assert.ok(await control(item.root, record));
      if (process.platform !== "win32") {
        const metadata = lstatSync(dirname(endpoint(item.root, record.token)));
        assert.equal(metadata.mode & 0o777, 0o700);
        assert.equal(metadata.uid, process.getuid());
      }
      assert.equal((await item.run(["start"])).code, 0);
      assert.deepEqual(item.records().fixture, record);
      const stop = await item.run(["stop"]);
      assert.equal(stop.code, 0, stop.output);
      assert.equal(await portAvailable(item.port), true);
      if (process.platform !== "win32")
        assert.equal(existsSync(dirname(endpoint(item.root, record.token))), false);
    }
  } finally {
    await item.cleanup();
  }
});

test("un port étranger est refusé avant Docker et le processus reste vivant", async () => {
  const foreign = await listener();
  const item = await fixture({ port: foreign.port });
  try {
    const result = await item.run(["start"]);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /port .* occupé/);
    assert.equal(existsSync(join(item.root, "infra-calls.jsonl")), false);
    assert.equal(await probe(`http://127.0.0.1:${foreign.port}`), true);
  } finally {
    await foreign.close();
    await item.cleanup();
  }
});

test("Astro reçoit le marqueur qui empêche son détachement automatique, les autres outils non", async () => {
  for (const tool of ["astro", "fixture-tool"]) {
    const item = await fixture({ tool });
    try {
      const result = await item.run(["start"]);
      assert.equal(result.code, 0, result.output);
      const response = await fetch(`http://127.0.0.1:${item.port}`);
      assert.deepEqual(await response.json(), { astroBackground: tool === "astro" ? "1" : null });
    } finally {
      await item.cleanup();
    }
  }
});

test("échec infrastructure, processus terminé et probe en erreur rendent un code non nul", async () => {
  for (const scenario of [{ infrastructureExit: 7 }, { toolExit: 4 }, { status: 503 }]) {
    const item = await fixture(scenario);
    try {
      const result = await item.run(["start"]);
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /échoué|superviseur terminé|Probe en échec/);
      assert.equal(await portAvailable(item.port), true);
      assert.equal((await item.run(["status"])).code, 1);
    } finally {
      await item.cleanup();
    }
  }
});

test("un ancien PID étranger n'est jamais tué par stop", async () => {
  const item = await fixture();
  try {
    mkdirSync(join(item.root, ".preview"));
    writeFileSync(
      join(item.root, ".preview", "pids.json"),
      JSON.stringify({ fixture: { pid: process.pid, token: randomUUID() } }),
    );
    const result = await item.run(["stop"]);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /aucun PID arrêté/);
    assert.doesNotThrow(() => process.kill(process.pid, 0));
  } finally {
    await item.cleanup();
  }
});
