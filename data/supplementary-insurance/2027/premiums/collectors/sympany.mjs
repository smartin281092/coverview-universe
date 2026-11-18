#!/usr/bin/env node
// Relevé des primes LCA 2027 dans le calculateur officiel Sympany.
//
// Le calculateur (https://calculator.sympany.ch, application React) obtient tous ses prix par un appel JSON :
//   GET https://api-public.sympany.ch/products/offer?sex=&dateOfBirth=&country=ch&zip=&subZip=&language=fr
//       &isPolicyOwner=true&insuranceStartDate=2027-01-01
// (une personne -> assurance de base + toutes les complémentaires, variantes et options).
// Le site www.sympany.ch ne lie le calculateur que pour les frontaliers (country=de) ; le parcours suisse
// s'ouvre avec le paramètre d'URL country=ch, que l'application accepte.
//
// Le script ouvre le calculateur avec Playwright, saisit un profil pilote dans l'interface pour capter
// l'appel de prix réellement émis, puis rejoue cet appel dans le contexte de la page (même origine),
// une personne par requête, avec une pause entre deux requêtes. Les réponses brutes sont mises en cache
// (reprise possible), puis le CSV est reconstruit en entier. Il ne va jamais au-delà des étapes de choix
// des produits : aucune coordonnée, aucun questionnaire, aucune demande d'offre.
//
// Usage :
//   node sympany.mjs                                   # 6 localités, 1947-2026, f + m
//   node sympany.mjs --localities=1003 --years=1990-1992
//   node sympany.mjs --build-only                      # reconstruit le CSV depuis le cache
//   node sympany.mjs --verify=1003:1987:f,1204:1962:m  # compare le relevé aux prix affichés à l'écran
// Options : --raw-dir=<dossier du cache>  --out=<csv>  --delay-ms=1100  --sexes=f,m  --refill-passes=8
//
// Particularité constatée : l'API omet une variation (hospita flex, KOF3) dans une partie des réponses, pour
// un même profil d'un appel à l'autre. Après le premier passage, le script redemande donc les profils où
// manque une variation que l'API a renvoyée pour le même âge dans une autre réponse, et fusionne les réponses
// (les variations communes doivent avoir des prix identiques, sinon le profil est signalé).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

const CALCULATOR_URL = 'https://calculator.sympany.ch/#/fr?country=ch';
const API = 'https://api-public.sympany.ch';
const INSURER = 'sympany';
const TARIFF_YEAR = 2027;
const START_DATE = '2027-01-01';
const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
const OFFER_PARAMS = ['sex', 'dateOfBirth', 'country', 'zip', 'subZip', 'language', 'isPolicyOwner', 'insuranceStartDate'];

// Localités du profil standard.
const LOCALITIES = [
  { npa: '1003', name: 'Lausanne' },
  { npa: '1204', name: 'Genève' },
  { npa: '1950', name: 'Sion' },
  { npa: '2000', name: 'Neuchâtel' },
  { npa: '1700', name: 'Fribourg' },
  { npa: '2800', name: 'Delémont' },
];
const PILOT = { npa: '1003', name: 'Lausanne', year: 1987, sex: 'f' };

// Variation du calculateur -> clé de ../../insurers/sympany.json.
const PRODUCT_KEYS = {
  PL: 'sympany-plus',
  PR: 'sympany-premium',
  'KO-1': 'sympany-hospita',
  'KO-2': 'sympany-hospita',
  'KO-3': 'sympany-hospita',
  'KO-4': 'sympany-hospita',
  KOF3: 'sympany-hospita-flex',
  'KOU-3': 'sympany-hospita-accident-prive',
  DE: 'sympany-dental',
};
// Variations dont les configurations sont des participations aux coûts (colonne « option ») ;
// pour les autres, la configuration est un niveau de couverture (colonne « variant »).
const COST_SHARING_VARIATIONS = new Set(['KOF3']);
// Configuration que l'interface présélectionne quand l'API n'en marque aucune (lu dans le code de l'application).
const UI_DEFAULT_CONFIGURATION = { KOF3: '7' };

function parseArgs(argv) {
  const args = {
    out: path.resolve(HERE, '..', 'sympany.csv'),
    rawDir: path.join(os.tmpdir(), 'sympany-premiums-raw'),
    delayMs: 1100,
    years: [],
    localities: LOCALITIES.map((l) => l.npa),
    sexes: ['f', 'm'],
    buildOnly: false,
    refillPasses: 8,
    verify: [],
  };
  for (let y = 2026; y >= 1947; y--) args.years.push(y);
  for (const arg of argv) {
    const [key, value = ''] = arg.split('=');
    if (key === '--out') args.out = path.resolve(value);
    else if (key === '--raw-dir') args.rawDir = path.resolve(value);
    else if (key === '--delay-ms') args.delayMs = Math.max(1000, Number(value));
    else if (key === '--sexes') args.sexes = value.split(',');
    else if (key === '--localities') args.localities = value.split(',');
    else if (key === '--build-only') args.buildOnly = true;
    else if (key === '--refill-passes') args.refillPasses = Number(value);
    else if (key === '--years') {
      args.years = [];
      for (const part of value.split(',')) {
        const [a, b = a] = part.split('-').map(Number);
        for (let y = Math.max(a, b); y >= Math.min(a, b); y--) args.years.push(y);
      }
    } else if (key === '--verify') {
      args.verify = value.split(',').map((item) => {
        const [npa, year, sex] = item.split(':');
        return { npa, year: Number(year), sex };
      });
    } else throw new Error(`option inconnue : ${arg}`);
  }
  for (const npa of args.localities) if (!LOCALITIES.some((l) => l.npa === npa)) throw new Error(`localité hors profil : ${npa}`);
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rawFile = (dir, npa, year, sex) => path.join(dir, `${npa}-${year}-${sex}.json`);
const money = (value) => Number(value).toFixed(2);
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function offerUrl(template, { zip, subZip, year, sex }) {
  const url = new URL(template);
  url.searchParams.set('sex', sex);
  url.searchParams.set('dateOfBirth', `${year}-06-15`);
  url.searchParams.set('zip', zip);
  url.searchParams.set('subZip', subZip);
  return url.toString();
}

// Configuration que l'interface affiche par défaut sur la carte d'une variation.
function defaultConfiguration(variation) {
  const configurations = variation.configurations ?? [];
  const forced = UI_DEFAULT_CONFIGURATION[variation.id];
  return configurations.find((c) => c.id === forced) ?? configurations.find((c) => c.preselected) ?? configurations[0];
}

// Prix retenu pour une configuration : avec accident quand l'option existe.
function pickPrice(configuration) {
  const options = configuration.coverageOptions ?? [];
  const withAccident = options.find((o) => o.accident === true);
  const without = options.find((o) => o.accident === false);
  if (withAccident) return { price: withAccident.price, accident: 'true', other: without?.price };
  if (without) return { price: without.price, accident: '', other: undefined };
  return null;
}

function rowsFromOffer(offer, meta, retrievedAt) {
  const rows = [];
  for (const product of offer.products ?? []) {
    if (product.isBasicInsurance) continue;
    for (const variation of product.variations ?? []) {
      const configurations = variation.configurations ?? [];
      const fallback = defaultConfiguration(variation);
      for (const configuration of configurations) {
        const picked = pickPrice(configuration);
        if (!picked || typeof picked.price !== 'number') continue;
        const costSharing = COST_SHARING_VARIATIONS.has(variation.id);
        const multiple = configurations.length > 1;
        const isDefault = configuration === fallback;
        let variant = variation.descriptiveTitle ?? '';
        let option = '';
        if (multiple && costSharing) option = isDefault ? '' : configuration.label;
        else if (multiple) variant = configuration.label;
        const notes = [`id=${product.id}/${variation.id}/${configuration.id}`];
        if (multiple && costSharing && isDefault) notes.push(`default_option: ${configuration.label}`);
        if (!multiple && configuration.label) notes.push(configuration.label);
        if (multiple && !costSharing && variation.descriptiveTitle) notes.push(variation.descriptiveTitle);
        if (picked.other !== undefined) notes.push(`sans_accident=${money(picked.other)}`);
        if (picked.accident === '') notes.push("pas d'option accident dans le calculateur");
        if (variation.validInsuranceRate === false || product.validInsuranceRate === false) notes.push('validInsuranceRate=false');
        rows.push({
          insurer: INSURER,
          product_key: PRODUCT_KEYS[variation.id] ?? '',
          product_name: variation.title,
          variant,
          option,
          year: TARIFF_YEAR,
          birth_year: meta.year,
          age: TARIFF_YEAR - meta.year,
          sex: meta.sex,
          postal_code: meta.npa,
          locality: meta.name,
          accident: picked.accident,
          monthly_chf: money(picked.price),
          source_type: 'official_calculator',
          source_url: CALCULATOR_URL,
          retrieved_at: retrievedAt,
          notes: notes.join('; '),
        });
      }
    }
  }
  return rows;
}

function buildCsv(args) {
  const columns = HEADER.split(',');
  const lines = [HEADER];
  const summary = { rows: 0, responses: 0, missing: [], products: {}, extras: new Set() };
  for (const npa of args.localities) {
    const locality = LOCALITIES.find((l) => l.npa === npa);
    for (const year of args.years) {
      for (const sex of args.sexes) {
        const file = rawFile(args.rawDir, npa, year, sex);
        if (!fs.existsSync(file)) { summary.missing.push(`${npa}:${year}:${sex}`); continue; }
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw.status !== 200 || !raw.offer) { summary.missing.push(`${npa}:${year}:${sex} (HTTP ${raw.status})`); continue; }
        summary.responses++;
        if ((raw.offer.discounts ?? []).length) summary.extras.add('discounts non vide');
        const retrievedAt = raw.retrievedAt.slice(0, 10);
        for (const row of rowsFromOffer(raw.offer, { npa, name: locality.name, year, sex }, retrievedAt)) {
          lines.push(columns.map((c) => csvCell(row[c])).join(','));
          summary.rows++;
          const key = [row.product_name, row.variant, row.option].filter(Boolean).join(' | ');
          const entry = (summary.products[key] ??= { rows: 0, minAge: 999, maxAge: -1 });
          entry.rows++;
          entry.minAge = Math.min(entry.minAge, row.age);
          entry.maxAge = Math.max(entry.maxAge, row.age);
        }
      }
    }
  }
  fs.writeFileSync(args.out, lines.join('\n') + '\n');
  summary.extras = [...summary.extras];
  return summary;
}

const variationIds = (offer) => (offer.products ?? []).flatMap((p) => (p.variations ?? []).map((v) => v.id));

// Ajoute à `base` les variations de `extra` qui lui manquent ; signale les variations communes dont les prix diffèrent.
function mergeOffers(base, extra) {
  const added = [];
  const inconsistent = [];
  for (const product of extra.products ?? []) {
    const target = (base.products ?? []).find((p) => p.id === product.id);
    if (!target) { base.products.push(product); added.push(...(product.variations ?? []).map((v) => v.id)); continue; }
    for (const variation of product.variations ?? []) {
      const known = target.variations.find((v) => v.id === variation.id);
      if (!known) { target.variations.push(variation); added.push(variation.id); }
      else if (JSON.stringify(known.configurations) !== JSON.stringify(variation.configurations)) inconsistent.push(variation.id);
    }
  }
  return { added, inconsistent };
}

function readRaw(file) {
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw.status === 200 && raw.offer ? raw : null;
}

async function fetchOffer(page, url) {
  const result = await page.evaluate(async (target) => {
    try {
      const response = await fetch(target, { headers: { Accept: 'application/json' } });
      return { status: response.status, text: await response.text() };
    } catch (error) { return { status: 0, text: String(error) }; }
  }, url);
  let offer;
  try { offer = result.status === 200 ? JSON.parse(result.text) : null; } catch { offer = null; }
  return { status: result.status, offer, error: offer ? undefined : result.text.slice(0, 500) };
}

// Profils du périmètre dont la réponse en cache n'a pas une variation vue au même âge dans une autre réponse.
function incompleteProfiles(args) {
  const byAge = new Map();
  const cached = [];
  for (const npa of args.localities) for (const year of args.years) for (const sex of args.sexes) {
    const raw = readRaw(rawFile(args.rawDir, npa, year, sex));
    if (!raw) continue;
    const ids = new Set(variationIds(raw.offer));
    cached.push({ npa, year, sex, ids });
    const seen = byAge.get(year) ?? new Set();
    for (const id of ids) seen.add(id);
    byAge.set(year, seen);
  }
  return cached
    .map((c) => ({ ...c, missing: [...byAge.get(c.year)].filter((id) => !c.ids.has(id)) }))
    .filter((c) => c.missing.length > 0);
}

async function openCalculator(browser) {
  const context = await browser.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();
  await page.goto(CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByTestId('basic-information-first-name').waitFor({ timeout: 30000 }).catch(() => {
    throw new Error(`le calculateur ne s'est pas ouvert sur le parcours suisse (page : ${page.url()})`);
  });
  return { context, page };
}

// Saisit une personne dans l'interface et retourne l'appel de prix émis par l'application.
async function enterPerson(page, profile) {
  await page.getByRole('button', { name: profile.sex === 'f' ? 'F' : 'M', exact: true }).click();
  await page.getByTestId('basic-information-first-name').fill('Test');
  await page.getByTestId('basic-information-birth-date').fill(`${profile.year}-06-15`);
  const area = page.getByTestId('premium-area-autocomplete');
  await area.click();
  await area.pressSequentially(profile.npa, { delay: 150 });
  await page.getByText(`${profile.npa} ${profile.name}`, { exact: true }).first().click();
  await page.waitForTimeout(500);
  const offerResponse = page.waitForResponse((r) => r.url().startsWith(`${API}/products/offer`), { timeout: 30000 });
  await page.getByTestId('next-button').click();
  const response = await offerResponse;
  return { url: response.url(), status: response.status(), offer: response.ok() ? await response.json() : null };
}

// Lit les prix des cartes de l'étape affichée : { identifiant de variation -> prix }.
async function readCards(page) {
  await page.locator('[data-testid^="radio-select-card-price-"]').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  return page.$$eval('[data-testid^="radio-select-card-price-"]', (nodes) =>
    Object.fromEntries(nodes.map((n) => {
      const match = (n.innerText || '').replace(/[’']/g, '').match(/CHF\s*(-?\d+(?:\.\d+)?)/);
      return [n.getAttribute('data-testid').replace('radio-select-card-price-', ''), match ? Number(match[1]) : null];
    })));
}

// Parcourt les étapes hospitalisation, ambulatoire et dentaire ; s'arrête avant « Vérifier ».
// L'interface exige au moins un produit choisi pour avancer : si « Continuer » est grisé, la première
// carte de l'étape est cochée (les prix des cartes n'en dépendent pas).
async function readScreenPrices(page) {
  const screen = {};
  const steps = ['hospital-insurance', 'outpatient-insurance', 'dental-insurance'];
  const next = page.getByTestId('next-button');
  if (page.url().includes('basic-insurance')) {
    await page.waitForTimeout(1500);
    await next.click();
  }
  for (const step of steps) {
    try { await page.waitForURL((url) => url.toString().includes(step), { timeout: 15000 }); } catch { break; }
    Object.assign(screen, await readCards(page));
    if (step === 'dental-insurance') break;
    if (await next.isDisabled()) {
      await page.locator('[data-testid^="radio-select-card-option-"]').first().click();
      await page.waitForTimeout(800);
    }
    await next.click();
  }
  return screen;
}

function expectedScreenPrices(offer) {
  const expected = {};
  for (const product of offer.products ?? []) {
    if (product.isBasicInsurance) continue;
    for (const variation of product.variations ?? []) {
      const picked = pickPrice(defaultConfiguration(variation));
      if (picked) expected[variation.id] = picked.price;
    }
  }
  return expected;
}

function compareScreen(screen, expected) {
  const checks = [];
  for (const [id, shown] of Object.entries(screen)) {
    checks.push({ id, shown, expected: expected[id], ok: expected[id] !== undefined && Math.abs(shown - expected[id]) < 0.005 });
  }
  return checks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.rawDir, { recursive: true });
  const report = { calculator: CALCULATOR_URL };

  if (!args.buildOnly) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    try {
      // 1. Profil pilote saisi dans l'interface : capte l'appel de prix et contrôle l'affichage.
      const { context, page } = await openCalculator(browser);
      const pilot = await enterPerson(page, PILOT);
      if (pilot.status !== 200) throw new Error(`appel de prix du pilote : HTTP ${pilot.status}`);
      const template = new URL(pilot.url);
      const names = [...template.searchParams.keys()].sort().join(',');
      if (names !== [...OFFER_PARAMS].sort().join(',')) throw new Error(`paramètres inattendus dans l'appel de prix : ${names}`);
      if (template.searchParams.get('insuranceStartDate') !== START_DATE) {
        throw new Error(`début d'assurance proposé : ${template.searchParams.get('insuranceStartDate')} (attendu ${START_DATE})`);
      }
      const pilotChecks = compareScreen(await readScreenPrices(page), expectedScreenPrices(pilot.offer));
      report.pilot = { profile: PILOT, request: pilot.url, checks: pilotChecks };
      if (pilotChecks.filter((c) => c.ok).length < 3 || pilotChecks.some((c) => !c.ok)) {
        console.log(JSON.stringify(report, null, 1));
        throw new Error("les prix affichés pour le pilote ne correspondent pas à la réponse de l'API : arrêt");
      }

      // 2. Localités : identifiant de région tarifaire (zip, subZip) par le même service que l'interface.
      const areas = {};
      for (const npa of args.localities) {
        const wanted = LOCALITIES.find((l) => l.npa === npa);
        const list = await page.evaluate(async (url) => (await fetch(url)).json(), `${API}/products/areas?searchZip=${npa}&country=ch`);
        const hit = list.find((a) => a.zip === npa && a.name === wanted.name);
        if (!hit) throw new Error(`localité introuvable : ${npa} ${wanted.name} (${JSON.stringify(list)})`);
        areas[npa] = hit;
        await sleep(args.delayMs);
      }
      report.areas = areas;

      // 3. Rejeu de l'appel de prix, une personne par requête.
      let failures = 0;
      let fetched = 0;
      outer:
      for (const npa of args.localities) {
        for (const year of args.years) {
          for (const sex of args.sexes) {
            const file = rawFile(args.rawDir, npa, year, sex);
            if (readRaw(file)) continue;
            const url = offerUrl(pilot.url, { zip: areas[npa].zip, subZip: areas[npa].subZip, year, sex });
            const result = await fetchOffer(page, url);
            const offer = result.offer;
            fs.writeFileSync(file, JSON.stringify({ url, status: result.status, retrievedAt: new Date().toISOString(), attempts: 1, offer, error: result.error }));
            fetched++;
            if (offer) failures = 0;
            else {
              failures++;
              console.error(`${npa} ${year} ${sex} : HTTP ${result.status}`);
              if ([403, 429].includes(result.status) || failures >= 3) { report.stopped = `arrêt après HTTP ${result.status} (${npa} ${year} ${sex})`; break outer; }
            }
            if (fetched % 40 === 0) console.error(`${fetched} requêtes, ${npa} ${year}`);
            await sleep(args.delayMs);
          }
        }
      }
      report.fetched = fetched;

      // 3b. Variations que l'API omet par intermittence : nouvelle demande et fusion.
      const refill = { passes: 0, requests: 0, added: {}, inconsistent: [] };
      for (let pass = 1; pass <= args.refillPasses && !report.stopped; pass++) {
        const targets = incompleteProfiles(args);
        if (targets.length === 0) break;
        refill.passes = pass;
        console.error(`passage de complément ${pass} : ${targets.length} profils`);
        let errors = 0;
        for (const target of targets) {
          const file = rawFile(args.rawDir, target.npa, target.year, target.sex);
          const raw = readRaw(file);
          const result = await fetchOffer(page, raw.url);
          refill.requests++;
          if (result.offer) {
            errors = 0;
            const { added, inconsistent } = mergeOffers(raw.offer, result.offer);
            for (const id of added) refill.added[id] = (refill.added[id] ?? 0) + 1;
            if (inconsistent.length) refill.inconsistent.push(`${target.npa}:${target.year}:${target.sex}:${inconsistent.join('+')}`);
            raw.attempts = (raw.attempts ?? 1) + 1;
            raw.merged = [...(raw.merged ?? []), ...added];
            if (inconsistent.length) raw.inconsistent = inconsistent;
            raw.lastAttemptAt = new Date().toISOString();
            fs.writeFileSync(file, JSON.stringify(raw));
          } else {
            errors++;
            console.error(`${target.npa} ${target.year} ${target.sex} : HTTP ${result.status}`);
            if ([403, 429].includes(result.status) || errors >= 3) { report.stopped = `arrêt après HTTP ${result.status} (complément)`; break; }
          }
          await sleep(args.delayMs);
        }
      }
      refill.stillIncomplete = incompleteProfiles(args).map((t) => `${t.npa}:${t.year}:${t.sex}:${t.missing.join('+')}`);
      report.refill = refill;
      await context.close();

      // 4. Contrôles à l'écran : chaque profil est ressaisi dans l'interface et comparé au cache.
      report.verify = [];
      for (const profile of args.verify) {
        const locality = LOCALITIES.find((l) => l.npa === profile.npa);
        const session = await openCalculator(browser);
        try {
          const entered = await enterPerson(session.page, { ...profile, name: locality.name });
          const screen = await readScreenPrices(session.page);
          const file = rawFile(args.rawDir, profile.npa, profile.year, profile.sex);
          const cached = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).offer : null;
          const checks = compareScreen(screen, expectedScreenPrices(cached ?? entered.offer));
          report.verify.push({ profile, against: cached ? 'cache' : 'réponse de la session', ok: checks.filter((c) => c.ok).length, ko: checks.filter((c) => !c.ok), prices: Object.fromEntries(checks.map((c) => [c.id, c.shown])) });
        } catch (error) {
          report.verify.push({ profile, error: String(error.message).split('\n')[0] });
        }
        await session.context.close();
        await sleep(args.delayMs);
      }
    } finally {
      await browser.close();
    }
  }

  report.csv = buildCsv(args);
  report.out = args.out;
  console.log(JSON.stringify(report, null, 1));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
