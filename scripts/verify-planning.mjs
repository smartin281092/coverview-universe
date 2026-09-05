// Vérifie la traçabilité source → critères → slices, sans appel réseau.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(message); };
const local = (path) => {
  if (typeof path !== 'string' || !path) fail('Chemin attendu.');
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..\\') || rel.startsWith('../')) fail(`Chemin hors dépôt : ${path}`);
  return target;
};
const read = (path) => readFileSync(local(path), 'utf8');

try {
  if (process.argv.slice(2).some((x) => x !== '--require-complete')) fail('Option inconnue.');
  const coverage = JSON.parse(read('roadmap/coverage.json'));
  const inventory = JSON.parse(read(coverage.source_inventory));
  const actualHash = createHash('sha256').update(readFileSync(local(inventory.source))).digest('hex');
  if (coverage.source_sha256 !== inventory.sha256 || actualHash !== inventory.sha256) fail('La bible a changé : réconcilier inventaire et affectations.');
  if (!Array.isArray(inventory.units) || !Array.isArray(coverage.assignments)) fail('Inventaire/affectations invalides.');
  const sourceIds = new Set(inventory.units.map((unit) => unit.id));
  if (sourceIds.size !== inventory.units.length) fail('IDs source dupliqués.');
  const backlog = read('roadmap/backlog.yaml');
  const sliceList = [...backlog.matchAll(/^- id: (S-[\w-]+)\s*$/gm)].map((match) => match[1]);
  const sliceIds = new Set(sliceList);
  if (sliceIds.size !== sliceList.length) fail('IDs de slices dupliqués.');
  if ([...backlog.matchAll(/^  status: running\s*$/gm)].length > 1) fail('Plusieurs slices running.');
  const assigned = new Set();
  for (const entry of coverage.assignments) {
    if (!['implementation', 'context'].includes(entry.disposition)) fail('Disposition de couverture invalide.');
    if (!Array.isArray(entry.source_ids) || !entry.source_ids.length || typeof entry.criterion !== 'string' || !entry.criterion.trim()) fail('Source et critère/justification requis.');
    if (!Array.isArray(entry.slices)) fail('Liste de slices requise.');
    if (entry.disposition === 'implementation' && !entry.slices.length) fail('Exigence sans slice.');
    if (entry.disposition === 'context' && entry.slices.length) fail('Une unité de contexte ne déclare pas de slice.');
    for (const id of entry.source_ids) {
      if (!sourceIds.has(id)) fail(`Source inconnue : ${id}`);
      assigned.add(id);
    }
    for (const id of entry.slices) {
      if (!sliceIds.has(id)) fail(`Slice inconnue : ${id}`);
      for (const path of [`roadmap/plans/${id}.plan.md`, `roadmap/prompts/${id}.prompt.md`]) {
        if (!existsSync(local(path))) fail(`Artefact manquant : ${path}`);
      }
    }
  }
  const remaining = sourceIds.size - assigned.size;
  console.log(`Source intacte ; ${coverage.assignments.length} affectations ; ${assigned.size}/${sourceIds.size} unités affectées ; ${sliceIds.size} réservations de slices.`);
  if (remaining) console.log(`${remaining} unités restent à qualifier/affecter pendant la roadmap détaillée ; aucune couverture d'implémentation prétendue.`);
  if (process.argv.includes('--require-complete') && remaining) fail('Couverture incomplète : roadmap détaillée non terminée.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
