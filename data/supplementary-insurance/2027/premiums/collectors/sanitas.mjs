#!/usr/bin/env node
// Relevé des primes LCA 2027 de Sanitas dans le calculateur officiel https://calculator.sanitas.com/fr
//
// Méthode : le calculateur (application Vue) obtient ses prix d'une API JSON publique, sans jeton :
//   GET  https://api3.sanitas.com/masterdata/locations?country=CH&q=<NPA>&referenceDate=2027-01-01
//   GET  https://api3.sanitas.com/ovpv3/public/contractStartDate/default
//   POST https://api3.sanitas.com/ovpv3/public/baskets                       (crée un panier, renvoie la structure des produits par personne)
//   PUT  https://api3.sanitas.com/ovpv3/public/basketSimulate/updateProducts (recalcule le panier avec les produits sélectionnés)
// Le script ouvre la page une fois avec Playwright puis rejoue ces appels avec `fetch` dans le contexte de la page.
//
// Points importants constatés le 2026-11-18 :
// - Le prix d'une tuile non sélectionnée (réponse du POST) n'est pas toujours celui de l'offre : seul le prix d'un
//   produit SÉLECTIONNÉ (réponse de basketSimulate, identique à la fenêtre « Détails » et à la page « Panier ») est relevé.
// - Sélectionner plusieurs produits ensemble peut déclencher un « rabais combiné » (Dental + Vital pour les enfants).
//   NPA de --full : un produit par appel (avec son prérequis éventuel). Autres NPA : six tours groupés de produits
//   compatibles, refaits sur les NPA de --full et comparés aux prix isolés ; une variante en désaccord n'est pas écrite.
// - Plusieurs personnes par panier donnent les mêmes prix qu'une personne seule, SAUF à partir du 3e enfant
//   (réduction « Kind3 »). Le script met donc au plus deux mineurs par panier, refuse toute réduction autre que le
//   « rabais variable sur les primes » et recalcule en personne seule les cas signalés.
// - Le prix affiché est net du « rabais variable sur les primes » (Hospital Top Liberty, Hospital Day Comfort,
//   Medical Private) ; le montant et la prime brute sont donnés dans `notes`.
//
// Usage (Playwright installé globalement) :
//   NODE_PATH=$(npm root -g) node collectors/sanitas.mjs
//   options : --out=<csv>            (défaut : ../sanitas.csv à côté du script)
//             --raw=<dossier>        (défaut : <tmp>/sanitas-premiums-2027-raw ; un fichier JSON par panier, sert à la
//                                     reprise : supprimer le dossier pour un relevé neuf)
//             --zips=1003,1204,…     (défaut : 1003,1204,1950,2000,1700,2800 ; « NPA:Localité » si le NPA couvre plusieurs communes)
//             --full=1003            (NPA relevés avec toutes les options ; les autres : variantes par défaut, accident inclus)
//             --others=packed|solo   (NPA hors --full : tours groupés, défaut, ou un produit par appel)
//             --check-packed         (refait les tours groupés sur les NPA de --full ; implicite avec --others=packed)
//             --years=1947-2026 --basket-size=8 --limit-baskets=<n>
//             --csv-only             (reconstruit le CSV depuis --raw, sans appel réseau)
//
// Durée : environ 50 min pour un NPA complet, 15 à 20 min par autre NPA (les calculs hospitaliers du serveur sont lents).
// Rien n'est soumis : prénom fictif « Test », aucune coordonnée, aucun questionnaire de santé, aucune proposition.
// Chaque panier créé (POST /baskets) reste un brouillon anonyme côté Sanitas, comme après « Continuer » dans l'interface.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

const CALCULATOR_URL = 'https://calculator.sanitas.com/fr';
const API = 'https://api3.sanitas.com/ovpv3/public';
const LOCATIONS_API = 'https://api3.sanitas.com/masterdata/locations';
const YEAR = 2027;
const START = '2027-01-01';
// Numéro de partenaire de distribution « Sanitas Internet » envoyé par le calculateur public (observé, non secret).
const DISTRIBUTION_PARTNER = '219369';
const MIN_START_GAP_MS = 1100; // au moins 1 s entre deux requêtes de prix
const MIN_IDLE_MS = 500; // et une pause après chaque réponse
const REQUEST_TIMEOUT_MS = 180000;
const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
const ALLOWED_REDUCTIONS = new Set(['RED_VARIABLER_PRAEMIENRABATT']); // « Rabais variable sur les primes », affiché « Rabais » sur la tuile

// Noms tels qu'affichés par le calculateur (libellés français du bundle products.fr, 2026-11-18).
// `key` : clé du produit dans ../insurers/sanitas.json (correspondance évidente par le nom).
const PRODUCTS = {
  H3SL04Produkt: { key: 'sanitas-hospital-standard-liberty', name: 'Hospital Standard Liberty', variant: 'Division générale' },
  SSOB01Produkt: { key: 'sanitas-hospital-upgrade', name: 'Hospital Upgrade', variant: 'Option de surclassement demi-privée' },
  SSHB01Produkt: { key: 'sanitas-hospital-extra-liberty', name: 'Hospital Extra Liberty', variant: 'Division demi-privée' },
  SSOB02Produkt: { key: 'sanitas-hospital-upgrade', name: 'Hospital Upgrade', variant: 'Option de surclassement privée' },
  SSPB01Produkt: { key: 'sanitas-hospital-top-liberty', name: 'Hospital Top Liberty', variant: 'Division privée' },
  SAMB05Produkt: { key: 'sanitas-hospital-day-comfort', name: 'Hospital Day Comfort', variant: 'Ambulatoire' },
  SSHU01Produkt: { key: 'sanitas-accident-extra-liberty', name: 'Division demi-privée en cas d’accident', variant: 'Accident Extra Liberty', hidden: true },
  SSPU01Produkt: { key: 'sanitas-accident-top-liberty', name: 'Division privée en cas d’accident', variant: 'Accident Top Liberty', hidden: true },
  SAMB06SProdukt: { key: 'sanitas-vital', name: 'Vital', variant: 'Basic' },
  SAMB06MProdukt: { key: 'sanitas-vital', name: 'Vital', variant: 'Smart' },
  SAMB06LProdukt: { key: 'sanitas-vital', name: 'Vital', variant: 'Premium' },
  SDZA02Produkt: { key: 'sanitas-dental-basic', name: 'Dental Basic', variant: 'Assurance des soins dentaires Basic' },
  Z04Produkt: { key: 'sanitas-dental', name: 'Dental', variant: 'Assurance des soins dentaires' },
  PE04Produkt: { key: 'sanitas-medical-private', name: 'Medical Private', variant: 'Libre choix du médecin dans le monde entier' },
  SAMK02Produkt: { key: 'sanitas-desir-d-enfant', name: 'Désir d\'enfant', variant: 'Fonder une famille' },
  SBVB01Produkt: { key: 'sanitas-easy', name: 'Easy', variant: 'L’assurance maladie pour l’étranger', hidden: true },
  PKISProdukt: { key: 'sanitas-capital-maladie', name: 'Capital: invalidité à la suite d’une maladie', variant: '', hidden: true },
  PKTSProdukt: { key: 'sanitas-capital-maladie', name: 'Capital: décès à la suite d’une maladie', variant: '', hidden: true },
  PUISProdukt: { key: 'sanitas-capital-accident', name: 'Capital: invalidité à la suite d’un accident', variant: '', hidden: true },
  PUTSProdukt: { key: 'sanitas-capital-accident', name: 'Capital: décès à la suite d’un accident', variant: '', hidden: true },
};

// Une variante = un produit sélectionné seul (ou avec `parent` / `companion`), une option, accident inclus ou non.
// `set: 'extra'` : relevé seulement pour les NPA de --full.
const hosp = (id) => [
  { id, acc: true, value: 0 },
  { id, acc: true, value: 1500, set: 'extra' },
  { id, acc: true, value: 3000, set: 'extra' },
  { id, acc: true, value: 5000, set: 'extra' },
  { id, acc: false, value: 0, set: 'extra' },
];
const VARIANTS = [
  { id: 'H3SL04Produkt', acc: true },
  { id: 'H3SL04Produkt', acc: false, set: 'extra' },
  { id: 'SSOB01Produkt', parent: { id: 'H3SL04Produkt', acc: true } },
  ...hosp('SSHB01Produkt'),
  { id: 'SSOB02Produkt', parent: { id: 'SSHB01Produkt', acc: true, value: 0 } },
  ...hosp('SSPB01Produkt'),
  { id: 'SAMB05Produkt' },
  { id: 'SSHU01Produkt' },
  { id: 'SSPU01Produkt' },
  { id: 'SAMB06SProdukt' },
  { id: 'SAMB06MProdukt' }, // option proposée par défaut par le calculateur (elle varie avec l'âge)
  { id: 'SAMB06MProdukt', am: 2500, gf: 400, set: 'extra' },
  { id: 'SAMB06MProdukt', am: 2500, gf: 600, set: 'extra' },
  { id: 'SAMB06MProdukt', am: 5000, gf: 400, set: 'extra' },
  { id: 'SAMB06MProdukt', am: 5000, gf: 600, set: 'extra' },
  { id: 'SAMB06LProdukt' },
  { id: 'SDZA02Produkt' },
  { id: 'Z04Produkt', acc: true },
  { id: 'Z04Produkt', acc: false, set: 'extra' },
  { id: 'PE04Produkt', acc: true, companion: 'SAMB06SProdukt' },
  { id: 'PE04Produkt', acc: false, companion: 'SAMB06SProdukt', set: 'extra' },
  { id: 'SAMK02Produkt' },
  { id: 'SBVB01Produkt', duration: '1' },
  { id: 'SBVB01Produkt', duration: '3' },
  { id: 'PKISProdukt', companion: 'SAMB06SProdukt' },
  { id: 'PKTSProdukt', companion: 'SAMB06SProdukt' },
  { id: 'PUISProdukt' },
  { id: 'PUTSProdukt' },
].map((v) => ({ ...v, key: [v.id.replace('Produkt', ''), v.acc === undefined ? '' : v.acc ? 'acc' : 'noacc', v.value === undefined ? '' : `f${v.value}`, v.am ? `am${v.am}gf${v.gf}` : '', v.duration ? `d${v.duration}` : ''].filter(Boolean).join('_') }));

const VAR_BY_KEY = Object.fromEntries(VARIANTS.map((v, i) => [v.key, { ...v, order: i }]));
// Tours « isolés » : une variante par appel. Tours « groupés » : plusieurs produits compatibles sélectionnés ensemble
// (au plus un par groupe exclusif, Dental sans Vital) ; utilisés pour les NPA hors --full, après comparaison avec les
// prix isolés sur tous les profils d'un NPA --full (--check-packed).
const SOLO_ROUNDS = VARIANTS.map((v) => ({ key: v.key, specs: [v], set: v.set }));
const PACKED_ROUNDS = [
  ['R1', ['H3SL04_acc', 'SSOB01', 'SAMB06S', 'SDZA02', 'SAMB05', 'SSPU01', 'PE04_acc', 'PKIS', 'PKTS', 'PUIS', 'PUTS']],
  ['R2', ['SSHB01_acc_f0', 'SSOB02', 'SAMB06M', 'SAMK02']],
  ['R3', ['SSPB01_acc_f0', 'SAMB06L']],
  ['R4', ['Z04_acc', 'SSHU01']],
  ['R5', ['SBVB01_d1']],
  ['R6', ['SBVB01_d3']],
].map(([key, keys]) => ({ key, specs: keys.map((k) => { if (!VAR_BY_KEY[k]) throw new Error(`variante inconnue ${k}`); return VAR_BY_KEY[k]; }) }));

// ---------------------------------------------------------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(args.out || path.join(here, '..', 'sanitas.csv'));
const RAW = path.resolve(args.raw || path.join(os.tmpdir(), 'sanitas-premiums-2027-raw'));
// Un NPA peut couvrir plusieurs communes (1950 : Sion, Grimisuat, Savièse ; 2800 : Delémont, Courrendlin, Develier) :
// la localité voulue est nommée, « NPA:Localité » ; sans nom, la localité du profil standard ci-dessous.
const STANDARD_LOCALITIES = { 1003: 'Lausanne', 1204: 'Genève', 1950: 'Sion', 2000: 'Neuchâtel', 1700: 'Fribourg', 2800: 'Delémont' };
const ZIP_SPECS = String(args.zips || '1003,1204,1950,2000,1700,2800').split(',').map((z) => { const [zip, name] = z.split(':'); return { zip, name: name || STANDARD_LOCALITIES[zip] }; });
const ZIPS = ZIP_SPECS.map((z) => z.zip);
const FULL = new Set(String(args.full ?? '1003').split(','));
const [Y0, Y1] = String(args.years || '1947-2026').split('-').map(Number);
const BASKET_SIZE = Number(args['basket-size'] || 8);
const OTHERS = String(args.others || 'packed'); // packed | solo : méthode pour les NPA hors --full
const CHECK_PACKED = !!args['check-packed'] || OTHERS === 'packed'; // refait les tours groupés sur les NPA --full pour les comparer
const LIMIT_BASKETS = args['limit-baskets'] ? Number(args['limit-baskets']) : Infinity;
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

class Stop extends Error {}

// Profils : 15.06 de chaque année, femme et homme. Au plus deux mineurs (0-18 ans en 2027) par panier.
function buildBaskets() {
  const all = [];
  for (let y = Y1; y >= Y0; y--) for (const gender of ['FEMALE', 'MALE']) all.push({ birthYear: y, gender });
  const minors = all.filter((p) => YEAR - p.birthYear <= 18);
  const others = all.filter((p) => YEAR - p.birthYear > 18);
  const n = Math.max(Math.ceil(all.length / BASKET_SIZE), Math.ceil(minors.length / 2));
  const baskets = Array.from({ length: n }, () => []);
  minors.forEach((p, i) => baskets[Math.floor(i / 2)].push(p));
  let b = 0;
  for (const p of others) {
    let guard = 0;
    while (baskets[b].length >= BASKET_SIZE && guard++ < n) b = (b + 1) % n;
    if (baskets[b].length >= BASKET_SIZE) baskets.push([]), (b = baskets.length - 1);
    baskets[b].push(p);
    b = (b + 1) % baskets.length;
  }
  return baskets.filter((x) => x.length);
}

const priced = (p) => !!(p && Array.isArray(p.prices) && p.prices.length);

// Choisit l'entrée de prix correspondant à la variante ; renvoie null si l'option n'existe pas pour cette personne.
function applySelection(P, spec) {
  const prod = P[spec.id];
  if (!priced(prod)) return null;
  const cur = prod.prices.find((e) => e.selected) || prod.prices[0];
  const hasToggle = prod.prices.some((e) => e.toggle !== undefined);
  if (spec.acc === false && !hasToggle) return null;
  const hasDuration = prod.prices.some((e) => e.duration !== undefined);
  const duration = spec.duration ?? (hasDuration ? '1' : undefined);
  const want = {
    duration,
    value: spec.value ?? cur.value,
    amValue: spec.am ?? cur.amValue,
    gfValue: spec.gf ?? cur.gfValue,
  };
  const target = prod.prices.find((e) => e.duration === want.duration && e.value === want.value && e.amValue === want.amValue && e.gfValue === want.gfValue);
  if (!target) return null;
  prod.selected = true;
  for (const e of prod.prices) {
    e.selected = e === target;
    if (hasToggle && spec.acc !== undefined) e.toggle = spec.acc;
  }
  return { ...want, toggle: hasToggle ? (spec.acc !== undefined ? spec.acc : cur.toggle) : undefined };
}

function readResult(P, spec, want) {
  const prod = P[spec.id];
  if (!prod) return { error: 'product_missing_in_response' };
  const withPrice = (prod.prices || []).filter((e) => e.price !== undefined && e.price !== null);
  const sel = withPrice.filter((e) => e.selected);
  if (!prod.selected || sel.length !== 1) return { error: `no_single_selected_price(${withPrice.length}/${sel.length})`, messages: (prod.messages || []).map((m) => m.key) };
  const e = sel[0];
  if (e.duration !== want.duration || e.value !== want.value || e.amValue !== want.amValue || e.gfValue !== want.gfValue || (want.toggle !== undefined && e.toggle !== want.toggle)) {
    return { error: 'selected_entry_mismatch', got: e };
  }
  return {
    price: e.price,
    reductions: (e.reductions || []).map((r) => ({ type: r.type, amount: r.amount })),
    messages: (prod.messages || []).map((m) => m.key),
    valid: prod.valid,
    toggle: e.toggle,
    value: e.value,
    duration: e.duration,
    amValue: e.amValue,
    gfValue: e.gfValue,
  };
}

async function collect() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ locale: 'fr-CH' });
    const page = await ctx.newPage();
    await page.goto(CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const title = await page.title();
    const body = await page.innerText('body').catch(() => '');
    if (/captcha|access denied|accès refusé/i.test(title + ' ' + body.slice(0, 2000))) throw new Stop(`blocage ou captcha à l'ouverture : ${title}`);
    const version = (body.match(/v(\d+\.\d+\.\d+-[A-Za-z0-9-]+)/) || [])[1];
    log('page :', page.url(), '|', title, '| version', version);

    let lastStart = 0;
    let lastEnd = 0;
    let consecutiveFailures = 0;
    let calls = 0;
    const call = async (method, url, data) => {
      for (let attempt = 1; ; attempt++) {
        await sleep(Math.max(0, lastStart + MIN_START_GAP_MS - Date.now(), lastEnd + MIN_IDLE_MS - Date.now()));
        lastStart = Date.now();
        calls++;
        const full = url + (url.includes('?') ? '&' : '?') + (version ? `v=${version}` : '');
        let res;
        try {
          res = await page.evaluate(async ({ full, method, data, timeout }) => {
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), timeout);
            try {
              const r = await fetch(full, { method, signal: ac.signal, headers: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*' }, body: data === undefined ? undefined : JSON.stringify(data) });
              return { status: r.status, text: await r.text() };
            } catch (e) { return { status: 0, text: String(e) }; } finally { clearTimeout(timer); }
          }, { full, method, data, timeout: REQUEST_TIMEOUT_MS });
        } catch (e) { res = { status: 0, text: String(e) }; }
        lastEnd = Date.now();
        let json = null;
        try { json = JSON.parse(res.text); } catch { /* pas du JSON */ }
        if (res.status === 403 || res.status === 429 || /captcha/i.test(res.text.slice(0, 2000))) throw new Stop(`blocage (${res.status}) sur ${method} ${url} : ${res.text.slice(0, 200)}`);
        if (res.status === 200 && json) { consecutiveFailures = 0; return json; }
        consecutiveFailures++;
        log(`échec ${method} ${url.slice(0, 90)} : statut ${res.status} ${res.text.slice(0, 160)} (tentative ${attempt})`);
        if (consecutiveFailures >= 3 || attempt >= 2) throw new Stop(`erreurs répétées (${consecutiveFailures}) sur ${method} ${url}`);
        await sleep(5000);
      }
    };

    const def = await call('GET', `${API}/contractStartDate/default`);
    if (def.data?.vvgContractStartDate !== START) throw new Stop(`date de début LCA par défaut inattendue : ${JSON.stringify(def.data)}`);
    log('date de début par défaut :', JSON.stringify(def.data));

    const simulate = async (base, persons, mutate) => {
      const b = JSON.parse(JSON.stringify(base));
      b.persons = b.persons.filter((p) => persons.includes(p.personId));
      const wants = {};
      for (const p of b.persons) wants[p.personId] = mutate(p.products.products);
      const targets = b.persons.filter((p) => wants[p.personId]);
      if (!targets.length) return { wants, data: null };
      b.persons = targets;
      const r = await call('PUT', `${API}/basketSimulate/updateProducts?personId=${targets[0].personId}&selectedCalculations=true`, b);
      return { wants, data: r.data };
    };

    const baskets = buildBaskets();
    for (const { zip, name: wanted } of ZIP_SPECS) {
      const dir = path.join(RAW, zip);
      fs.mkdirSync(dir, { recursive: true });
      const loc = await call('GET', `${LOCATIONS_API}?country=CH&q=${zip}&referenceDate=${START}`);
      const candidates = (loc.data || []).filter((a) => a.zipCode === zip);
      const address = wanted ? candidates.find((a) => a.name === wanted) : candidates.length === 1 ? candidates[0] : null;
      if (!address) throw new Stop(`localité ${zip} ${wanted || '(à préciser : NPA:Localité)'} introuvable ; proposées : ${candidates.map((a) => a.displayName).join(' | ') || JSON.stringify(loc).slice(0, 200)}`);
      if (candidates.length > 1) log(`NPA ${zip} : ${candidates.length} localités proposées (${candidates.map((a) => `${a.name} ${a.primeRegion} n°${a.locationNumber}`).join(', ')}) ; retenue : ${address.name}`);
      const marker = path.join(dir, 'locality.txt');
      if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') !== address.name) throw new Stop(`${dir} contient un relevé pour une autre localité (${fs.readFileSync(marker, 'utf8')})`);
      fs.writeFileSync(marker, address.name);
      const mainRounds = FULL.has(zip) ? SOLO_ROUNDS : OTHERS === 'packed' ? PACKED_ROUNDS : SOLO_ROUNDS.filter((r) => r.set !== 'extra');
      log(`== ${zip} ${address.name} (${address.canton}, région ${address.primeRegion}) : ${baskets.length} paniers, ${mainRounds.length} appels de prix par panier`);

      for (let bi = 0; bi < Math.min(baskets.length, LIMIT_BASKETS); bi++) {
        const file = path.join(dir, `basket-${String(bi).padStart(2, '0')}.json`);
        const checkFile = path.join(dir, `packed-${String(bi).padStart(2, '0')}.json`);
        const needMain = !fs.existsSync(file);
        const needCheck = CHECK_PACKED && FULL.has(zip) && !fs.existsSync(checkFile);
        if (!needMain && !needCheck) continue;
        const t0 = Date.now();
        const people = baskets[bi].map((p) => ({ ...p, personId: crypto.randomUUID() }));
        const payload = {
          language: 'FR', contractStartDate: START, basketId: crypto.randomUUID(),
          distributionPartners: ['OFFERTE', 'ABSCHLUSS', 'BETREUER'].map((t) => ({ distributionPartnerType: t, distributionPartnerNumber: DISTRIBUTION_PARTNER })),
          persons: people.map((p, i) => ({ order: i + 1, contractModified: true, collectivePersonGroup: null, immigrant: false, kvgContractStartDate: START, vvgContractStartDate: START, personData: { dateOfBirth: `${p.birthYear}-06-15`, firstName: 'Test', lastName: null, gender: p.gender }, personId: p.personId })),
          address, channel: 'OVP',
        };
        const created = await call('POST', `${API}/baskets`, payload);
        const base = created.data;
        if (!base || base.contractStartDate !== START || base.persons.length !== people.length) throw new Stop(`réponse de panier inattendue : ${JSON.stringify(created).slice(0, 300)}`);
        const byId = Object.fromEntries(base.persons.map((p) => [p.personId, p]));
        for (const p of people) if (byId[p.personId].vvgContractStartDate !== START) throw new Stop('date de début LCA modifiée par le serveur');

        // Disponibilité et prix « tuile » (produit non sélectionné), gardés pour l'analyse, jamais écrits dans le CSV.
        const tiles = people.map((p) => ({
          birthYear: p.birthYear, gender: p.gender,
          products: Object.fromEntries(Object.entries(byId[p.personId].products.products).filter(([id]) => PRODUCTS[id] || !/^O/.test(id)).map(([id, prod]) => {
            const e = (prod.prices || []).find((x) => x.selected && x.price !== undefined);
            return [id, { messages: (prod.messages || []).map((m) => m.key), price: e?.price, toggle: e?.toggle, value: e?.value, duration: e?.duration, amValue: e?.amValue, gfValue: e?.gfValue, options: (prod.prices || []).map((x) => [x.duration, x.value, x.amValue, x.gfValue].map((z) => z ?? '').join('/')) }];
          })),
        }));

        const ids = people.map((p) => p.personId);
        const mutateSpec = (P, v) => {
          if (!priced(P[v.id])) return null;
          if (v.parent && !applySelection(P, v.parent)) return null;
          if (v.companion && priced(P[v.companion]) && !applySelection(P, { id: v.companion })) return null;
          const want = applySelection(P, v);
          return want && { ...want, companion: v.companion && priced(P[v.companion]) ? v.companion : undefined };
        };
        const mutateFor = (round) => (P) => {
          const wants = {};
          for (const v of round.specs) { const w = mutateSpec(P, v); if (w) wants[v.key] = w; }
          return Object.keys(wants).length ? wants : null;
        };
        const odd = (r) => !r.error && r.reductions.some((x) => !ALLOWED_REDUCTIONS.has(x.type));
        const runRounds = async (rounds) => {
          const records = [];
          for (const round of rounds) {
            const { wants, data } = await simulate(base, ids, mutateFor(round));
            if (!data) continue;
            const out = Object.fromEntries(data.persons.map((p) => [p.personId, p]));
            for (const p of people) {
              for (const v of round.specs) {
                const want = wants[p.personId]?.[v.key];
                if (!want) continue;
                let res = readResult(out[p.personId].products.products, v, want);
                let mode = `basket_of_${data.persons.length}`;
                if (odd(res)) {
                  // Réduction liée à la composition du panier (p. ex. 3e enfant) ou à la combinaison de produits :
                  // on recalcule cette personne seule, puis au besoin ce produit seul.
                  const first = res.reductions.map((x) => x.type).join('+');
                  const one = await simulate(base, [p.personId], mutateFor(round));
                  res = readResult(one.data.persons[0].products.products, v, one.wants[p.personId][v.key]);
                  mode = `single_person_after_${first}`;
                  if (odd(res) && round.specs.length > 1) {
                    const solo = await simulate(base, [p.personId], mutateFor({ specs: [v] }));
                    res = readResult(solo.data.persons[0].products.products, v, solo.wants[p.personId][v.key]);
                    mode = `single_person_single_product_after_${first}`;
                  }
                  if (odd(res)) res = { error: `unexpected_reduction:${res.reductions.map((x) => x.type).join('+')}`, price_seen: res.price };
                }
                records.push({ zip, locality: address.name, birthYear: p.birthYear, gender: p.gender, variant: v.key, id: v.id, acc: v.acc, companion: want.companion, parent: v.parent?.id, round: round.specs.length > 1 && !/single_product/.test(mode) ? round.key : undefined, mode, ...res });
              }
            }
          }
          return records;
        };
        const meta = { zip, address, basket: bi, retrievedAt: TODAY, contractStartDate: base.contractStartDate, people: people.map(({ birthYear, gender }) => ({ birthYear, gender })) };
        let summary = '';
        if (needMain) {
          const records = await runRounds(mainRounds);
          fs.writeFileSync(file, JSON.stringify({ ...meta, tiles, records }));
          const errs = records.filter((r) => r.error).length;
          summary += `${records.length} prix${errs ? `, ${errs} anomalies` : ''}`;
        }
        if (needCheck) {
          const records = await runRounds(PACKED_ROUNDS);
          fs.writeFileSync(checkFile, JSON.stringify({ ...meta, records }));
          summary += `${summary ? ' + ' : ''}${records.length} prix groupés de contrôle`;
        }
        log(`${zip} panier ${bi + 1}/${baskets.length} : ${people.length} pers., ${summary}, ${Math.round((Date.now() - t0) / 1000)} s, ${calls} appels`);
      }
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
const csv = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const chf = (n) => `CHF ${n}`;

function optionLabel(v, r) {
  if (v.id === 'SBVB01Produkt') return r.duration === '3' ? 'durée contractuelle 3 ans (défaut du calculateur)' : 'durée contractuelle 1 an';
  if (/^P[KU][IT]SProdukt$/.test(v.id)) return `somme assurée ${chf(r.value)}`;
  if (v.id === 'SAMB06MProdukt') return v.am ? `médecine alternative ${chf(r.amValue)}; promotion de la santé ${chf(r.gfValue)}` : '';
  if (v.value) return `franchise hospitalière ${chf(v.value)}`;
  return '';
}

function notesFor(v, r, tile) {
  const n = [`internal=${v.id}`];
  const red = r.reductions.find((x) => x.type === 'RED_VARIABLER_PRAEMIENRABATT');
  if (red) n.push(`variable_premium_discount_included=${red.amount.toFixed(2)}`, `gross_before_discount=${(r.price - red.amount).toFixed(2)}`);
  if (v.id === 'SAMB06MProdukt' && !v.am) n.push(`default_option: médecine alternative CHF ${r.amValue}, promotion de la santé CHF ${r.gfValue}`);
  if ((v.id === 'SSHB01Produkt' || v.id === 'SSPB01Produkt') && !v.value) n.push(tile && tile.value !== 0 && tile.value !== undefined ? `calculator_default_franchise=${tile.value}` : 'default_option: franchise hospitalière CHF 0');
  if (/^P[KU][IT]SProdukt$/.test(v.id)) n.push('sum_insured_is_calculator_default_for_this_age');
  if (v.acc !== undefined && tile && tile.toggle !== undefined && tile.toggle !== v.acc) n.push(`calculator_default_accident=${tile.toggle}`);
  if (v.parent) n.push(`requires=${PRODUCTS[v.parent.id].name}; priced_with_parent_selected`);
  if (r.companion) n.push(`requires_another_product; priced_with=${PRODUCTS[r.companion].name} ${PRODUCTS[r.companion].variant}`);
  else if (v.companion) n.push('requires_another_product; priced_alone');
  if (PRODUCTS[v.id].hidden) n.push('hidden_in_calculator_ui');
  if (v.id === 'PUISProdukt' || v.id === 'PUTSProdukt' || v.id === 'SSHU01Produkt' || v.id === 'SSPU01Produkt') n.push('accident_only_cover');
  const msgs = r.messages.filter((m) => !(v.parent && m === 'REQUIRED_PARENT_PRODUCT_COMBINATION'));
  if (msgs.length) n.push(`api_messages=${msgs.join('+')}`);
  if (r.round) n.push(`priced_in_combined_selection=${r.round}`);
  if (/^single_person/.test(r.mode)) n.push(`recalculated_${r.mode}`);
  return n.join('; ');
}

// Compare, sur les NPA --full, les prix des tours groupés aux prix isolés ; renvoie les variantes en désaccord.
function checkPacked() {
  const bad = new Set();
  let n = 0;
  for (const zip of ZIPS.filter((z) => FULL.has(z))) {
    const dir = path.join(RAW, zip);
    if (!fs.existsSync(dir)) continue;
    const solo = {};
    for (const f of fs.readdirSync(dir).filter((x) => /^basket-\d+\.json$/.test(x))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).records) solo[`${r.birthYear}|${r.gender}|${r.variant}`] = r;
    for (const f of fs.readdirSync(dir).filter((x) => /^packed-\d+\.json$/.test(x))) {
      for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).records) {
        const s = solo[`${r.birthYear}|${r.gender}|${r.variant}`];
        n++;
        if (!s || r.error || s.error || s.price !== r.price || JSON.stringify(s.reductions) !== JSON.stringify(r.reductions)) {
          bad.add(r.variant);
          log(`  écart groupé/isolé ${zip} ${r.birthYear} ${r.gender} ${r.variant} : groupé ${r.error || r.price} (${r.mode}), isolé ${s ? s.error || s.price : 'absent'}`);
        }
      }
    }
  }
  log(`contrôle des tours groupés : ${n} prix comparés aux prix isolés, variantes en désaccord : ${[...bad].join(', ') || 'aucune'}`);
  return { bad, n };
}

function writeCsv() {
  const rows = [];
  const anomalies = [];
  const { bad } = checkPacked();
  const smartDefault = {}; // option Vital Smart par défaut de chaque profil, pour ne pas l'écrire deux fois
  for (const zip of ZIPS) {
    const dir = path.join(RAW, zip);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /^basket-\d+\.json$/.test(x)).sort()) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const tiles = Object.fromEntries(raw.tiles.map((t) => [`${t.birthYear}${t.gender}`, t.products]));
      for (const r of raw.records) if (r.variant === 'SAMB06M' && !r.error) smartDefault[`${zip}|${r.birthYear}|${r.gender}`] = `${r.amValue}/${r.gfValue}`;
      for (const r of raw.records) {
        const v = VAR_BY_KEY[r.variant];
        if (!v) continue;
        if (r.error || typeof r.price !== 'number') { anomalies.push(r); continue; }
        if (r.round && bad.has(r.variant)) { anomalies.push({ ...r, error: 'packed_round_not_validated_for_this_variant' }); continue; }
        if (v.id === 'SAMB06MProdukt' && v.am && smartDefault[`${zip}|${r.birthYear}|${r.gender}`] === `${r.amValue}/${r.gfValue}`) continue;
        rows.push({
          zipOrder: ZIPS.indexOf(zip), order: v.order, birthYear: r.birthYear, sexOrder: r.gender === 'FEMALE' ? 0 : 1,
          line: ['sanitas', PRODUCTS[v.id].key, PRODUCTS[v.id].name, PRODUCTS[v.id].variant, optionLabel(v, r), YEAR, r.birthYear, YEAR - r.birthYear, r.gender === 'FEMALE' ? 'f' : 'm', zip, raw.address.name,
            r.toggle === undefined ? '' : String(r.toggle), r.price.toFixed(2), 'official_calculator', CALCULATOR_URL, raw.retrievedAt, notesFor(v, r, (tiles[`${r.birthYear}${r.gender}`] || {})[v.id])].map(csv).join(','),
        });
      }
    }
  }
  rows.sort((a, b) => a.zipOrder - b.zipOrder || a.order - b.order || a.birthYear - b.birthYear || a.sexOrder - b.sexOrder);
  fs.writeFileSync(OUT, [HEADER, ...rows.map((r) => r.line)].join('\n') + '\n');
  log(`${rows.length} lignes écrites dans ${OUT} ; ${anomalies.length} anomalies non écrites`);
  for (const a of anomalies.slice(0, 40)) log('  anomalie :', JSON.stringify(a));
}

try {
  if (!args['csv-only']) await collect();
  writeCsv();
} catch (e) {
  if (e instanceof Stop) { log('ARRÊT :', e.message); writeCsv(); process.exit(2); }
  throw e;
}
