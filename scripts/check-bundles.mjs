// C02 : inspecte les artefacts réellement livrés par les trois interfaces.
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const FORBIDDEN =
  /postgres(?:ql)?:\/\/|rediss?:\/\/|DATABASE_URL|REDIS_URL|MINIO_ROOT_PASSWORD|WORKOS_API_KEY|WORKOS_COOKIE_PASSWORD|AUTH_SESSION_SECRET|OPENAI_API_KEY|DOCUMENT_STORAGE_KEY|DOCUMENT_S3_SECRET_KEY|coverview-local-storage/iu;
let inspected = 0;
async function inspect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if ([".js", ".html", ".css", ".json", ".map"].includes(extname(file))) {
      inspected++;
      if (FORBIDDEN.test(await readFile(file, "utf8"))) {
        throw new Error(`Configuration serveur présente dans le bundle : ${file}`);
      }
    }
  }
}
for (const app of ["client", "admin", "www"]) await inspect(`apps/${app}/dist`);
if (!inspected) throw new Error("Aucun bundle à vérifier : lancer pnpm build.");
console.log(`${inspected} fichiers frontend inspectés : aucune configuration serveur détectée.`);
