import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// A product-owned Windows DPAPI store, independent from agent runtimes and session keys.
export async function localDocumentSecret(
  operation: "ensure-storage" | "read-openai",
): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  let root = resolve(process.cwd());
  while (!existsSync(join(root, "pnpm-workspace.yaml"))) {
    const parent = dirname(root);
    if (parent === root) throw new Error("CoverView workspace missing");
    root = parent;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "local-document-secrets.ps1"),
        "-Operation",
        operation,
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15000,
        env: {
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          USERPROFILE: process.env.USERPROFILE,
          TEMP: process.env.TEMP,
        },
      },
    );
    let output = "";
    child.stdout.on("data", (bytes: Buffer) => {
      output += bytes.toString("utf8");
      if (output.length > 2000) child.kill();
    });
    child.stderr.resume();
    child.once("error", (cause) =>
      reject(new Error("Local document secret store unavailable", { cause })),
    );
    child.once("close", (code) => {
      if (code !== 0) reject(new Error("Local document secret store unavailable"));
      else resolve(output.trim() || undefined);
    });
  });
}
