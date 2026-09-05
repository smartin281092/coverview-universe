// Vérification de la planification, sans réseau ni exécution applicative.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build-roadmap.mjs';

export function verify(root, {requireComplete = false} = {}) {
  return build(root, {check: true, requireComplete});
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--require-complete')) throw new Error('Option admise : --require-complete.');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const result = verify(root, {requireComplete: args.includes('--require-complete')});
    console.log(`Planification cohérente et vues à jour : ${result.summary.slices} slices, ${result.summary.criteria} critères, ${result.summary.assigned_units}/${result.summary.total_units} unités source affectées.`);
    if (result.context.coverage.unassigned.length) console.log(`${result.context.coverage.unassigned.length} unités restent à qualifier ou affecter.`);
    console.log('Vérification structurelle des sources, du graphe, de l’état et des vues générées ; aucune implémentation, intégration réelle ou recette utilisateur n’est prouvée.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
