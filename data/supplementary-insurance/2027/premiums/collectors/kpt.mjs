#!/usr/bin/env node
// Relevé des primes LCA 2027 dans le calculateur officiel KPT / CPT.
//
// Le calculateur (https://assistant.kpt.ch) obtient tous ses prix par un appel JSON :
//   POST /kpt-api/public/productprice/query   (une personne -> tous les produits, variantes et options)
// Le script ouvre le calculateur avec Playwright, puis rejoue cet appel dans le contexte de la page
// (mêmes cookies, même origine), une personne par requête, avec une pause entre deux requêtes.
// Les réponses brutes sont mises en cache (reprise possible), puis le CSV est reconstruit en entier.
//
// Usage :
//   node kpt.mjs                                   # 6 localités, 1947-2026, f + m
//   node kpt.mjs --localities=1003 --years=1990-1992
//   node kpt.mjs --build-only                      # reconstruit le CSV depuis le cache
// Options : --raw-dir=<dossier du cache>  --out=<csv>  --delay-ms=1300  --sexes=f,m

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

const CALCULATOR_URL = 'https://assistant.kpt.ch/fr/donnees-personnelles';
const SETTINGS_URL = 'https://assistant.kpt.ch/appsettings.json';
const START_DATE = '2027-01-01';
const TARIFF_YEAR = 2027;
const INSURER = 'KPT';

// Localités du brief ; `city` sert à choisir la bonne entrée quand un NPA couvre plusieurs communes.
const LOCALITIES = [
  { postalCode: '1003', city: 'Lausanne' },
  { postalCode: '1204', city: 'Genève' },
  { postalCode: '1950', city: 'Sion' },
  { postalCode: '2000', city: 'Neuchâtel' },
  { postalCode: '1700', city: 'Fribourg' },
  { postalCode: '2800', city: 'Delémont' },
];

const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';

function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const rawDir = path.resolve(args['raw-dir'] || path.join(os.tmpdir(), 'coverview-kpt-premiums-raw'));
const outCsv = path.resolve(args.out || path.join(HERE, '..', 'kpt.csv'));
const delayMs = Math.max(1000, Number(args['delay-ms'] || 1300));
const sexes = String(args.sexes || 'f,m').split(',');
const [yearFrom, yearTo] = String(args.years || '1947-2026').split('-').map(Number);
const wantedPostalCodes = args.localities ? String(args.localities).split(',') : LOCALITIES.map((l) => l.postalCode);
const localities = LOCALITIES.filter((l) => wantedPostalCodes.includes(l.postalCode));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function profiles() {
  const list = [];
  for (const loc of localities) {
    for (let y = yearFrom; y <= (yearTo || yearFrom); y += 1) {
      for (const sex of sexes) list.push({ loc, birthYear: y, sex });
    }
  }
  return list;
}

const cachePath = (p) => path.join(rawDir, `${p.loc.postalCode}_${p.birthYear}_${p.sex}.json.gz`);

function readCache(p) {
  const file = cachePath(p);
  if (!fs.existsSync(file)) return null;
  try {
    const entry = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
    if (entry.status === 200 && Array.isArray(entry.body) && entry.body[0]?.additionalProducts) return entry;
  } catch {
    /* cache illisible : on refera l'appel */
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Collecte

async function collect() {
  const todo = profiles().filter((p) => !readCache(p));
  if (!todo.length) return;
  fs.mkdirSync(rawDir, { recursive: true });

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#input-birthDate', { timeout: 60000 });

    // Appel JSON depuis la page : même origine, mêmes cookies que le calculateur.
    const call = (url, init) => page.evaluate(async ({ url, init }) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      try {
        const r = await fetch(url, { ...init, signal: ctrl.signal });
        return { status: r.status, text: await r.text() };
      } catch (e) {
        return { status: 0, text: String(e) };
      } finally {
        clearTimeout(timer);
      }
    }, { url, init });

    const settings = JSON.parse((await call(SETTINGS_URL, {})).text);
    const base = settings.apis.baseUri;
    const res = settings.apis.resources;

    // NPA -> commune (numéro OFS, canton, NPA étendu), comme le fait le champ de saisie du calculateur.
    const places = {};
    for (const loc of localities) {
      const r = await call(`${base}${res.premiumCities}?postalCode=${loc.postalCode}&validAt=${START_DATE}`, { headers: { 'Accept-Language': 'fr-CH' } });
      if (r.status !== 200) throw new Error(`premiumcities ${loc.postalCode}: HTTP ${r.status}`);
      const cities = JSON.parse(r.text);
      const hit = cities.find((c) => norm(c.cityName) === norm(loc.city)) || (cities.length === 1 ? cities[0] : null);
      if (!hit) throw new Error(`premiumcities ${loc.postalCode}: commune « ${loc.city} » introuvable parmi ${cities.map((c) => c.cityFullName).join(', ')}`);
      places[loc.postalCode] = hit;
      await sleep(delayMs);
    }

    let consecutiveFailures = 0;
    let done = 0;
    for (const p of todo) {
      const place = places[p.loc.postalCode];
      const payload = [{
        callerDefiniedApplicantId: 1, // orthographe de l'API
        entryReason: 'New',
        firstName: 'Test',
        birthDate: `${p.birthYear}-06-15`,
        genderCode: p.sex === 'f' ? 'female' : 'male',
        bfsNumber: place.bfsNumber,
        cantonCode: place.cantonCode,
        postalCodeExtended: place.postalCodeExtended,
        basicInsuranceStartDate: START_DATE,
        supplementaryInsuranceStartDate: START_DATE,
      }];

      let entry = null;
      for (let attempt = 1; attempt <= 3 && !entry; attempt += 1) {
        const r = await call(`${base}${res.productPrice}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept-Language': 'fr-CH' },
          body: JSON.stringify(payload),
        });
        let body = null;
        try { body = JSON.parse(r.text); } catch { /* pas du JSON */ }
        if (r.status === 200 && Array.isArray(body) && body[0]?.additionalProducts) {
          entry = { fetchedAt: new Date().toISOString(), place, request: payload, status: r.status, body };
        } else if ([401, 403, 429].includes(r.status) || /captcha/i.test(r.text)) {
          throw new Error(`Blocage (HTTP ${r.status}) sur ${p.loc.postalCode}/${p.birthYear}/${p.sex} : arrêt immédiat. ${r.text.slice(0, 200)}`);
        } else {
          console.error(`  échec ${attempt}/3 ${p.loc.postalCode}/${p.birthYear}/${p.sex} : HTTP ${r.status} ${r.text.slice(0, 160)}`);
          await sleep(attempt * 10000);
        }
      }

      if (entry) {
        consecutiveFailures = 0;
        fs.writeFileSync(cachePath(p), zlib.gzipSync(JSON.stringify(entry)));
      } else {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) throw new Error('Erreurs répétées : arrêt de la collecte.');
      }
      done += 1;
      if (done % 20 === 0 || done === todo.length) console.error(`  ${done}/${todo.length} profils relevés`);
      await sleep(delayMs);
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Construction du CSV

// Code produit du calculateur -> clé de produit dans ../insurers/kpt.json (correspondance par le code
// que KPT indique entre parenthèses dans le nom du produit). La clé n'est écrite que si elle existe dans ce fichier.
const PRODUCT_KEYS = {
  PUL: 'kpt-pulse',
  H: 'kpt-hospitalisation',
  FLEX: 'kpt-hospitalisation-flex',
  HT: 'kpt-indemnites-journalieres-hospitalisation',
  GH: 'kpt-sicuranta',
  Z: 'kpt-soins-dentaires',
  U: 'kpt-accidents-prestations-soins',
  K: 'kpt-capital-accident',
  KTI: 'kpt-capital-maladie-accident',
  VPR: 'kpt-protection-juridique-circulation-privee',
  TD: 'kpt-teddy',
};

function loadProductKeys() {
  const file = path.join(HERE, '..', '..', 'insurers', 'kpt.json');
  const map = {};
  if (!fs.existsSync(file)) return map;
  try {
    const known = new Set((JSON.parse(fs.readFileSync(file, 'utf8')).products || []).map((pr) => pr.key));
    for (const [code, key] of Object.entries(PRODUCT_KEYS)) if (known.has(key)) map[code] = key;
  } catch {
    /* fichier illisible : product_key reste vide */
  }
  return map;
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Une clé de prix a la forme CODE-<id d'option>[_<id d'option>…][_p<id de part binaire>…] ou CODE-ProductOnly.
function decodeKey(product, key) {
  const suffix = key.slice(product.productCode.length + 1);
  const parts = product.productParts || [];
  const tokens = suffix === 'ProductOnly' ? [] : suffix.split('_');
  const chosen = new Map(); // id de part -> option
  const flags = new Set(); // parts binaires activées
  for (const t of tokens) {
    if (/^p\d+$/.test(t)) {
      flags.add(Number(t.slice(1)));
      continue;
    }
    const part = parts.find((pt) => !pt.isBinary && pt.productPartsOptions.some((o) => String(o.id) === t));
    if (!part) return null; // option non proposée à l'écran pour ce profil
    chosen.set(part.id, part.productPartsOptions.find((o) => String(o.id) === t));
  }
  for (const f of flags) if (!parts.some((pt) => pt.isBinary && pt.id === f)) return null;
  return { chosen, flags };
}

function rowsForProduct(product, ctx) {
  const rows = [];
  const parts = [...(product.productParts || [])].sort((a, b) => a.sortKey - b.sortKey);
  const modelParts = parts.filter((pt) => !pt.isBinary && pt.productPartType !== 'Franchise');
  const optionParts = parts.filter((pt) => !pt.isBinary && pt.productPartType === 'Franchise');
  const threeYear = parts.filter((pt) => pt.isBinary && pt.productPartType === 'ThreeYrsContract');
  const accident = parts.filter((pt) => pt.isBinary && pt.productPartType === 'Accident');
  const otherBinary = parts.filter((pt) => pt.isBinary && !threeYear.includes(pt) && !accident.includes(pt));
  const prices = product.prices || {};
  const hidden = [];

  for (const [key, price] of Object.entries(prices)) {
    const dec = decodeKey(product, key);
    if (!dec) { hidden.push(key); continue; }
    // Le rabais « contrat de 3 ans » est un rabais pluriannuel : la ligne porte le prix sans ce rabais,
    // le prix avec rabais est reporté dans les notes.
    if (threeYear.some((pt) => dec.flags.has(pt.id))) continue;

    const variant = modelParts.length > 1
      ? modelParts.map((pt) => `${clean(pt.titleText)}: ${clean(dec.chosen.get(pt.id)?.titleText)}`).join(' | ')
      : modelParts.map((pt) => clean(dec.chosen.get(pt.id)?.titleText)).join('');

    const optionBits = [];
    for (const pt of optionParts) {
      const o = dec.chosen.get(pt.id);
      if (o && !o.isDefault) optionBits.push(`${clean(pt.titleText)}: ${clean(o.titleText)}`);
    }
    for (const pt of otherBinary) {
      const on = dec.flags.has(pt.id);
      const o = pt.productPartsOptions.find((x) => x.id === (on ? 1 : 0));
      optionBits.push(clean(o?.titleText || `${pt.titleText}: ${on ? 'oui' : 'non'}`));
    }

    const notes = [];
    for (const d of product.appliedDiscounts?.[key] || []) {
      notes.push(d.type === 'OnlineDiscount' ? `online_discount_included=${Number(d.amount).toFixed(2)}` : `discount_${d.type}_included=${Number(d.amount).toFixed(2)}`);
    }
    for (const pt of threeYear) {
      const withKey = withFlag(product, key, pt.id);
      if (prices[withKey] !== undefined) notes.push(`three_year_contract_price=${Number(prices[withKey]).toFixed(2)}`);
    }
    const required = [...(product.includes?.[key] || []), ...(product.includes?.[`${product.productCode}-ProductOnly`] || [])]
      .map((r) => r.relatedProductStructureKey.split('-')[0]);
    if (required.length) notes.push(`requires_one_of=${[...new Set(required)].join('|')}`);
    if (Number(price) === 0) notes.push('free_per_calculator');

    rows.push({
      productSort: product.sortKey,
      code: product.productCode,
      variantSort: modelParts.map((pt) => dec.chosen.get(pt.id)?.sortKey ?? 0),
      optionSort: optionParts.map((pt) => dec.chosen.get(pt.id)?.sortKey ?? 0),
      cells: [
        INSURER,
        ctx.productKeys[product.productCode] || '',
        clean(product.titleLongText || product.titleText),
        variant,
        optionBits.join('; '),
        TARIFF_YEAR,
        ctx.birthYear,
        TARIFF_YEAR - ctx.birthYear,
        ctx.sex,
        ctx.postalCode,
        ctx.locality,
        accident.length ? String(accident.some((pt) => dec.flags.has(pt.id))) : '',
        Number(price).toFixed(2),
        'official_calculator',
        CALCULATOR_URL,
        ctx.retrievedAt,
        notes.join('; '),
      ],
    });
  }
  return { rows, hidden };
}

// Clé de prix identique avec la part binaire `partId` activée (les drapeaux _pNN suivent les options, triés).
function withFlag(product, key, partId) {
  const suffix = key.slice(product.productCode.length + 1);
  const tokens = suffix === 'ProductOnly' ? [] : suffix.split('_');
  const opts = tokens.filter((t) => !/^p\d+$/.test(t));
  const flags = [...new Set([...tokens.filter((t) => /^p\d+$/.test(t)), `p${partId}`])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return `${product.productCode}-${[...opts, ...flags].join('_')}`;
}

const cmpArr = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
};

function build() {
  const productKeys = loadProductKeys();
  const lines = [HEADER];
  const stats = {}; // code -> { name, variants, ages par sexe, clés masquées }
  let missing = 0;

  for (const p of profiles()) {
    const entry = readCache(p);
    if (!entry) { missing += 1; continue; }
    const ctx = {
      productKeys,
      birthYear: p.birthYear,
      sex: p.sex,
      postalCode: p.loc.postalCode,
      locality: entry.place.cityName,
      retrievedAt: entry.fetchedAt.slice(0, 10),
    };
    const all = [];
    for (const product of entry.body[0].additionalProducts || []) {
      const { rows, hidden } = rowsForProduct(product, ctx);
      all.push(...rows);
      const st = (stats[product.productCode] ||= { name: clean(product.titleLongText), caption: clean(product.titleText), variants: {}, hiddenKeys: new Set(), rows: 0 });
      st.rows += rows.length;
      hidden.forEach((k) => st.hiddenKeys.add(k.replace(/_p\d+$/, '')));
      for (const r of rows) {
        const label = [r.cells[3], r.cells[4]].filter(Boolean).join(' / ') || '(produit seul)';
        const v = (st.variants[label] ||= { f: [], m: [] });
        const age = TARIFF_YEAR - p.birthYear;
        if (!v[p.sex].includes(age)) v[p.sex].push(age);
      }
    }
    all.sort((a, b) => a.productSort - b.productSort || a.code.localeCompare(b.code) || cmpArr(a.variantSort, b.variantSort) || cmpArr(a.optionSort, b.optionSort) || String(b.cells[11]).localeCompare(String(a.cells[11])));
    for (const r of all) lines.push(r.cells.map(csvCell).join(','));
  }

  fs.mkdirSync(path.dirname(outCsv), { recursive: true });
  fs.writeFileSync(outCsv, `${lines.join('\n')}\n`, 'utf8');

  // Résumé : plages d'âge observées par produit / variante (toutes localités confondues).
  const range = (ages) => {
    if (!ages.length) return '-';
    const s = [...ages].sort((a, b) => a - b);
    const out = [];
    let start = s[0];
    let prev = s[0];
    for (const a of s.slice(1)) {
      if (a !== prev + 1) { out.push(start === prev ? `${start}` : `${start}-${prev}`); start = a; }
      prev = a;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    return out.join(',');
  };
  console.log(`${lines.length - 1} lignes -> ${outCsv}${missing ? ` (${missing} profils sans réponse en cache)` : ''}`);
  for (const [code, st] of Object.entries(stats)) {
    console.log(`\n${code} | ${st.name} | « ${st.caption} » | ${st.rows} lignes${st.hiddenKeys.size ? ` | clés de prix sans option affichée : ${[...st.hiddenKeys].sort().join(' ')}` : ''}`);
    for (const [label, v] of Object.entries(st.variants)) console.log(`   ${label} — âges f: ${range(v.f)} · m: ${range(v.m)}`);
  }
}

if (!args['build-only']) await collect();
build();
