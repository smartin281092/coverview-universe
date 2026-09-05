import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file));
const manifest = JSON.parse(await read('assets/brand/tokens.json'));
const fail = (message) => { throw new Error(message); };
const hexPattern = /^#[0-9A-F]{6}$/;

for (const [name, color] of Object.entries(manifest.colors)) {
  if (!hexPattern.test(color.hex)) fail(`Couleur invalide : ${name}`);
  if (!['source', 'proposal'].includes(color.origin)) fail(`Origine absente : ${name}`);
}

const colorValue = (name) => manifest.colors[name]?.hex ?? fail(`Couleur inconnue : ${name}`);
const css = [
  '/* Genere depuis tokens.json par node scripts/verify-brand.mjs --write-css.',
  ' * Reference light, avant implementation. Derivations : docs/brand.md.',
  ' * A integrer apres le preset : docs/design.md DSN-01.',
  ' * Ne definit ni typographie, ni rayons, ni theme sombre. */',
  ':root {',
  ...Object.entries(manifest.colors)
    .filter(([, color]) => color.origin === 'source')
    .map(([name, color]) => `  --brand-${name}: ${color.hex};`),
  '',
  ...Object.entries(manifest.lightTokens).map(([token, color]) => `  --${token}: ${colorValue(color)};`),
  '}',
  '',
].join('\n');

if (process.argv.includes('--write-css')) {
  await writeFile(path.join(root, 'assets/brand/tokens.css'), css);
} else if ((await read('assets/brand/tokens.css')).toString() !== css) {
  fail('CSS divergent : regenerer avec node scripts/verify-brand.mjs --write-css');
}

for (const asset of [manifest.source, ...manifest.assets]) {
  const hash = createHash('sha256').update(await read(asset.file)).digest('hex');
  if (hash !== asset.sha256) fail(`Empreinte source differente : ${asset.file}`);
}

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g)
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const values = [luminance(colorValue(foreground)), luminance(colorValue(background))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

for (const check of manifest.contrastChecks) {
  const value = contrast(check.foreground, check.background);
  if (value < check.min) fail(`${check.label} : ${value.toFixed(3)} < ${check.min}:1`);
}

console.log(`Marque verifiee : ${Object.keys(manifest.lightTokens).length} tokens, ${manifest.contrastChecks.length} contrastes, ${manifest.assets.length + 1} sources intactes.`);
console.log(`Restriction connue : body original sur surface = ${contrast('body', 'surface').toFixed(2)}:1 ; texte courant derive = ${contrast('bodyAccessible', 'surface').toFixed(2)}:1.`);
console.log(`Restriction connue : border original sur surface = ${contrast('border', 'surface').toFixed(2)}:1 ; separation decorative uniquement.`);
