import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("le contrôle de bundles refuse les credentials SQL et Redis TLS sans les imprimer", () => {
  const root = mkdtempSync(join(tmpdir(), "coverview-bundles-"));
  try {
    for (const app of ["client", "admin", "www"]) {
      mkdirSync(join(root, "apps", app, "dist"), { recursive: true });
      writeFileSync(join(root, "apps", app, "dist", "index.html"), "<html>Preview</html>");
    }
    const run = () =>
      spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./check-bundles.mjs", import.meta.url))],
        { cwd: root, encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    for (const protocol of ["postgresql", "redis", "rediss"]) {
      writeFileSync(
        join(root, "apps/client/dist/index.js"),
        `const connection='${protocol}://fake:canary-not-a-secret@localhost/db'`,
      );
      const result = run();
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stderr, /canary-not-a-secret/);
    }
  } finally {
    // Unique directory returned by mkdtemp, not a caller-supplied deletion target.
    rmSync(root, { recursive: true });
  }
});
