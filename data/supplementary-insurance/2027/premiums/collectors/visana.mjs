#!/usr/bin/env node
// Relevé des primes LCA 2027 de Visana dans le calculateur officiel https://dap.visana.ch/offer/
//
// Méthode : le calculateur (Angular) obtient tous les prix d'un profil par un seul appel JSON
//   GET /offer/api/public/supplementary-insurances?sale_offer_begin=…&date_of_birth=…&gender_or_prenatal=…
//       &zip_code=…&bfs_number=…&has_basic_insurance=false&contract_duration=ONE_YEAR…
// Ce script ouvre le calculateur avec Playwright (pour passer le contrôle de cookies du site) puis rejoue
// cet appel avec fetch dans la page, un profil à la fois, avec une pause entre deux requêtes.
//
// Usage :
//   node visana.mjs                         relevé complet -> ../visana.csv
//   node visana.mjs --localities=1003       Lausanne seul
//   node visana.mjs --years=1980-1990       sous-ensemble d'années de naissance
//   node visana.mjs --daily-cash=all        toutes les 798 combinaisons d'indemnités journalières (défaut : cross)
//   node visana.mjs --viva=auto|all|none    variantes VIVA : auto = seulement là où l'assurance de base VIVA existe (défaut)
//   node visana.mjs --cache=<dossier>       garde les réponses JSON brutes et reprend un relevé interrompu
//   node visana.mjs --out=<fichier.csv> --stats=<fichier.json> --delay=1200
//   node visana.mjs --verify                compare quelques prix affichés à l'écran avec l'API (aucun CSV écrit)
//
// Aucune demande d'offre n'est envoyée : seuls des appels de lecture de prix sont faits.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALCULATOR_URL = 'https://dap.visana.ch/offer/';
const API = 'https://dap.visana.ch/offer/api/public';
const PREMIUM_YEAR = 2027;
const SALE_OFFER_BEGIN = '2027-01-01';
const CONTRACT_DURATION = 'ONE_YEAR'; // « 1 an » : prime sans rabais pour contrat pluriannuel (3 ans : -2 %, 5 ans : -3 %)

const LOCALITIES = [
  { zip: '1003', city: 'Lausanne' },
  { zip: '1204', city: 'Genève' },
  { zip: '1950', city: 'Sion' },
  { zip: '2000', city: 'Neuchâtel' },
  { zip: '1700', city: 'Fribourg' },
  { zip: '2800', city: 'Delémont' },
];
const REFERENCE_ZIP = '1003';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`argument inconnu : ${a}`);
  return [m[1], m[2] ?? true];
}));
const DELAY_MS = Math.max(1000, Number(args.delay ?? 1200));
const DAILY_CASH_MODE = args['daily-cash'] ?? 'cross';
const VIVA_MODE = args.viva ?? 'auto';
const OUT = path.resolve(args.out ?? path.join(HERE, '..', 'visana.csv'));
const CACHE = args.cache ? path.resolve(args.cache) : null;
const [YEAR_FROM, YEAR_TO] = String(args.years ?? '1947-2026').split('-').map(Number);
const ZIPS = args.localities ? String(args.localities).split(',') : LOCALITIES.map((l) => l.zip);
const TODAY = new Date().toISOString().slice(0, 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------
// Libellés tels qu'affichés par le calculateur en français (relevés le 2026-11-18)
// ---------------------------------------------------------------------------------------------------------
const ROMAN = { LEVEL_ONE: 'I', LEVEL_TWO: 'II', LEVEL_THREE: 'III' };
const DENTAL_CLASS = {
  LEVEL_3: 'Classe 3 (50%, au max. 600 francs)',
  LEVEL_4: 'Classe 4 (75% max. CHF 600)',
  LEVEL_5: "Classe 5 (50% max. CHF 1'200)",
  LEVEL_6: "Classe 6 (75% max. CHF 1'200)",
  LEVEL_7: "Classe 7 (75% max. CHF 1'500)",
  LEVEL_8: "Classe 8 (75% max. CHF 1'800)",
  LEVEL_9: "Classe 9 (75% max. CHF 3'000)",
  LEVEL_10: "Classe 10 (75% max. CHF 5'000)",
};
const HOSPITAL_FAMILIES = {
  hospital: {
    name: 'Hôpital',
    variants: {
      hospital_general: 'Hôpital général',
      hospital_flex_48: 'Hôpital Flex (4/8)',
      hospital_flex_24: 'Hôpital Flex (2/4)',
      hospital_flex_plus: 'Hôpital Flex Plus',
      hospital_semi_private: 'Hôpital division mi-privée',
      hospital_private: 'Hôpital privé',
    },
  },
  basic: {
    name: 'Assurance complémentaire combinée Basic',
    variants: {
      basic_general: 'Division commune',
      basic_flex_48: 'Basic Flex 4/8',
      basic_flex_24: 'Basic Flex 2/4',
      basic_flex_plus: 'Basic Flex Plus',
      basic_semi_private: 'Division mi-privée',
      basic_private: 'Division privée',
    },
  },
  hospital_viva: {
    name: 'Hôpital VIVA',
    viva: true,
    variants: {
      hospital_viva_general: 'Hôpital division commune VIVA',
      hospital_viva_flex_48: 'Hôpital Flex (4/8)',
      hospital_viva_flex_24: 'Hôpital Flex (2/4)',
      hospital_viva_semi_private: 'Hôpital division mi-privée VIVA',
      hospital_viva_private: 'Hôpital division privée VIVA',
    },
  },
};
const LEVEL_FAMILIES = {
  outpatient: { name: 'Traitements ambulatoires', variant: (l) => `Traitements ambulatoires ${ROMAN[l] ?? l}` },
  complementary: { name: 'Médecine complémentaire', variant: (l) => `Médecine complémentaire ${ROMAN[l] ?? l}` },
  outpatient_viva: { name: 'Ambulatoire VIVA', viva: true, variant: (l) => `Traitements ambulatoires ${ROMAN[l] ?? l} VIVA` },
  complementary_viva: { name: 'Médecine complémentaire VIVA', viva: true, variant: (l) => `Médecine complémentaire ${ROMAN[l] ?? l} VIVA` },
  dental: { name: 'Traitement dentaires', variant: (l) => DENTAL_CLASS[l] ?? l },
};
const SINGLE_PRICE = {
  legal_protection: 'Protection juridique',
  emergency_care: 'Assistance d’urgence',
  accident_medical_expenses_supplement: 'Complément Frais de guérison en cas d’accident',
  outpatient_comfort: 'Confort ambulatoire',
};
// Produits paramétriques : identiques dans les six localités, écrits pour la localité de référence seulement
// (et pour une autre localité uniquement si un prix y diffère).
// Clés de ../../insurers/visana.json quand la correspondance est évidente (sinon vide).
const PRODUCT_KEYS = {
  outpatient: 'visana-traitements-ambulatoires',
  complementary: 'visana-medecine-complementaire',
  outpatient_viva: 'visana-traitements-ambulatoires-viva',
  complementary_viva: 'visana-medecine-complementaire-viva',
  dental: 'visana-soins-dentaires',
  hospital_general: 'visana-hopital',
  hospital_semi_private: 'visana-hopital',
  hospital_private: 'visana-hopital',
  hospital_flex_48: 'visana-hopital-flex',
  hospital_flex_24: 'visana-hopital-flex',
  hospital_flex_plus: 'visana-hopital-flex-plus',
  basic_general: 'visana-basic',
  basic_semi_private: 'visana-basic',
  basic_private: 'visana-basic',
  basic_flex_48: 'visana-basic-flex',
  basic_flex_24: 'visana-basic-flex',
  hospital_viva_general: 'visana-hopital-viva',
  hospital_viva_semi_private: 'visana-hopital-viva',
  hospital_viva_private: 'visana-hopital-viva',
  hospital_viva_flex_48: 'visana-hopital-flex-viva',
  hospital_viva_flex_24: 'visana-hopital-flex-viva',
  hospital_capital: 'visana-capital-hopital',
  hospital_daily_cash: 'visana-indemnites-journalieres-hospitalisation',
  accident_death_capital: 'visana-capital-accident-tup',
  accident_disability_capital: 'visana-capital-accident-tup',
  accident_medical_expenses_supplement: 'visana-capital-accident-tup',
  sickness_death_or_disability_capital: 'visana-capital-maladie-cdi',
  emergency_care: 'visana-assistance-urgence',
  daily_cash: 'visana-indemnites-journalieres-lca',
  // legal_protection : le calculateur vend une protection juridique privée + circulation + santé ; la fiche ne décrit
  // que « Protection juridique de la santé » -> correspondance non évidente, clé laissée vide.
};
const PARAMETRIC = new Set(['hospital_capital', 'accident_death_capital', 'accident_disability_capital',
  'sickness_death_or_disability_capital', 'hospital_daily_cash', 'daily_cash']);

const chf = (code) => `CHF ${Number(String(code).replace('CHF_', '')).toLocaleString('de-CH').replace(/[’']/g, '’')}`;
const days = (code) => { const n = Number(String(code).replace('DAYS_', '')); return `${n} ${n === 1 ? 'jour' : 'jours'}`; };
const costSharing = (code) => chf(String(code).replace('COST_SHARING_', 'CHF_'));
const region = (code) => ({ EUROPE: 'Europe', WORLD: 'Monde entier' }[code] ?? code);
const avecSans = (b) => (b ? 'Avec' : 'Sans');

const VIVA_NOTE = 'exige l’assurance de base VIVA de Visana (proposée dans cette localité) ; prix lu dans l’API - non affiché sans cette base';

/** Transforme une réponse supplementary-insurances en lignes { productId, productKey, name, variant, option, accident, price, notes }. */
function extractRows(data, includeViva) {
  const rows = [];
  const push = (productId, name, variant, optionText, isDefault, accident, price, keyId = productId) => {
    if (typeof price !== 'number') return;
    rows.push({
      productId, productKey: PRODUCT_KEYS[keyId] ?? '', name, variant,
      option: isDefault ? '' : optionText,
      accident,
      price,
      notes: [isDefault && optionText ? `option par défaut du calculateur : ${optionText}` : '', productId.includes('viva') ? VIVA_NOTE : '']
        .filter(Boolean).join(' | '),
    });
  };

  for (const [key, def] of Object.entries(LEVEL_FAMILIES)) {
    if (def.viva && !includeViva) continue;
    for (const item of data[key] ?? []) push(key, def.name, def.variant(item.level), '', true, '', item.price);
  }

  for (const [key, def] of Object.entries(HOSPITAL_FAMILIES)) {
    if (def.viva && !includeViva) continue;
    for (const [sub, value] of Object.entries(data[key] ?? {})) {
      const variant = def.variants[sub] ?? sub;
      if (Array.isArray(value)) {
        for (const item of value) {
          const parts = [];
          if (item.region !== undefined) parts.push(`Région Division privée ${region(item.region)}`);
          parts.push(`Participation aux coûts ${costSharing(item.cost_sharing)}`);
          const isDefault = item.cost_sharing === 'COST_SHARING_0' && (item.region === undefined || item.region === 'EUROPE');
          push(key, def.name, variant, parts.join('; '), isDefault, '', item.price, sub);
        }
      } else if (value && typeof value === 'object') {
        push(key, def.name, variant, '', true, '', value.price, sub);
      }
    }
  }

  for (const [key, name] of Object.entries(SINGLE_PRICE)) {
    if (data[key] && typeof data[key] === 'object') push(key, name, '', '', true, '', data[key].price);
  }

  for (const item of data.hospital_capital ?? []) {
    const text = `Capital Hôpital ${chf(item.capital_hospital)}; Couverture accidents ${avecSans(item.accident_coverage)}`;
    push('hospital_capital', 'Assurance sous forme de capital Hôpital', '', text,
      item.capital_hospital === 'CHF_4000' && item.accident_coverage === true, String(item.accident_coverage), item.price);
  }
  for (const item of data.accident_death_capital ?? []) {
    push('accident_death_capital', 'Capital-décès en cas d’accident', '', `Capital-décès ${chf(item.accident_benefit)}`,
      item.accident_benefit === 'CHF_10000', '', item.price);
  }
  for (const item of data.accident_disability_capital ?? []) {
    push('accident_disability_capital', 'Capital-invalidité en cas d’accident', '', `Capital-invalidité ${chf(item.accident_benefit)}`,
      item.accident_benefit === 'CHF_100000', '', item.price);
  }
  for (const item of data.sickness_death_or_disability_capital ?? []) {
    push('sickness_death_or_disability_capital', 'Assurance d’un capital en cas de maladie', '',
      `Capital-décès ${chf(item.death_benefit)}; Capital-invalidité ${chf(item.disability_benefit)}`,
      item.death_benefit === 'CHF_10000' && item.disability_benefit === 'CHF_100000', '', item.price);
  }
  for (const item of data.hospital_daily_cash ?? []) {
    push('hospital_daily_cash', 'Indemnités journalières d’hospitalisation', '',
      `Durée d’allocation des prestations ${days(item.benefit_duration)}; Délai d’attente ${days(item.waiting_period)}; Montant d'indemnités journalières ${chf(item.capital)}`,
      item.benefit_duration === 'DAYS_30' && item.waiting_period === 'DAYS_3' && item.capital === 'CHF_200', '', item.price);
  }
  for (const item of data.daily_cash ?? []) {
    // « cross » : toutes les valeurs d'un paramètre, les deux autres restant au défaut du calculateur
    // (délai d'attente 30 jours, CHF 50 par jour), avec et sans accident.
    if (DAILY_CASH_MODE !== 'all' && item.waiting_period !== 'DAYS_30' && item.capital !== 'CHF_50') continue;
    push('daily_cash', 'Indemnités journalières', '',
      `Couverture accidents ${avecSans(item.accident_coverage)}; Délai d’attente ${days(item.waiting_period)}; Montant d'indemnités journalières ${chf(item.capital)}`,
      item.accident_coverage === true && item.waiting_period === 'DAYS_30' && item.capital === 'CHF_50',
      String(item.accident_coverage), item.price);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------
// Accès au calculateur
// ---------------------------------------------------------------------------------------------------------
class Stop extends Error {}

async function apiGet(page, endpoint, params) {
  const url = `${API}/${endpoint}?${new URLSearchParams(params)}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt * 15000);
    let res;
    try {
      res = await page.evaluate(async (u) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 30000);
        try {
          const r = await fetch(u, { headers: { accept: 'application/json', 'accept-language': 'fr' }, signal: ctrl.signal });
          return { status: r.status, type: r.headers.get('content-type') ?? '', text: await r.text() };
        } finally { clearTimeout(timer); }
      }, url);
    } catch (e) {
      lastError = `fetch: ${e.message.split('\n')[0]}`;
      continue;
    }
    if (res.status === 200 && /json/.test(res.type)) return JSON.parse(res.text);
    lastError = `HTTP ${res.status} ${res.type} ${res.text.slice(0, 200)}`;
    // blocage, captcha ou page HTML à la place du JSON : arrêt immédiat, pas de nouvel essai
    if ([401, 403, 429].includes(res.status) || /captcha/i.test(res.text) || (res.status === 200 && !/json/.test(res.type))) {
      throw new Stop(`arrêt (blocage probable) sur ${url} : ${lastError}`);
    }
  }
  throw new Stop(`arrêt après erreurs répétées sur ${url} : ${lastError}`);
}

const supplementaryParams = (loc, birthYear, sex) => ({
  sale_offer_begin: SALE_OFFER_BEGIN,
  date_of_birth: `${birthYear}-06-15`,
  gender_or_prenatal: sex === 'f' ? 'FEMALE' : 'MALE',
  zip_code: loc.zip,
  bfs_number: String(loc.bfs),
  has_basic_insurance: 'false',
  has_any_other_person_before_with_legal_protection: 'false',
  contract_duration: CONTRACT_DURATION,
});

async function resolveLocality(page, loc) {
  const data = await apiGet(page, 'address-suggestions', { query: loc.zip, search_date: SALE_OFFER_BEGIN });
  const hit = data.suggestions.find((s) => s.zip_code === loc.zip && s.city === loc.city && s.municipality === null);
  if (!hit) throw new Stop(`localité introuvable : ${loc.zip} ${loc.city} -> ${JSON.stringify(data.suggestions)}`);
  return { ...loc, bfs: hit.bfs_number };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';

async function collect(page) {
  const stats = { retrievedAt: TODAY, contractDuration: CONTRACT_DURATION, dailyCashMode: DAILY_CASH_MODE,
    vivaMode: VIVA_MODE, vivaLocalities: [], requests: 0, fromCache: 0, rows: 0, localities: [], basicModels: {}, availability: {}, parametricDiffersFromReference: 0,
    regionalProducts: {}, nullOutpatientComfort: true };

  const begins = await apiGet(page, 'sale-offer-begins', {});
  await sleep(DELAY_MS);
  if (!begins.sale_offer_begins.includes(SALE_OFFER_BEGIN)) throw new Stop(`début ${SALE_OFFER_BEGIN} non proposé : ${begins.sale_offer_begins}`);
  stats.saleOfferBegins = begins;
  stats.premiumYear = (await apiGet(page, 'premium-years', { sale_offer_begin: SALE_OFFER_BEGIN })).premium_year;
  await sleep(DELAY_MS);

  const localities = [];
  for (const loc of LOCALITIES.filter((l) => ZIPS.includes(l.zip))) {
    const resolved = await resolveLocality(page, loc);
    await sleep(DELAY_MS);
    // modèles d'assurance de base proposés (sert uniquement à constater si le plan VIVA existe dans la localité)
    const basic = await apiGet(page, 'basic-insurances', { sale_offer_begin: SALE_OFFER_BEGIN, date_of_birth: '1987-06-15',
      gender_or_prenatal: 'FEMALE', bfs_number: String(resolved.bfs), zip_code: resolved.zip, franchise: 'ADULT_2500', includes_accident_coverage: 'false' });
    await sleep(DELAY_MS);
    stats.basicModels[resolved.zip] = basic.plans.flatMap((p) => p.models.map((m) => m.type));
    resolved.viva = VIVA_MODE === 'all' || (VIVA_MODE === 'auto' && stats.basicModels[resolved.zip].includes('VIVA'));
    if (resolved.viva) stats.vivaLocalities.push(resolved.zip);
    localities.push(resolved);
  }
  stats.localities = localities;
  // la localité de référence d'abord : elle porte les produits paramétriques
  localities.sort((a, b) => (b.zip === REFERENCE_ZIP) - (a.zip === REFERENCE_ZIP));

  if (CACHE) fs.mkdirSync(CACHE, { recursive: true });
  const tmp = `${OUT}.partial`;
  const out = fs.createWriteStream(tmp, { encoding: 'utf8' });
  out.write(`${HEADER}\n`);
  const reference = new Map(); // `${birthYear}|${sex}` -> Map(productId|variant|option|accident -> price)

  try {
    for (const loc of localities) {
      for (let birthYear = YEAR_FROM; birthYear <= YEAR_TO; birthYear++) {
        for (const sex of ['f', 'm']) {
          const cacheFile = CACHE && path.join(CACHE, `${loc.zip}-${birthYear}-${sex}-${CONTRACT_DURATION}.json`);
          let data;
          if (cacheFile && fs.existsSync(cacheFile)) {
            data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            stats.fromCache++;
          } else {
            data = await apiGet(page, 'supplementary-insurances', supplementaryParams(loc, birthYear, sex));
            stats.requests++;
            if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(data));
            await sleep(DELAY_MS);
          }
          if (data.outpatient_comfort) stats.nullOutpatientComfort = false;
          const age = PREMIUM_YEAR - birthYear;
          const rows = extractRows(data, loc.viva);
          const profileKey = `${birthYear}|${sex}`;
          const rowKey = (r) => `${r.productId}|${r.variant}|${r.option}|${r.accident}`;
          if (loc.zip === REFERENCE_ZIP) reference.set(profileKey, new Map(rows.map((r) => [rowKey(r), r.price])));
          const ref = reference.get(profileKey);
          for (const r of rows) {
            const a = (stats.availability[`${r.productId} · ${r.variant || '-'}`] ??= {});
            const s = (a[`${loc.zip}|${sex}`] ??= { min: age, max: age, n: 0 });
            s.min = Math.min(s.min, age); s.max = Math.max(s.max, age); s.n++;
            if (loc.zip !== REFERENCE_ZIP && ref) {
              const same = ref.get(rowKey(r)) === r.price; // ref : même profil dans la localité de référence
              if (!same && ref.has(rowKey(r))) stats.regionalProducts[r.productId] = (stats.regionalProducts[r.productId] ?? 0) + 1;
              if (PARAMETRIC.has(r.productId)) {
                if (same) continue; // identique à la localité de référence : pas de ligne redondante
                stats.parametricDiffersFromReference++;
              }
            }
            out.write([
              'visana', r.productKey, r.name, r.variant, r.option, PREMIUM_YEAR, birthYear, age, sex, loc.zip, loc.city, r.accident,
              r.price.toFixed(2), 'official_calculator', CALCULATOR_URL, TODAY, r.notes,
            ].map(csvCell).join(',') + '\n');
            stats.rows++;
          }
        }
        if ((birthYear - YEAR_FROM) % 10 === 9 || birthYear === YEAR_TO) {
          console.error(`[${new Date().toISOString().slice(11, 19)}] ${loc.zip} ${loc.city} jusqu'à ${birthYear} : ${stats.rows} lignes, ${stats.requests} requêtes`);
        }
      }
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  fs.renameSync(tmp, OUT);
  return stats;
}

// ---------------------------------------------------------------------------------------------------------
// Vérification à l'écran : parcourt l'interface, passe le contrat sur « 1 an » et compare les prix affichés
// ---------------------------------------------------------------------------------------------------------
const VERIFY_PROFILES = [
  { sex: 'f', birthYear: 1987, zip: '1003', city: 'Lausanne' },
  { sex: 'm', birthYear: 1962, zip: '1003', city: 'Lausanne' },
  { sex: 'f', birthYear: 2015, zip: '1003', city: 'Lausanne' },
  { sex: 'm', birthYear: 1990, zip: '1950', city: 'Sion' },
];

const pricesIn = (text) => [...text.matchAll(/CHF par mois\s+(?:à partir de\s+)?(\d+(?:[’']\d{3})*\.\d{2})/g)].map((m) => Number(m[1].replace(/[’']/g, '')));
const minPrice = (list) => Math.min(...list.map((x) => x.price).filter((p) => typeof p === 'number'));

async function verifyProfile(browser, profile) {
  const context = await browser.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();
  const checks = [];
  const check = (label, shown, expected) => checks.push({ label, shown, expected, ok: typeof shown === 'number' && Math.abs(shown - expected) < 0.005 });
  const overlayText = () => page.evaluate(() => document.querySelector('ssc-base-overlay')?.innerText ?? null);
  const openCard = async (cy) => {
    const button = page.locator(`[data-cy="${cy}"]`).getByRole('button').first();
    if (!(await button.count())) return null;
    await button.evaluate((el) => { el.scrollIntoView({ block: 'center' }); el.click(); });
    await page.waitForTimeout(1500);
    return overlayText();
  };
  const cancel = async () => { await page.getByRole('button', { name: 'Interrompre' }).click(); await page.waitForTimeout(700); };
  const secondary = (k) => `add-insurance-type-SUPPLEMENTARY_INSURANCE_PAGE.SECONDARY_PRODUCT.${k}.TITLE`;
  try {
    await page.goto(CALCULATOR_URL, { waitUntil: 'networkidle', timeout: 90000 });
    await page.locator(`[data-cy="icon-button-${profile.sex === 'f' ? 'FEMALE' : 'MALE'}"]`).click();
    await page.locator('#dateOfBirth-person-0').fill(`15.06.${profile.birthYear}`);
    await page.locator('#dateOfBirth-person-0').press('Tab');
    await page.locator('#address').pressSequentially(profile.zip, { delay: 120 });
    await page.locator(`[data-cy="${profile.zip} ${profile.city}"]`).first().click();
    await page.waitForTimeout(800);
    await page.locator('[data-cy="button-show-prices"] button').click();
    await page.waitForURL(/basic-insurance/, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Continuer' }).first().click(); // sans assurance de base
    await page.waitForURL(/supplementary-insurance/, { timeout: 60000 });
    await page.waitForTimeout(3000);
    // un produit quelconque dans le panier fait apparaître le choix « Contrat pluriannuel » à l'étape 4
    await openCard(secondary('HOSPITAL_DAILY_CASH'));
    await page.locator('ssc-base-overlay').getByRole('button', { name: 'Ajouter' }).click();
    await page.waitForTimeout(2500);
    await page.locator('[data-cy="selection-page-next"] button').first().evaluate((el) => el.click());
    await page.waitForURL(/summary/, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.locator('#contract-duration-options').click();
    await page.locator('[role="option"]', { hasText: '1 an' }).click();
    await page.waitForTimeout(3000);
    const summary = await page.innerText('main');

    const loc = await resolveLocality(page, profile);
    await sleep(DELAY_MS);
    const api = await apiGet(page, 'supplementary-insurances', supplementaryParams(loc, profile.birthYear, profile.sex));
    await sleep(DELAY_MS);
    const hdc = api.hospital_daily_cash.find((x) => x.benefit_duration === 'DAYS_30' && x.waiting_period === 'DAYS_3' && x.capital === 'CHF_200');
    check('récapitulatif « 1 an » · Indemnités journalières d’hospitalisation (défaut)', pricesIn(summary)[0], hdc.price);

    await page.goBack();
    await page.waitForURL(/supplementary-insurance/, { timeout: 60000 });
    await page.waitForTimeout(3500);

    for (const key of ['outpatient', 'complementary']) {
      const text = await openCard(`add-insurance-type-${key.toUpperCase()}`);
      if (!text) continue;
      const shown = pricesIn(text);
      api[key].forEach((item, i) => check(`${LEVEL_FAMILIES[key].variant(item.level)}`, shown[i], item.price));
      await cancel();
    }
    for (const key of ['hospital', 'basic']) {
      const text = await openCard(`add-insurance-type-${key.toUpperCase()}`);
      if (!text) continue;
      const v = HOSPITAL_FAMILIES[key].variants;
      const h = api[key];
      const shown = pricesIn(text);
      const flex = [h[`${key}_flex_48`], h[`${key}_flex_24`], h[`${key}_flex_plus`]].filter(Boolean);
      check(`${v[`${key}_general`]}`, shown[0], h[`${key}_general`].price);
      check(`${HOSPITAL_FAMILIES[key].name} · choix flexible « à partir de »`, shown[1], minPrice(flex));
      check(`${v[`${key}_semi_private`]} « à partir de »`, shown[2], minPrice(h[`${key}_semi_private`]));
      check(`${v[`${key}_private`]} « à partir de »`, shown[3], minPrice(h[`${key}_private`]));
      // sélection de la division mi-privée puis privée : le pied de la fenêtre affiche le prix de l'option par défaut
      for (const sub of [`${key}_semi_private`, `${key}_private`]) {
        // 3e bouton « Choisir » dans les deux cas : une fois la mi-privée choisie, son bouton devient « Supprimer »
        await page.locator('ssc-base-overlay').getByRole('button', { name: 'Choisir', exact: true }).nth(2).evaluate((el) => el.click());
        await page.waitForTimeout(1200);
        const chosen = pricesIn(await overlayText());
        const def = h[sub].find((x) => x.cost_sharing === 'COST_SHARING_0' && (x.region ?? 'EUROPE') === 'EUROPE');
        check(`${v[sub]} · option par défaut (CHF 0${sub.endsWith('_private') && !sub.endsWith('semi_private') ? ', Europe' : ''})`, chosen[chosen.length - 1], def.price);
      }
      await cancel();
    }
    for (const [cy, label, expected] of [
      ['DENTAL', DENTAL_CLASS.LEVEL_3, api.dental?.find((x) => x.level === 'LEVEL_3')?.price],
      ['LEGAL_PROTECTION', SINGLE_PRICE.legal_protection, api.legal_protection?.price],
      ['EMERGENCY_CARE', SINGLE_PRICE.emergency_care, api.emergency_care?.price],
      ['ACCIDENT_MEDICAL_EXPENSES_SUPPLEMENT', SINGLE_PRICE.accident_medical_expenses_supplement, api.accident_medical_expenses_supplement?.price],
      ['HOSPITAL_CAPITAL', 'Capital Hôpital CHF 4’000, accidents Avec', api.hospital_capital?.find((x) => x.capital_hospital === 'CHF_4000' && x.accident_coverage)?.price],
      ['DAILY_CASH', 'Indemnités journalières Avec, 30 jours, CHF 50', api.daily_cash?.find((x) => x.accident_coverage && x.waiting_period === 'DAYS_30' && x.capital === 'CHF_50')?.price],
    ]) {
      if (typeof expected !== 'number') continue;
      const text = await openCard(secondary(cy));
      if (!text) { checks.push({ label, shown: null, expected, ok: false }); continue; }
      const shown = pricesIn(text);
      check(label, shown[shown.length - 1], expected);
      await cancel();
    }
  } finally {
    await context.close();
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------------
const browser = await chromium.launch();
let exitCode = 0;
try {
  if (args.verify) {
    for (const profile of VERIFY_PROFILES) {
      const checks = await verifyProfile(browser, profile);
      const ok = checks.filter((c) => c.ok).length;
      console.log(`\n${profile.sex} ${profile.birthYear} ${profile.zip} ${profile.city} : ${ok}/${checks.length} prix affichés identiques à l'API`);
      for (const c of checks) console.log(`  ${c.ok ? 'OK ' : 'DIFF'}  écran ${c.shown ?? '—'}  API ${c.expected}  ${c.label}`);
      if (ok !== checks.length) exitCode = 2;
      await sleep(DELAY_MS);
    }
  } else {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(CALCULATOR_URL, { waitUntil: 'networkidle', timeout: 90000 });
    const stats = await collect(page);
    if (args.stats) fs.writeFileSync(path.resolve(args.stats), JSON.stringify(stats, null, 1));
    console.log(JSON.stringify({ ...stats, availability: undefined }, null, 1));
    console.log(`CSV : ${OUT} (${stats.rows} lignes)`);
  }
} catch (e) {
  exitCode = 1;
  console.error(e instanceof Stop ? e.message : e);
} finally {
  await browser.close();
}
process.exit(exitCode);
