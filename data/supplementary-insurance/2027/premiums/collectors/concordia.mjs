#!/usr/bin/env node
// Relevé des primes LCA 2027 de CONCORDIA dans le calculateur officiel
// https://www.praemienrechner.concordia.ch/ipr/home?lang=fr
//
// Méthode : le calculateur (Angular) obtient tous ses prix d'un seul appel JSON,
// POST /ipr/rest/praemien. Le script ouvre la page d'accueil une fois avec Playwright, puis rejoue
// cet appel avec fetch() dans le contexte de la page (mêmes cookies, même origine).
// Il s'arrête avant toute offre : aucun appel à /rest/antrag, aucune coordonnée transmise.
//
// Usage :
//   node concordia.mjs [--out <fichier.csv>] [--raw-dir <dossier>] [--localities 1003,1204]
//                      [--franchise-localities 1003] [--years 1947-2026] [--delay-ms 1100]
//   --raw-dir : garde chaque réponse brute et la réutilise à la relance (reprise après arrêt).
//
// Sortie par défaut : ../concordia.csv (à côté du dossier collectors/).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://www.praemienrechner.concordia.ch';
const BASE = `${ORIGIN}/ipr`;
const CALCULATOR_URL = `${BASE}/home?lang=fr`;
const TARIFF_YEAR = 2027;
const START_DATE = `${TARIFF_YEAR}-01-01`;
const BIRTH_DAY = '06-15';

const ALL_LOCALITIES = [
  { postalCode: '1003', locality: 'Lausanne' },
  { postalCode: '1204', locality: 'Genève' },
  { postalCode: '1950', locality: 'Sion' },
  { postalCode: '2000', locality: 'Neuchâtel' },
  { postalCode: '1700', locality: 'Fribourg' },
  { postalCode: '2800', locality: 'Delémont' },
];
// Franchises annuelles proposées par le calculateur pour PRIVÉE (PE1) et MI-PRIVÉE (PE2) ; 0 = défaut.
const HOSPITAL_FRANCHISES = [1000, 2000, 3000, 5000, 10000];
// Années revérifiées en demande individuelle (une seule personne) contre la demande à deux personnes.
const SINGLE_CHECK_YEARS = [1962, 1963, 1975, 1990, 2008, 2009, 2015, 2026];

const BASIC_KEYS = new Set(['A', 'AHMO', 'AmyDoc', 'AsmDoc']); // assurance de base LAMal : hors périmètre
const LEGACY_DIMA_KEYS = new Set(['TIKU_Tod', 'TIKU_Invaliditaet']); // ancienne génération DIMA, jamais demandée par l'interface

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`argument inattendu : ${key}`);
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv);
const OUT = path.resolve(args.out ?? path.join(HERE, '..', 'concordia.csv'));
const RAW_DIR = args['raw-dir'] ? path.resolve(args['raw-dir']) : null;
const DELAY_MS = Math.max(1000, Number(args['delay-ms'] ?? 1100));
const [YEAR_FROM, YEAR_TO] = (args.years ?? '1947-2026').split('-').map(Number);
const LOCALITIES = args.localities
  ? args.localities.split(',').map((npa) => {
      const found = ALL_LOCALITIES.find((l) => l.postalCode === npa);
      if (!found) throw new Error(`NPA non prévu : ${npa}`);
      return found;
    })
  : ALL_LOCALITIES;
const FRANCHISE_LOCALITIES = new Set((args['franchise-localities'] ?? '1003').split(',').filter(Boolean));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (value) => Number(value).toFixed(2);
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const stripTags = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

// Configuration envoyée par l'interface pour l'assurance de base (sans effet sur les primes LCA).
function basicConfig(birthYear) {
  const age = TARIFF_YEAR - birthYear;
  if (age <= 18) return { unfalldeckung: true, franchise: 0 };
  if (age <= 64) return { unfalldeckung: false, franchise: 2500 };
  return { unfalldeckung: true, franchise: 300 };
}

function member(personIndex, birthYear, sex, hospitalFranchise) {
  const basic = basicConfig(birthYear);
  return {
    personIndex,
    produktSelection: {}, // aucune sélection : ni assurance de base ni combinaison
    produktConfigurations: {
      A: basic,
      AHMO: basic,
      AmyDoc: basic,
      AsmDoc: basic,
      PE1: { unfalldeckung: true, franchise: hospitalFranchise },
      PE2: { unfalldeckung: true, franchise: hospitalFranchise },
      PE4: { unfalldeckung: true },
      PE3: { unfalldeckung: true },
    },
    birthDate: `${birthYear}-${BIRTH_DAY}`,
    geschlecht: sex, // 'w' ou 'm'
    vertragsBeginnKVG: START_DATE,
    vertragsBeginnVVG: START_DATE,
    vertragsBeginnVorsorgeProdukte: START_DATE,
  };
}

class Client {
  constructor(page) {
    this.page = page;
    this.lastPriceCall = 0;
    this.consecutiveErrors = 0;
    this.networkCalls = 0;
  }

  async call(method, urlPath, body) {
    const result = await this.page.evaluate(
      async ({ url, method: m, body: b }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          const headers = { accept: 'application/json, text/plain, */*' };
          if (b) headers['content-type'] = 'application/json';
          const res = await fetch(url, { method: m, headers, body: b ? JSON.stringify(b) : undefined, signal: controller.signal });
          return { status: res.status, text: await res.text() };
        } catch (error) {
          return { status: 0, text: String(error) };
        } finally {
          clearTimeout(timer);
        }
      },
      { url: `${BASE}${urlPath}`, method, body: body ?? null },
    );
    this.networkCalls += 1;
    return result;
  }

  // Appel avec cache optionnel, cadence et arrêt sur blocage ou erreurs répétées.
  async cached(cacheKey, method, urlPath, body) {
    const file = RAW_DIR ? path.join(RAW_DIR, `${cacheKey}.json`) : null;
    if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    for (let attempt = 1; ; attempt += 1) {
      const wait = this.lastPriceCall + DELAY_MS - Date.now();
      if (wait > 0) await sleep(wait);
      const res = await this.call(method, urlPath, body);
      this.lastPriceCall = Date.now();
      const blocked = [401, 403, 407, 429].includes(res.status) || /captcha/i.test(res.text.slice(0, 2000));
      if (blocked) throw new Error(`blocage ou captcha (${res.status}) sur ${urlPath} : arrêt immédiat`);
      if (res.status === 200) {
        this.consecutiveErrors = 0;
        const record = { retrievedAt: new Date().toISOString().slice(0, 10), request: body ?? null, response: JSON.parse(res.text) };
        if (file) fs.writeFileSync(file, JSON.stringify(record));
        return record;
      }
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors >= 3 || attempt >= 2) {
        throw new Error(`erreurs répétées (${res.status}) sur ${urlPath} : ${res.text.slice(0, 200)}`);
      }
      await sleep(5000);
    }
  }
}

// Index des primes LCA d'une personne : clé stable -> entrée brute.
function indexPerson(response, personIndex) {
  const person = response.personProduktPraemienMap?.[String(personIndex)];
  if (!person) throw new Error(`réponse sans personne ${personIndex}`);
  const index = new Map();
  for (const entry of person.personProduktPraemien) {
    const product = entry.praemienRequestProdukt;
    if (BASIC_KEYS.has(product.produkt) || LEGACY_DIMA_KEYS.has(product.produkt)) continue;
    const key = [product.produkt, product.insuredAmount ?? '', product.tikuUnfallEinschluss ?? ''].join('|');
    index.set(key, entry);
  }
  return index;
}

function describe(entry, labels) {
  const product = entry.praemienRequestProdukt;
  const code = product.produkt;
  const title = (group, key) => stripTags(labels.PRODUKTE[group][key].TITLE);
  if (/^PE[1-4]$/.test(code)) {
    return { group: 1, productName: stripTags(labels.PRODUKTE.SPITAL_VERSICHERUNG.NAME), variant: title('SPITAL_VERSICHERUNG', code), variantRank: { PE3: 1, PE4: 2, PE2: 3, PE1: 4 }[code], accident: 'true' };
  }
  if (/^A1(-|$)/.test(code)) {
    return { group: 2, productName: title('AMBULANTE_ZUSATZVERSICHERUNG', 'A1'), variant: title('AMBULANTE_ZUSATZVERSICHERUNG', code), variantRank: ['A1', 'A1-Care', 'A1-Plus', 'A1-Premium'].indexOf(code), accident: '' };
  }
  if (/^A2(-|$)/.test(code)) {
    return { group: 3, productName: title('ALTERNATIVE_ZUSATZVERSICHERUNG', 'A2'), variant: title('ALTERNATIVE_ZUSATZVERSICHERUNG', code), variantRank: ['A2', 'A2-Plus'].indexOf(code), accident: '' };
  }
  if (/^Z-[1-4]$/.test(code)) {
    return { group: 4, productName: stripTags(labels.PRODUKTE.ZAHN_ZUSATZVERSICHERUNG['Z-NONE'].TITLE).replace(/^Pas d'/, ''), variant: title('ZAHN_ZUSATZVERSICHERUNG', code), variantRank: Number(code.slice(2)), accident: '' };
  }
  const accidenta = /^G_(\d+)_(\d+)$/.exec(code);
  if (accidenta) {
    const death = Number(accidenta[1]);
    const disability = Number(accidenta[2]);
    return { group: 5, productName: title('ACCIDENTA_ZUSATZVERSICHERUNG', 'ACCIDENTA'), variant: `CHF ${thousands(death)} / ${thousands(disability)}`, variantRank: death * 1e7 + disability, accident: 'true', note: 'variant=capital décès / invalidité' };
  }
  if (code === 'TIKU2026_Tod' || code === 'TIKU2026_Invaliditaet') {
    const group = code === 'TIKU2026_Tod' ? 'TIKU2026_TODESFALL' : 'TIKU2026_INVALIDITAET';
    const withAccident = product.tikuUnfallEinschluss === true;
    return {
      group: code === 'TIKU2026_Tod' ? 6 : 7,
      productName: stripTags(labels.PRODUKTE[group].TITLE),
      variant: `CHF ${thousands(product.insuredAmount)}`,
      variantRank: product.insuredAmount,
      option: withAccident ? 'avec accident' : 'sans accident',
      optionRank: withAccident ? 0 : 1,
      accident: withAccident ? 'true' : 'false',
      note: 'variant=somme assurée;api_only_not_shown_in_public_calculator',
    };
  }
  return { group: 9, productName: code, variant: JSON.stringify(product), variantRank: 0, accident: '', note: 'unmapped_product_key' };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  if (RAW_DIR) fs.mkdirSync(RAW_DIR, { recursive: true });
  const browser = await chromium.launch();
  const rows = [];
  const anomalies = [];
  let client;
  try {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    client = new Client(page);

    const labels = (await client.cached('i18n-fr', 'GET', '/assets/i18n/fr.json')).response;

    const years = [];
    for (let year = YEAR_TO; year >= YEAR_FROM; year -= 1) years.push(year);

    const addRows = (record, locality, region, birthYear, sex, personIndex, franchise) => {
      const index = indexPerson(record.response, personIndex);
      for (const entry of index.values()) {
        const code = entry.praemienRequestProdukt.produkt;
        const supportsFranchise = code === 'PE1' || code === 'PE2';
        if (franchise > 0 && !supportsFranchise) continue; // seules PRIVÉE et MI-PRIVÉE changent
        const info = describe(entry, labels);
        const premium = entry.praemie;
        const deductions = Object.entries(premium.deductions ?? {});
        const notes = [`region=${region}`];
        if (info.note) notes.push(info.note);
        let monthly;
        let option = info.option ?? '';
        if (franchise > 0) {
          const only = deductions.length === 1 && deductions[0][0] === 'SPITALVERSICHERUNG_JAHRESFRANCHISE';
          if (!only) anomalies.push(`${locality.postalCode} ${birthYear} ${sex} ${code} franchise ${franchise} : déductions inattendues ${JSON.stringify(premium.deductions)}`);
          monthly = premium.totalPraemie;
          option = `franchise ${thousands(franchise)}`;
          notes.push(`prime_sans_franchise=${money(premium.grundPraemie)}`, `rabais_franchise=${money(deductions[0]?.[1] ?? 0)}`);
        } else {
          monthly = premium.grundPraemie;
          if (deductions.length > 0 || Number(premium.totalPraemie) !== Number(premium.grundPraemie)) {
            anomalies.push(`${locality.postalCode} ${birthYear} ${sex} ${code} : déduction sur la prime par défaut ${JSON.stringify(premium.deductions)}`);
            notes.push(`deductions=${JSON.stringify(premium.deductions)}`, `total=${money(premium.totalPraemie)}`);
          }
        }
        if (premium.gueltigAb !== START_DATE) notes.push(`valable_des=${premium.gueltigAb}`);
        rows.push({
          sort: [LOCALITIES.indexOf(locality), info.group, info.variantRank, franchise, info.optionRank ?? 0, sex === 'w' ? 0 : 1, birthYear],
          cells: ['concordia', '', info.productName, info.variant, option, TARIFF_YEAR, birthYear, TARIFF_YEAR - birthYear, sex === 'w' ? 'f' : 'm', locality.postalCode, locality.locality, info.accident, money(monthly), 'official_calculator', CALCULATOR_URL, record.retrievedAt, notes.join(';')],
        });
      }
      return index;
    };

    for (const locality of LOCALITIES) {
      const lookup = await client.cached(`plz-${locality.postalCode}`, 'GET', `/rest/general/gemeinden/plz/${locality.postalCode}`);
      const commune = lookup.response.find((c) => c.gemeindename === locality.locality) ?? lookup.response.find((c) => c.ort === locality.locality);
      if (!commune) throw new Error(`commune introuvable pour ${locality.postalCode} ${locality.locality}`);
      const region = commune.iprPraemienregion;
      const withHospitalFranchise = [];
      const pairIndex = new Map();

      for (const birthYear of years) {
        const body = { praemienregion: region, familyMembers: [member(0, birthYear, 'w', 0), member(1, birthYear, 'm', 0)] };
        const record = await client.cached(`praemien-${region}-${birthYear}-fr0`, 'POST', '/rest/praemien', body);
        const women = addRows(record, locality, region, birthYear, 'w', 0, 0);
        const men = addRows(record, locality, region, birthYear, 'm', 1, 0);
        pairIndex.set(`${birthYear}|w`, women);
        pairIndex.set(`${birthYear}|m`, men);
        if (women.has('PE1||') || women.has('PE2||') || men.has('PE1||') || men.has('PE2||')) withHospitalFranchise.push(birthYear);
      }
      console.log(`${locality.postalCode} ${locality.locality} (${region}) : ${years.length} années relevées`);

      // Contrôle : la demande à deux personnes donne les mêmes primes qu'une demande individuelle.
      if (locality === LOCALITIES[0]) {
        let compared = 0;
        for (const birthYear of SINGLE_CHECK_YEARS.filter((y) => y >= YEAR_FROM && y <= YEAR_TO)) {
          for (const sex of ['w', 'm']) {
            const body = { praemienregion: region, familyMembers: [member(0, birthYear, sex, 0)] };
            const record = await client.cached(`single-${region}-${birthYear}-${sex}`, 'POST', '/rest/praemien', body);
            const single = indexPerson(record.response, 0);
            const pair = pairIndex.get(`${birthYear}|${sex}`);
            const keys = new Set([...single.keys(), ...pair.keys()]);
            for (const key of keys) {
              const a = JSON.stringify(single.get(key)?.praemie);
              const b = JSON.stringify(pair.get(key)?.praemie);
              if (a !== b) throw new Error(`écart individuel/couple ${birthYear} ${sex} ${key} : ${a} vs ${b}`);
              compared += 1;
            }
          }
        }
        console.log(`contrôle demande individuelle vs demande à deux : ${compared} primes identiques`);
      }

      if (FRANCHISE_LOCALITIES.has(locality.postalCode)) {
        for (const franchise of HOSPITAL_FRANCHISES) {
          for (const birthYear of withHospitalFranchise) {
            const body = { praemienregion: region, familyMembers: [member(0, birthYear, 'w', franchise), member(1, birthYear, 'm', franchise)] };
            const record = await client.cached(`praemien-${region}-${birthYear}-fr${franchise}`, 'POST', '/rest/praemien', body);
            addRows(record, locality, region, birthYear, 'w', 0, franchise);
            addRows(record, locality, region, birthYear, 'm', 1, franchise);
          }
          console.log(`${locality.postalCode} franchise ${franchise} : ${withHospitalFranchise.length} années relevées`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  rows.sort((a, b) => {
    for (let i = 0; i < a.sort.length; i += 1) if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i];
    return 0;
  });
  const header = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
  fs.writeFileSync(OUT, `${header}\n${rows.map((row) => row.cells.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
  console.log(`${rows.length} lignes écrites dans ${OUT} (${client.networkCalls} appels réseau)`);
  if (anomalies.length > 0) {
    console.log(`${anomalies.length} anomalies :`);
    for (const anomaly of anomalies.slice(0, 50)) console.log(`  ${anomaly}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
