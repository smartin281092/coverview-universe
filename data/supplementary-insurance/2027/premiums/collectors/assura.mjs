#!/usr/bin/env node
// Relevé des primes LCA 2027 d'Assura dans le calculateur officiel (brief : ../../premium-brief.md).
//
// Usage : node assura.mjs [--localities=1003,1204] [--from=1947] [--to=2026]
//                         [--out=../assura.csv] [--raw-dir=<dossier>]
//
// Méthode : le script parcourt le formulaire pour trois profils de contrôle et note les prix
// affichés, puis rejoue depuis la page la requête de prix du calculateur
// (POST public-api.assura.ch/api/DisplayRules/GetDisplayProductRulesSyrius), une personne par
// requête et sans produit sélectionné, pour chaque année de naissance et chaque sexe. Le CSV n'est
// écrit que si les prix relevés pour les trois profils sont ceux de l'écran.
//
// Lecture de la réponse (observée le 2026-11-18) : pour un produit complémentaire, chaque variante
// porte `premium.net` (prime sans accident), `premium.accident` (supplément accident) et
// `premium.netWithAccident` ; `premium.gross` est toujours nul. Sans produit sélectionné aucun
// rabais n'est appliqué (`discountDetail` à zéro) : `net` est donc la prime avant rabais de
// combinaison. Un produit hors limite d'âge est absent de la réponse.
//
// Codes de sortie : 0 = CSV écrit ; 2 = calculateur ou API injoignable (rien écrit) ;
// 3 = arrêt en cours de relevé (lignes déjà observées écrites) ; 4 = contrôle à l'écran échoué.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALC_URL = 'https://calculator.assura.ch/fr';
const API_BASE = 'https://public-api.assura.ch/api';
const PRICE_PATH = '/DisplayRules/GetDisplayProductRulesSyrius';
const YEAR = 2027;
const START_DATE = '2027-01-01';
const DELAY_MS = 1100;
const HEADER =
  'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
const LOCALITY_NAMES = { 1003: 'Lausanne', 1204: 'Genève', 1950: 'Sion', 2000: 'Neuchâtel', 1700: 'Fribourg', 2800: 'Delémont' };
// Groupes du calculateur hors périmètre : assurance de base (LAMal) et protection juridique.
const EXCLUDED_GROUPS = new Set(['Default_Basic', 'Default_Lexa']);
// Libellé affiché par le calculateur devant la valeur de la variante.
const VARIANT_LABELS = {
  PRD_Hospita: ['insuredCapital', 'Capital à choix'],
  PRD_Denta_Ortho: ['annualAmount', 'Choix du montant de la couverture'],
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const localities = String(args.localities ?? Object.keys(LOCALITY_NAMES).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const fromYear = Number(args.from ?? 1947);
const toYear = Number(args.to ?? 2026);
const outPath = path.resolve(HERE, String(args.out ?? '../assura.csv'));
const rawDir = args['raw-dir'] ? path.resolve(String(args['raw-dir'])) : null;
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const money = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : null);
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, "'");

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Clés produit du fichier assureur, quand le nom affiché est identique.
const productKeys = new Map();
try {
  const insurer = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../insurers/assura.json'), 'utf8'));
  for (const p of insurer.products ?? []) productKeys.set(p.name, p.key);
} catch {
  // fichier absent : product_key reste vide
}

// Titres affichés par le calculateur : ils viennent du CMS (`productsConfigurations`).
function catalogFromCms(config) {
  const products = new Map();
  for (const group of config?.[0]?.products_groups ?? []) {
    for (const sub of group.products_sub_groups ?? []) {
      for (const p of sub.products ?? []) {
        if (p?.insurance_id && !EXCLUDED_GROUPS.has(group.identifier)) products.set(p.insurance_id, p.title);
      }
    }
  }
  return products;
}

const lcaProducts = (data, catalog) =>
  (data?.partners?.[0]?.products ?? []).filter((p) => !p.basicInsurance && catalog.has(p.id));

function variantLabel(product, variant) {
  const [field, label] = VARIANT_LABELS[product.id] ?? [];
  if (field && variant[field] != null) return `${label} ${thousands(variant[field])}`;
  // Previsia Extra : une seule variante proposée, non nommée à l'écran ; numéro lu dans la réponse.
  if (variant.previsiaExtraFields?.variante != null) return `Variante ${variant.previsiaExtraFields.variante}`;
  return '';
}

function rowsFromResponse(data, catalog, who, noAccidentOption) {
  const rows = [];
  for (const product of lcaProducts(data, catalog)) {
    const title = catalog.get(product.id);
    const discounts = Object.entries(product.discountDetail ?? {}).filter(([, v]) => v);
    for (const variant of product.variants ?? []) {
      const p = variant.premium ?? {};
      const net = money(p.net);
      if (net === null) continue; // prix absent : rien n'est écrit
      const notes = [];
      if (variant.id !== product.id) notes.push(`variant_id=${variant.id}`);
      if ((product.variants ?? []).length > 1 && variant.defaultSelected) notes.push('default_variant');
      if (product.selectable === false) notes.push('not_selectable_alone');
      if (discounts.length) notes.push(`discounts=${discounts.map(([k, v]) => `${k}:${v}`).join('/')}`);
      if (variant.contractStartDate && variant.contractStartDate !== START_DATE) notes.push(`start=${variant.contractStartDate}`);
      const base = [
        'assura',
        productKeys.get(title) ?? '',
        title,
        variantLabel(product, variant),
        '',
        YEAR,
        who.birthYear,
        YEAR - who.birthYear,
        who.sex,
        who.postalCode,
        who.locality,
      ];
      const tail = ['official_calculator', CALC_URL, today];
      const surcharge = typeof p.accident === 'number' ? p.accident : 0;
      if (noAccidentOption.has(product.id)) {
        rows.push([...base, '', net, ...tail, ['price=net', ...notes].join(';')]);
      } else if (surcharge > 0 && money(p.netWithAccident) !== null) {
        rows.push([...base, 'true', money(p.netWithAccident), ...tail, [`price=net+accident(${money(surcharge)})`, ...notes].join(';')]);
        rows.push([...base, 'false', net, ...tail, ['price=net', ...notes].join(';')]);
      } else {
        rows.push([...base, 'true', net, ...tail, ['price=net', 'accident_surcharge=0.00', ...notes].join(';')]);
      }
    }
  }
  return rows;
}

// Prix affiché sur la carte d'un produit : prime sans accident de la dernière variante de la liste.
function cardPrices(data, catalog) {
  const prices = new Map();
  for (const product of lcaProducts(data, catalog)) {
    const last = product.variants?.[product.variants.length - 1];
    if (last && money(last.premium?.net) !== null) prices.set(catalog.get(product.id), money(last.premium.net));
  }
  return prices;
}

// Parcours du formulaire pour un profil, jusqu'aux cartes des assurances complémentaires.
async function walkForm(browser, who, catalog, withAccidentCheck) {
  const context = await browser.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 1600 } });
  const page = await context.newPage();
  const blocked = new Set();
  page.on('requestfailed', (r) => {
    if (/ERR_TUNNEL_CONNECTION_FAILED/.test(r.failure()?.errorText ?? '')) blocked.add(new URL(r.url()).host);
  });
  const cms = page.waitForResponse((r) => r.url().endsWith('/api/collections/get/productsConfigurations'), { timeout: 60000 });
  await page.goto(CALC_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500); // le formulaire n'accepte les saisies qu'une fois l'application hydratée
  if (!catalog.size) for (const [id, title] of catalogFromCms(await (await cms).json())) catalog.set(id, title);

  await page.locator(`input[name="persons.0.gender"][value="${who.sex}"]`).check({ force: true });
  await page.fill('[data-testid="form-editFamily-firstname"]', 'Test');
  await page.fill('input[name="persons[0].birthDate"]', `15.06.${who.birthYear}`);
  await page.locator('#locality').focus();
  await page.locator('#locality').pressSequentially(who.postalCode, { delay: 150 });
  const option = page.getByRole('option', { name: `${who.postalCode} ${who.locality}`, exact: true });
  try {
    await option.waitFor({ timeout: 15000 });
  } catch {
    throw new Stop(2, `Aucune localité « ${who.postalCode} ${who.locality} » proposée (hôtes refusés par le proxy : ${[...blocked].join(', ') || 'aucun'}).`);
  }
  const priceResponse = page.waitForResponse((r) => r.url().includes(PRICE_PATH), { timeout: 60000 });
  await option.click();
  await page.waitForTimeout(500);
  await page.click('[data-testid="form-editFamily-save"]');
  const first = await priceResponse;
  if (!first.ok()) throw new Stop(2, `Requête de prix du calculateur : HTTP ${first.status()}.`);
  const template = first.request().postDataJSON();

  await page.getByRole('button', { name: 'Choisissez vos assurances complémentaires' }).click();
  await page.waitForURL(/products-lca/, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const toggles = page.locator('input[name="isOpen"]');
  for (let i = 0; i < (await toggles.count()); i += 1) {
    if (await toggles.nth(i).isVisible().catch(() => false)) {
      await toggles.nth(i).click({ force: true });
      await page.waitForTimeout(400);
    }
  }
  await page.waitForTimeout(1000);
  const lines = async () => (await page.evaluate(() => document.body.innerText)).split('\n').map((l) => l.trim());
  const text = await lines();
  const screen = new Map();
  for (const title of catalog.values()) {
    const i = text.indexOf(title);
    if (i >= 0 && text[i + 1] === 'CHF' && /^[\d'.]+$/.test(text[i + 2] ?? '')) screen.set(title, text[i + 2].replace(/'/g, ''));
  }

  const result = { who, template, screen, noAccidentOption: new Set(), accident: null };
  if (withAccidentCheck) {
    // Sélection d'un seul produit : l'option accident apparaît avec son supplément, et la réponse
    // indique quels produits n'ont pas d'option accident.
    const title = 'Complementa Extra';
    const card = page
      .locator('div', { has: page.getByText(title, { exact: true }) })
      .filter({ has: page.locator('input[type=checkbox]:not([name="isOpen"])') })
      .last();
    let selected = page.waitForResponse((r) => r.url().includes(PRICE_PATH), { timeout: 60000 });
    await card.locator('input[type=checkbox]:not([name="isOpen"])').first().click({ force: true });
    const data = await (await selected).json();
    for (const p of lcaProducts(data, catalog)) if (p.accident?.hasAccidentCoverage === false) result.noAccidentOption.add(p.id);
    await page.waitForTimeout(2500);
    let after = await lines();
    const label = after.indexOf('Inclure le risque accident');
    const surcharge = after.slice(label + 1, label + 4).find((l) => /^[\d'.]+$/.test(l));
    selected = page.waitForResponse((r) => r.url().includes(PRICE_PATH), { timeout: 60000 });
    await page.locator('input[name="accident"]').first().click({ force: true });
    await selected;
    await page.waitForTimeout(2500);
    after = await lines();
    result.accident = { title, surcharge, total: after[after.indexOf('Total CHF/mois') + 1] };
  }
  return { ...result, page, context };
}

const browser = await chromium.launch();
let exitCode = 0;
const rows = [];
const catalog = new Map();
const checks = [];
try {
  // 1. Trois profils de contrôle dans l'interface (première localité demandée).
  const postalCode = localities[0];
  const locality = LOCALITY_NAMES[postalCode];
  if (!locality) throw new Stop(2, `Localité inconnue pour ${postalCode} : compléter LOCALITY_NAMES.`);
  let pilot;
  for (const [i, [birthYear, sex]] of [[1987, 'f'], [1958, 'm'], [2019, 'f']].entries()) {
    const walk = await walkForm(browser, { birthYear, sex, postalCode, locality }, catalog, i === 0);
    checks.push(walk);
    if (i === 0) pilot = walk;
    else await walk.context.close();
    await sleep(DELAY_MS);
  }
  console.log(`Catalogue : ${catalog.size} produits complémentaires — ${[...catalog.values()].join(', ')}`);
  const { page, template, noAccidentOption } = pilot;
  console.log(`Sans option accident : ${[...noAccidentOption].map((id) => catalog.get(id)).join(', ') || 'aucun'}`);

  // 2. Rejeu de la requête de prix depuis la page du calculateur.
  const call = (method, url, body) =>
    page.evaluate(
      async ([m, u, b]) => {
        const headers = { Accept: 'application/json, text/plain, */*' };
        if (b) headers['Content-Type'] = 'application/json';
        const res = await fetch(u, { method: m, headers, body: b ? JSON.stringify(b) : undefined });
        return { status: res.status, text: await res.text() };
      },
      [method, url, body],
    );
  if (rawDir) fs.mkdirSync(rawDir, { recursive: true });
  const replayed = new Map();
  let failures = 0;
  for (const npa of localities) {
    const name = `${npa} ${LOCALITY_NAMES[npa] ?? ''}`.trim();
    const res = await call('GET', `${API_BASE}/Localities/${encodeURIComponent(npa)}`);
    await sleep(DELAY_MS);
    const match = (res.status === 200 ? JSON.parse(res.text) : []).find((l) => l.name === name);
    if (!match) {
      console.log(`Localité « ${name} » introuvable (HTTP ${res.status}) : ignorée.`);
      continue;
    }
    for (let birthYear = fromYear; birthYear <= toYear; birthYear += 1) {
      for (const sex of ['f', 'm']) {
        const who = { birthYear, sex, postalCode: npa, locality: match.nameLocation };
        const partner = { ...template.partners[0], gender: sex, birthDate: `${birthYear}-06-15`, selectedProducts: [] };
        const body = { ...template, common: { ...template.common, localityId: match.id }, partners: [partner] };
        const price = await call('POST', `${API_BASE}${PRICE_PATH}`, body);
        await sleep(DELAY_MS);
        if (price.status === 403 || price.status === 429 || /captcha/i.test(price.text.slice(0, 2000))) {
          throw new Stop(3, `Blocage (HTTP ${price.status}) à ${npa}/${birthYear}/${sex} : arrêt.`);
        }
        if (price.status !== 200) {
          failures += 1;
          console.log(`HTTP ${price.status} pour ${npa}/${birthYear}/${sex}`);
          if (failures >= 3) throw new Stop(3, 'Trois erreurs consécutives : arrêt.');
          continue;
        }
        failures = 0;
        if (rawDir) fs.writeFileSync(path.join(rawDir, `${npa}-${birthYear}-${sex}.json`), price.text);
        const data = JSON.parse(price.text);
        replayed.set(`${npa}/${birthYear}/${sex}`, data);
        rows.push(...rowsFromResponse(data, catalog, who, noAccidentOption));
      }
    }
    console.log(`${name} : ${rows.length} lignes cumulées`);
  }

  // 3. Contrôle : les prix relevés pour les profils de contrôle sont-ils ceux de l'écran ?
  let failed = 0;
  for (const check of checks) {
    const { who, screen } = check;
    const data = replayed.get(`${who.postalCode}/${who.birthYear}/${who.sex}`);
    if (!data) {
      console.log(`Contrôle ${who.birthYear}/${who.sex} : profil hors du relevé demandé, non comparé.`);
      continue;
    }
    const expected = cardPrices(data, catalog);
    const diffs = [...new Set([...expected.keys(), ...screen.keys()])].filter((t) => expected.get(t) !== screen.get(t));
    console.log(
      `Contrôle à l'écran ${who.postalCode} ${who.birthYear}/${who.sex} : ${screen.size} cartes, ${screen.size - diffs.filter((t) => screen.has(t)).length} identiques au relevé` +
        ` — ${[...screen].map(([t, v]) => `${t} ${v}`).join(', ')}`,
    );
    for (const t of diffs) console.log(`  ÉCART ${t} : écran ${screen.get(t) ?? 'absent'}, relevé ${expected.get(t) ?? 'absent'}`);
    if (diffs.length || screen.size < 3) failed += 1;
    if (check.accident) {
      const p = lcaProducts(data, catalog).find((x) => catalog.get(x.id) === check.accident.title)?.variants?.[0]?.premium ?? {};
      const ok = check.accident.surcharge === money(p.accident) && check.accident.total === money(p.netWithAccident);
      console.log(
        `Contrôle accident ${check.accident.title} : écran supplément ${check.accident.surcharge}, total ${check.accident.total} ; relevé ${money(p.accident)}, ${money(p.netWithAccident)} — ${ok ? 'identique' : 'ÉCART'}`,
      );
      if (!ok) failed += 1;
    }
  }
  if (failed) throw new Stop(4, `${failed} contrôle(s) à l'écran en écart : CSV non écrit.`);
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  exitCode = error.code;
  console.error(`ARRÊT : ${error.message}`);
} finally {
  await browser.close();
}

if (rows.length > 0 && exitCode !== 4) {
  fs.writeFileSync(outPath, `${[HEADER, ...rows.map((r) => r.map(csv).join(','))].join('\n')}\n`);
  console.log(`${rows.length} lignes écrites dans ${outPath}`);
} else {
  console.log('Aucun CSV écrit.');
}
process.exit(exitCode);
