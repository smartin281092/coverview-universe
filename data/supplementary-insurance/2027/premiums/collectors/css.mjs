#!/usr/bin/env node
// Relevé des primes LCA 2027 dans le calculateur officiel CSS (https://calculator.css.ch/start?lang=fr).
//
// Méthode : le calculateur (Angular) parle à une API JSON sous
//   https://api.css.ch/css/angebot/v2/kv/web/rechner
// Le script ouvre le calculateur une fois avec Playwright puis rejoue les appels de prix
// avec fetch() DANS la page (mêmes cookies, même origine que l'application).
//
// Par profil (localité × année de naissance × sexe) :
//   POST   /rechner/{offre}/personen                      -> tous les produits, variantes et options par défaut
//   PUT    /rechner/{offre}/personen/{id}/produkte/vvg    -> un seul produit modifié par appel (comme l'interface)
//   DELETE /rechner/{offre}/personen/{id}                 -> la personne est retirée (pas d'effet famille)
// L'offre est réglée sur une durée de contrat de 1 an (PUT /rechner/{offre}), donc sans rabais pluriannuel.
// Aucune demande d'offre, aucune coordonnée : seuls prénom « Test », date de naissance, sexe et NPA sont envoyés.
//
// Usage :
//   node css.mjs                                   # 6 localités, 1947-2026, f+m
//   node css.mjs --localities 1003 --years 1990-1992 --raw /chemin/cache.jsonl --out /chemin/css.csv
// Options :
//   --localities  NPA séparés par des virgules (défaut : 1003,1204,1950,2000,1700,2800)
//   --years       plage d'années de naissance (défaut : 1947-2026)
//   --extended    NPA pour lesquels les options « Attestation dentaire: sans » et « Option Upgrade: avec »
//                 sont aussi relevées, soit 3 appels de prix de plus par profil (défaut : 1003)
//   --raw         cache JSONL des réponses réduites, permet la reprise (défaut : dossier temporaire du système)
//   --out         CSV de sortie (défaut : ../css.csv à côté de ce script)
//   --insurer     fichier assureur d'où viennent les product_key (défaut : ../../insurers/css.json)
//   --csv-only    reconstruit le CSV depuis le cache sans appeler le calculateur

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

const CALCULATOR_URL = 'https://calculator.css.ch/start?lang=fr';
const API = 'https://api.css.ch/css/angebot/v2/kv/web/rechner';
const PLZ_URL = 'https://api.css.ch/css/anzu/v1/stammdaten/plz/all';
const TRANSLATIONS_URL = 'https://calculator.css.ch/api/translations/fr';
const TARIFF_YEAR = 2027;
const START_DATE = '2027-01-01';
const CONTRACT_YEARS = 1;
const PRICE_DELAY_MS = 1100; // au moins 1 s entre deux requêtes de prix
const OFFER_REUSE = 40; // nouvelle offre toutes les N personnes
const MAX_CONSECUTIVE_ERRORS = 3;

// NPA -> commune retenue quand le NPA couvre plusieurs communes (libellés des données de référence CSS)
const LOCALITIES = {
  1003: { locality: 'Lausanne', gemeinde: 'Lausanne' },
  1204: { locality: 'Genève', gemeinde: 'Genève' },
  1950: { locality: 'Sion', gemeinde: 'Sion' },
  2000: { locality: 'Neuchâtel', gemeinde: 'Neuchâtel' },
  1700: { locality: 'Fribourg', gemeinde: 'Freiburg' },
  2800: { locality: 'Delémont', gemeinde: 'Delémont' },
};

// Noms de produits tels qu'affichés par le calculateur (version française, relevés à l'écran le 2026-11-18).
const PRODUCT_NAMES = {
  AMBULANT_MYFLEX: 'Assurance ambulatoire myFlex',
  SPITAL_MYFLEX: 'Assurance d’hospitalisation myFlex',
  ALTERNATIVVERSICHERUNG_MYFLEX: 'Assurance pour médecine alternative myFlex',
  HEILUNGSKOSTEN_UNFALL: "Assurance des frais de guérison en cas d'accident",
  ZAHNPFLEGE: 'Assurance pour soins dentaires',
  UTI: 'Assurance en cas de décès ou d’invalidité par accident',
  KTI: 'Assurance pour décès ou invalidité par maladie',
};
const PRODUCT_ORDER = Object.keys(PRODUCT_NAMES);
// Clés de ../../insurers/css.json ; utilisées seulement si le fichier existe et contient la clé.
const PRODUCT_KEYS = {
  AMBULANT_MYFLEX: 'css-myflex-ambulatoire',
  SPITAL_MYFLEX: 'css-myflex-hospitalisation',
  ALTERNATIVVERSICHERUNG_MYFLEX: 'css-myflex-medecine-alternative',
  HEILUNGSKOSTEN_UNFALL: 'css-frais-guerison-accident',
  ZAHNPFLEGE: 'css-soins-dentaires',
  UTI: 'css-deces-invalidite-accident',
  KTI: 'css-deces-invalidite-maladie',
};
// Produits gratuits ajoutés d'office par le calculateur (prime 0, non sélectionnables) : pas relevés.
const SKIPPED_PRODUCTS = new Set(['GESUNDHEITSKONTO', 'GESUNDHEITSKONTO_BONUS', 'PRIVATE_ASSISTANCE']);

const CSV_HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';

function parseArgs(argv) {
  const a = { localities: Object.keys(LOCALITIES).map(Number), years: [1947, 2026], extended: [1003], raw: path.join(os.tmpdir(), 'coverview-css-premiums-2027.jsonl'), out: path.join(HERE, '..', 'css.csv'), insurer: path.join(HERE, '..', '..', 'insurers', 'css.json'), csvOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--localities') a.localities = v().split(',').map(Number);
    else if (k === '--years') { const [x, y] = v().split('-').map(Number); a.years = [x, y ?? x]; }
    else if (k === '--extended') a.extended = v().split(',').filter(Boolean).map(Number);
    else if (k === '--raw') a.raw = path.resolve(v());
    else if (k === '--out') a.out = path.resolve(v());
    else if (k === '--insurer') a.insurer = path.resolve(v());
    else if (k === '--csv-only') a.csvOnly = true;
    else throw new Error(`option inconnue : ${k}`);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

// Réduit un produit de l'API à ce qui sert au relevé (les textes de prestations sont volumineux).
const slim = (list) => list.map((p) => ({
  typ: p.zusatzversicherungsTyp,
  sel: p.ausgewaehlt,
  selectable: p.auswaehlbar,
  v: p.varianten.map((x) => ({
    name: x.name,
    lv: x.leistungsvariante,
    dur: x.vertragsdauer,
    sel: x.ausgewaehlt,
    p: x.praemie,
    diff: x.differenz,
    cap: x.vvgKapitalleistungen || undefined,
    zn: x.zuschlagNachlaesse && x.zuschlagNachlaesse.length ? x.zuschlagNachlaesse : undefined,
    o: x.optionen.map((o) => ({ t: o.optionTyp, w: o.wert, d: o.differenz })),
  })),
}));

// Corps du PUT produits : l'état courant renvoyé par le serveur, avec UN produit modifié, placé en dernier
// (c'est ce que fait l'interface ; le serveur n'applique qu'un changement de produit par appel).
function putBody(state, typ, { variantLv, opts = {}, selected = true }) {
  const items = state.map((p) => {
    const change = p.typ === typ;
    const v = (change && variantLv != null ? p.v.find((x) => x.lv === variantLv) : p.v.find((x) => x.sel)) || p.v[0];
    return {
      typ: p.typ,
      ausgewaehlt: change ? selected : p.sel,
      vvgProduktVarianteDto: {
        name: v.name,
        vertragsdauer: v.dur,
        differenz: v.diff,
        leistungsvariante: v.lv,
        ausgewaehlt: true,
        optionen: v.o.map((o) => ({ optionTyp: o.t, wert: change && opts[o.t] != null ? opts[o.t] : o.w, differenz: o.d })),
      },
    };
  });
  items.sort((x, y) => (x.typ === typ) - (y.typ === typ));
  return { gewaehlteVvgVkp: items };
}

const findProduct = (state, typ) => state.find((p) => p.typ === typ);
const variantWith = (prod, optTyp) => prod && (prod.v.find((x) => x.sel && x.o.some((o) => o.t === optTyp)) || prod.v.find((x) => x.o.some((o) => o.t === optTyp)));

async function collect(args) {
  const { chromium } = require('playwright');
  const done = new Set();
  if (fs.existsSync(args.raw)) {
    for (const line of fs.readFileSync(args.raw, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      done.add(`${r.plz}|${r.birthYear}|${r.sex}`);
    }
  }
  const todo = [];
  for (const plz of args.localities) {
    if (!LOCALITIES[plz]) throw new Error(`NPA non prévu : ${plz}`);
    for (let y = args.years[1]; y >= args.years[0]; y--) for (const sex of ['f', 'm']) if (!done.has(`${plz}|${y}|${sex}`)) todo.push({ plz, y, sex });
  }
  console.log(`profils à relever : ${todo.length} (déjà en cache : ${done.size})`);
  if (!todo.length) return;

  const browser = await chromium.launch();
  let stopReason = null;
  try {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(CALCULATOR_URL, { waitUntil: 'networkidle', timeout: 60000 });
    if (!/calculator\.css\.ch\/fr\/personen/.test(page.url())) throw new Error(`page inattendue : ${page.url()}`);

    let lastPrice = 0;
    const call = async (method, url, body, { price = true } = {}) => {
      if (price) { const w = PRICE_DELAY_MS - (Date.now() - lastPrice); if (w > 0) await sleep(w); } else await sleep(300);
      const res = await page.evaluate(async ({ method, url, body }) => {
        const headers = { accept: 'application/json, text/plain, */*' };
        if (body !== undefined && body !== null) headers['content-type'] = 'application/json';
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 30000);
        try {
          const r = await fetch(url, { method, credentials: 'include', headers, body: body == null ? null : JSON.stringify(body), signal: ctl.signal });
          return { status: r.status, text: await r.text() };
        } catch (e) { return { status: 0, text: String(e) }; } finally { clearTimeout(timer); }
      }, { method, url, body });
      if (price) lastPrice = Date.now();
      let json = null;
      try { json = JSON.parse(res.text); } catch { /* pas du JSON */ }
      if (/captcha/i.test(res.text.slice(0, 2000)) || res.status === 403 || res.status === 429) { stopReason = `blocage ou captcha (HTTP ${res.status}) sur ${method} ${url}`; throw new Error(stopReason); }
      return { status: res.status, json, text: res.text };
    };

    // Données de référence : NPA -> objet localité attendu par l'API.
    const plzAll = (await call('GET', PLZ_URL, undefined, { price: false })).json;
    if (!Array.isArray(plzAll)) throw new Error('données de référence NPA indisponibles');
    const plzObj = {};
    for (const plz of args.localities) {
      const want = LOCALITIES[plz];
      const hit = plzAll.find((x) => x.postleitzahl === plz && x.ortsBezeichnung === want.locality && x.gemeindeBezeichnung === want.gemeinde);
      if (!hit) throw new Error(`NPA ${plz} ${want.locality} introuvable dans les données de référence`);
      plzObj[plz] = { onrp: hit.onrp, postleitzahl: hit.postleitzahl, ortsBezeichnung: hit.ortsBezeichnung, gemeindeBezeichnung: hit.gemeindeBezeichnung, kanton: hit.kanton, gemeindeNr: hit.gemeindeNr };
    }
    // Libellés français des variantes (soins dentaires, capitaux) tels qu'affichés.
    const tr = (await call('GET', TRANSLATIONS_URL, undefined, { price: false })).json || {};
    const labels = {};
    const walk = (o, p) => { for (const k of Object.keys(o)) { const v = o[k]; const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object') walk(v, key); else if (/^css\.kv\.produkte\.(zahnpflege|uti|kti)\.variant\./.test(key) || /^css\.kv\.produkte\.option\./.test(key)) labels[key] = v; } };
    walk(tr, '');

    let offer = null;
    let offerUses = 0;
    const newOffer = async () => {
      let r = await call('POST', API, null, { price: false });
      if (r.status !== 200 || !r.json?.uuid) throw new Error(`création d'offre : HTTP ${r.status}`);
      offer = r.json.uuid;
      r = await call('PUT', `${API}/${offer}`, { nis: false, valuta: START_DATE, vertragsdauer: CONTRACT_YEARS }, { price: false });
      if (r.status !== 200 || r.json?.vertragsdauer !== CONTRACT_YEARS || r.json?.valuta !== START_DATE) throw new Error(`réglage durée/début : HTTP ${r.status}`);
      offerUses = 0;
    };

    const profile = async ({ plz, y, sex }) => {
      if (!offer || offerUses >= OFFER_REUSE) await newOffer();
      offerUses++;
      const rec = { plz, locality: LOCALITIES[plz].locality, birthYear: y, sex, retrievedAt: today(), valuta: START_DATE, contractYears: CONTRACT_YEARS, states: [], issues: [] };
      let r = await call('POST', `${API}/${offer}/personen?sprache=fr`, { vorname: 'Test', geburtsdatum: `${y}-06-15`, geschlecht: sex === 'f' ? 'FRAU' : 'MANN', plz: plzObj[plz], sprache: 'fr' });
      if (r.status !== 200 || !r.json?.uuid || !Array.isArray(r.json.vvgProdukte)) throw new Error(`ajout personne ${plz}/${y}/${sex} : HTTP ${r.status} ${r.text.slice(0, 200)}`);
      const pid = r.json.uuid;
      try {
        let state = slim(r.json.vvgProdukte);
        if (state.some((p) => p.v.some((x) => x.dur !== 1 && /MYFLEX/.test(p.typ)))) throw new Error('durée de contrat différente de 1 an dans la réponse');
        rec.states.push({ step: 'default', list: state });
        const url = `${API}/${offer}/personen/${pid}/produkte/vvg?sprache=fr`;
        const step = async (name, typ, change, check) => {
          const res = await call('PUT', url, putBody(state, typ, change));
          if (res.status !== 200 || !Array.isArray(res.json)) { rec.issues.push(`${name}: HTTP ${res.status}`); return false; }
          const next = slim(res.json);
          const prod = findProduct(next, typ);
          if (!prod || !check(prod)) { rec.issues.push(`${name}: changement non appliqué`); state = next; return false; }
          state = next;
          rec.states.push({ step: name, target: typ, list: next });
          return true;
        };
        const optIs = (prod, t, w) => prod.sel && prod.v.some((x) => x.sel && x.o.some((o) => o.t === t && o.w === w));

        // 1) Hospitalisation avec participation aux coûts « basse » ; la sélection fait aussi apparaître la médecine alternative.
        const sp = findProduct(state, 'SPITAL_MYFLEX');
        const amb = findProduct(state, 'AMBULANT_MYFLEX');
        const spKb = variantWith(sp, 'KOSTENBETEILIGUNG');
        if (spKb) await step('spital_kb_basse', 'SPITAL_MYFLEX', { variantLv: spKb.lv, opts: { KOSTENBETEILIGUNG: '2' } }, (p) => optIs(p, 'KOSTENBETEILIGUNG', '2'));
        else if (sp) await step('spital_selected', 'SPITAL_MYFLEX', {}, (p) => p.sel);
        else if (amb) await step('ambulant_selected', 'AMBULANT_MYFLEX', {}, (p) => p.sel);
        if (args.extended.includes(plz)) {
          // 2) Soins dentaires : variante avec option « attestation dentaire », relevée aussi « sans ».
          const zGd = variantWith(findProduct(state, 'ZAHNPFLEGE'), 'OPTIONGD');
          if (zGd) await step('zahn_sans_attestation', 'ZAHNPFLEGE', { variantLv: zGd.lv, opts: { OPTIONGD: 'false' } }, (p) => optIs(p, 'OPTIONGD', 'false'));
          // 3) Option Upgrade, participation « elevée » pour l'hospitalisation.
          const spUp = variantWith(findProduct(state, 'SPITAL_MYFLEX'), 'OPTIONUPGRADE');
          if (spUp) await step('spital_upgrade', 'SPITAL_MYFLEX', { variantLv: spUp.lv, opts: { KOSTENBETEILIGUNG: '1', OPTIONUPGRADE: 'true' } }, (p) => optIs(p, 'OPTIONUPGRADE', 'true') && optIs(p, 'KOSTENBETEILIGUNG', '1'));
          const ambUp = variantWith(findProduct(state, 'AMBULANT_MYFLEX'), 'OPTIONUPGRADE');
          if (ambUp) await step('ambulant_upgrade', 'AMBULANT_MYFLEX', { variantLv: ambUp.lv, opts: { OPTIONUPGRADE: 'true' } }, (p) => optIs(p, 'OPTIONUPGRADE', 'true'));
        }
      } finally {
        const d = await call('DELETE', `${API}/${offer}/personen/${pid}`, undefined, { price: false });
        if (d.status < 200 || d.status >= 300) { rec.issues.push(`delete: HTTP ${d.status}`); offer = null; }
      }
      rec.labels = labels;
      return rec;
    };

    let errors = 0;
    let n = 0;
    const t0 = Date.now();
    for (const p of todo) {
      try {
        const rec = await profile(p);
        // les libellés sont identiques pour tous les profils : stockés une seule fois par ligne compacte
        fs.appendFileSync(args.raw, JSON.stringify(rec) + '\n');
        errors = 0;
        n++;
        if (n % 10 === 0 || rec.issues.length) console.log(`${n}/${todo.length} ${p.plz} ${p.y} ${p.sex} produits=${rec.states[0].list.length} étapes=${rec.states.map((s) => s.step).join(',')}${rec.issues.length ? ' PROBLÈMES=' + rec.issues.join(' | ') : ''} (${Math.round((Date.now() - t0) / 1000)} s)`);
      } catch (e) {
        errors++;
        offer = null;
        console.log(`ERREUR ${p.plz} ${p.y} ${p.sex} : ${e.message}`);
        if (stopReason || errors >= MAX_CONSECUTIVE_ERRORS) { stopReason = stopReason || `${errors} erreurs consécutives`; break; }
        await sleep(5000);
      }
    }
    if (stopReason) console.log(`ARRÊT : ${stopReason}`);
  } finally {
    await browser.close();
  }
}

// ---------- CSV ----------

const OPTION_LABEL = { KOSTENBETEILIGUNG: 'Votre participation aux coûts', OPTIONUPGRADE: 'Option Upgrade', AUSSCHLUSSMUTTERSCHAFT: 'Exclusion des prestations de maternité', OPTIONGD: 'Attestation dentaire' };
const OPTION_VALUE = { KOSTENBETEILIGUNG: { 1: 'elevée', 2: 'basse' }, OPTIONUPGRADE: { true: 'avec', false: 'sans' }, AUSSCHLUSSMUTTERSCHAFT: { true: 'oui', false: 'non' }, OPTIONGD: { true: 'avec', false: 'sans' } };
const OPTION_DEFAULT = { KOSTENBETEILIGUNG: '1', OPTIONUPGRADE: 'false', AUSSCHLUSSMUTTERSCHAFT: 'false', OPTIONGD: 'true', UNFALLDECKUNG: 'true' };
// options toujours écrites (elles changent la couverture) ; les autres seulement hors valeur par défaut
const ALWAYS_SHOWN = new Set(['KOSTENBETEILIGUNG', 'OPTIONGD']);

function variantLabel(typ, v, labels) {
  if (typ === 'ZAHNPFLEGE') return labels[`css.kv.produkte.zahnpflege.variant.${v.lv}`] || v.name;
  if (typ === 'UTI' || typ === 'KTI') return labels[`css.kv.produkte.${typ.toLowerCase()}.variant.${v.lv}`] || v.name;
  if (typ === 'HEILUNGSKOSTEN_UNFALL') return '';
  return v.name;
}

const csvCell = (s) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

function buildCsv(args) {
  if (!fs.existsSync(args.raw)) throw new Error(`cache introuvable : ${args.raw}`);
  const recs = fs.readFileSync(args.raw, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const rows = new Map();
  const anomalies = [];
  let knownKeys = new Set();
  try { knownKeys = new Set(JSON.parse(fs.readFileSync(args.insurer, 'utf8')).products.map((p) => p.key)); } catch { console.log(`fichier assureur illisible (${args.insurer}) : product_key laissé vide`); }
  const productKey = (typ) => (knownKeys.has(PRODUCT_KEYS[typ]) ? PRODUCT_KEYS[typ] : '');
  for (const rec of recs) {
    const labels = rec.labels || {};
    const def = rec.states[0];
    for (const st of rec.states) {
      for (const p of st.list) {
        if (SKIPPED_PRODUCTS.has(p.typ)) continue;
        // Après un PUT, seuls le produit modifié (options vérifiées) et la médecine alternative (sans option,
        // visible seulement après sélection d'un prérequis) sont repris : pour les autres produits, l'API peut
        // afficher une valeur d'option qui ne correspond pas au prix renvoyé (constaté sur les soins dentaires enfant).
        if (st.step !== 'default' && p.typ !== st.target && p.typ !== 'ALTERNATIVVERSICHERUNG_MYFLEX') continue;
        if (!PRODUCT_NAMES[p.typ]) { anomalies.push(`produit inconnu ${p.typ} (${rec.plz}/${rec.birthYear}/${rec.sex})`); continue; }
        for (const v of p.v) {
          if (typeof v.p !== 'number') continue;
          const optParts = [];
          let accident = '';
          let isDefault = true;
          for (const o of v.o) {
            if (o.t === 'UNFALLDECKUNG') { accident = o.w; if (o.w !== 'true') isDefault = false; continue; }
            if (o.w !== OPTION_DEFAULT[o.t]) isDefault = false;
            if (ALWAYS_SHOWN.has(o.t) || o.w !== OPTION_DEFAULT[o.t]) optParts.push(`${OPTION_LABEL[o.t] || o.t}: ${OPTION_VALUE[o.t]?.[o.w] ?? o.w}`);
          }
          if (accident === 'false') continue; // profil standard : couverture accident incluse
          const variant = variantLabel(p.typ, v, labels);
          const option = optParts.join('; ');
          const notes = [];
          if (isDefault) notes.push('calculator_default_options');
          if (/MYFLEX/.test(p.typ)) notes.push(`contract_${v.dur}y_no_multiyear_discount`);
          if (p.typ === 'ALTERNATIVVERSICHERUNG_MYFLEX') notes.push('requires_ambulatory_or_hospital_myflex');
          if (p.selectable === false) notes.push('not_selectable');
          const zn = (v.zn || []).filter((z) => z.betrag);
          if (zn.length) notes.push(`surcharges_discounts=${JSON.stringify(zn)}`);
          // contrôle de cohérence : prix avec une seule option modifiée = prix par défaut + écart annoncé par l'API
          if (st.step !== 'default' && p.typ === st.target) {
            const dv = def.list.find((x) => x.typ === p.typ)?.v.find((x) => x.lv === v.lv);
            const changed = dv ? v.o.filter((o) => dv.o.find((d) => d.t === o.t)?.w !== o.w) : [];
            if (dv && changed.length === 1) {
              const exp = dv.p + dv.o.find((d) => d.t === changed[0].t).d;
              if (Math.abs(exp - v.p) > 0.11) anomalies.push(`écart inattendu ${rec.plz}/${rec.birthYear}/${rec.sex} ${p.typ}/${v.lv} ${changed[0].t} : ${v.p} observé, ${exp.toFixed(2)} attendu`);
            }
          }
          notes.push(`api=${p.typ}/${v.lv}`);
          const key = [rec.plz, rec.birthYear, rec.sex, p.typ, v.lv, option].join('|');
          const row = { typ: p.typ, lv: v.lv, plz: rec.plz, cells: ['css', productKey(p.typ), PRODUCT_NAMES[p.typ], variant, option, TARIFF_YEAR, rec.birthYear, TARIFF_YEAR - rec.birthYear, rec.sex, rec.plz, rec.locality, accident, v.p.toFixed(2), 'official_calculator', CALCULATOR_URL, rec.retrievedAt, notes.join('; ')], price: v.p };
          const prev = rows.get(key);
          if (prev) { if (prev.price !== v.p) anomalies.push(`prix divergents pour ${key} : ${prev.price} / ${v.p} (étape ${st.step})`); } else rows.set(key, row);
        }
      }
    }
    for (const i of rec.issues || []) anomalies.push(`${rec.plz}/${rec.birthYear}/${rec.sex} : ${i}`);
  }
  const locOrder = Object.keys(LOCALITIES).map(Number);
  const sorted = [...rows.values()].sort((a, b) => locOrder.indexOf(a.plz) - locOrder.indexOf(b.plz) || PRODUCT_ORDER.indexOf(a.typ) - PRODUCT_ORDER.indexOf(b.typ) || a.lv - b.lv || a.cells[4].localeCompare(b.cells[4]) || a.cells[6] - b.cells[6] || a.cells[8].localeCompare(b.cells[8]));
  fs.writeFileSync(args.out, [CSV_HEADER, ...sorted.map((r) => r.cells.map(csvCell).join(','))].join('\n') + '\n');
  console.log(`${sorted.length} lignes écrites dans ${args.out} (${recs.length} profils)`);
  if (anomalies.length) console.log(`anomalies (${anomalies.length}) :\n` + anomalies.slice(0, 50).join('\n'));
}

const args = parseArgs(process.argv);
if (!args.csvOnly) await collect(args);
buildCsv(args);
