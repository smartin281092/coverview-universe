#!/usr/bin/env node
// Relevé des primes LCA 2027 du Groupe Mutuel dans le calculateur officiel
// https://www.groupemutuel.ch/poelGM/ (« Calculez votre prime 2027 »).
//
// Méthode : le navigateur ouvre le calculateur une fois, puis les appels JSON du
// calculateur (poel-bff) sont rejoués depuis la page avec fetch (mêmes cookies,
// même jeton CSRF « double submit » que l'application). Par profil :
//   1. POST /poel-forms/steps/submit?to=ETAPE2  -> besoins LCA proposés à cet âge
//   2. POST /poel-forms/steps/submit?to=ETAPE3  -> tous les tarifs LCA (tous besoins cochés)
//   3. POST /poel-forms/steps/step3/recalculate -> prime de l'indemnité journalière BH
//      pour le montant journalier choisi (prime « sur mesure »)
// Aucune offre n'est demandée : on s'arrête à l'étape « Ma sélection ».
//
// Usage :
//   NODE_PATH=<dossier node_modules contenant playwright> node groupe-mutuel.mjs \
//     [--localities 1003,1204,1950,2000,1700,2800] [--years 1947-2026] [--sexes f,m] \
//     [--bh 100] [--raw <fichier.jsonl>] [--out <fichier.csv>] [--delay 1100]
// --raw : fichier JSONL des réponses brutes ; s'il existe, les profils déjà relevés ne
//         sont pas redemandés (reprise). Par défaut : groupe-mutuel.raw.jsonl dans le
//         dossier temporaire du système.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALCULATOR_URL = 'https://www.groupemutuel.ch/poelGM/';
const BFF = 'https://offres-sante.groupemutuel.ch/poel-bff';
const LABELS_URL = 'https://www.groupemutuel.ch/poelGM/locales/products/FR.json';
const YEAR = 2027;
const ENTRY_DATE = '01.01.2027';
const INSURER = 'groupe-mutuel';

const LOCALITIES = {
  1003: 'Lausanne',
  1204: 'Genève',
  1950: 'Sion',
  2000: 'Neuchâtel',
  1700: 'Fribourg',
  2800: 'Delémont',
};

const HEADER = [
  'insurer', 'product_key', 'product_name', 'variant', 'option', 'year', 'birth_year', 'age', 'sex',
  'postal_code', 'locality', 'accident', 'monthly_chf', 'source_type', 'source_url', 'retrieved_at', 'notes',
];

// Variantes qui ne sont pas des niveaux de prestations mais des rabais : la variante
// « sans rabais » est le défaut (option vide), l'autre est rangée dans `option`.
const REBATE_VARIANTS = {
  SOGA01V1: { isDefault: true },
  SOGA01V2: { isDefault: false, note: 'rabais familial; api_only_not_displayed_single_person' },
  SDGA02V1: { isDefault: true },
  SDGA02V2: { isDefault: false, note: 'rabais familial; api_only_not_displayed_single_person' },
  MUGA01MU1: { isDefault: true, note: 'prix affiché quand Mundo est pris seul' },
  MUGA01MU2: { isDefault: false, note: 'rabais de combinaison; affiché quand Mundo est combiné à Global smart / hospitalisation / Optimum' },
};
// Critères complémentaires qui sont le défaut pour une personne seule (option vide).
const DEFAULT_CRITERIA = new Set(['GOGA0', 'LJGA1', 'LJGA3', '10']);
// Critères complémentaires qui sont une vraie variante de couverture (colonne `variant`).
const VARIANT_CRITERIA = new Set(['CYGAS', 'CYGAF']);
const CRITERIA_NOTES = {
  10: 'prime à l\'échelon 0 (80% de la prime) : bonus de 20% inclus dès la conclusion',
  LJGA0: 'api_only_not_displayed_single_person',
  LJGA2: 'api_only_not_displayed_single_person',
  GOGA1: 'api_only_not_displayed_single_person',
};

function parseArgs(argv) {
  const a = {
    localities: Object.keys(LOCALITIES),
    years: [1947, 2026],
    sexes: ['f', 'm'],
    bh: [100],
    raw: path.join(os.tmpdir(), 'groupe-mutuel.raw.jsonl'),
    out: path.resolve(HERE, '..', 'groupe-mutuel.csv'),
    delay: 1100,
  };
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (v === undefined) throw new Error(`valeur manquante pour ${k}`);
    if (k === '--localities') a.localities = v.split(',');
    else if (k === '--years') a.years = v.split('-').map(Number);
    else if (k === '--sexes') a.sexes = v.split(',');
    else if (k === '--bh') a.bh = v.split(',').filter(Boolean).map(Number);
    else if (k === '--raw') a.raw = path.resolve(v);
    else if (k === '--out') a.out = path.resolve(v);
    else if (k === '--delay') a.delay = Math.max(1000, Number(v));
    else throw new Error(`argument inconnu : ${k}`);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const profileKey = (npa, birthYear, sex) => `${npa}|${birthYear}|${sex}`;

class StopError extends Error {}

// Appel JSON rejoué dans la page : même origine d'appel, cookies et en-têtes que l'application.
async function api(page, method, pathAndQuery, body) {
  const res = await page.evaluate(async ({ url, method, body }) => {
    const token = crypto.randomUUID();
    document.cookie = `CSRF-TOKEN-${token}=${token}; path=/`;
    const headers = {
      Accept: 'application/json',
      'accept-language': 'fr',
      'x-correlation-id': crypto.randomUUID(),
      'X-CSRF-TOKEN': token,
    };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    try {
      const r = await fetch(url, {
        method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* pas du JSON */ }
      return { status: r.status, json, text: json ? '' : text.slice(0, 500) };
    } catch (e) {
      return { status: 0, json: null, text: String(e) };
    } finally {
      document.cookie = `CSRF-TOKEN-${token}=; path=/; max-age=0`;
    }
  }, { url: BFF + pathAndQuery, method, body });
  if (/captcha|incapsula|access denied|request unsuccessful/i.test(res.text)) {
    throw new StopError(`blocage ou captcha détecté (HTTP ${res.status}) : ${res.text.slice(0, 200)}`);
  }
  return res;
}

function initialState(profile) {
  return {
    contributors: ['POEL'],
    etapeEnCours: 'ETAPE1',
    forms: { etape1: { profiles: [profile] }, etape3: { packs: [], produits: [], profileVisited: [] } },
    messages: [],
    moyen: 'POEL',
    oneClickLamal: false,
    origin: 'POEL',
    saveMode: 'STANDARD',
  };
}

const slimTarif = ({ insuranceSelectionCode, ...t }) => t;

async function collectProfile(page, args, locality, birthYear, sex) {
  const wait = () => sleep(args.delay);
  const profile = {
    dateNaissance: `15.06.${birthYear}`,
    id: globalThis.crypto.randomUUID(),
    localite: locality,
    prenom: 'Test',
    sexe: sex === 'f' ? 'F' : 'H',
  };

  // 1. Étape « Mes besoins » : besoins LCA proposés pour ce profil.
  const r2 = await api(page, 'POST', '/poel-forms/steps/submit?to=ETAPE2', initialState(profile));
  await wait();
  const sugg2 = r2.json?.suggestions?.etape2?.profiles?.[0];
  if (r2.status !== 200 || !sugg2) throw new Error(`ETAPE2 HTTP ${r2.status} ${r2.text || JSON.stringify(r2.json).slice(0, 300)}`);
  const state = r2.json;
  const needs = [];
  for (const g of sugg2.lcaGammes ?? []) {
    for (const b of g.besoins ?? []) {
      needs.push({
        gamme: g.nom, nom: b.nom, codeProduit: b.tarifBesoin?.codeProduit, desMontant: b.tarifBesoin?.montant ?? null,
      });
    }
  }
  const record = {
    key: profileKey(locality.npa, birthYear, sex),
    npa: locality.npa,
    locality: locality.nomComplet,
    canton: locality.codeCanton,
    birthYear,
    sex,
    retrievedAt: new Date().toISOString(),
    trancheAge: state.forms?.etape1?.profiles?.[0]?.trancheAge ?? null,
    messages: state.messages ?? [],
    needs,
    tarifs: [],
    scopes: [],
    entryDates: {},
    bh: {},
    errors: [],
  };
  if (!needs.length) return record;

  // 2. Étape « Ma sélection » avec tous les besoins LCA cochés : tous les tarifs LCA.
  state.forms.etape2.besoins[0].lca.selectedNeeds = needs.map((n) => n.nom);
  state.forms.etape2.profileVisited = [true];
  const r3 = await api(page, 'POST', '/poel-forms/steps/submit?to=ETAPE3', state);
  await wait();
  const sugg3 = r3.json?.suggestions?.etape3?.profiles?.[0];
  if (r3.status !== 200 || !sugg3) throw new Error(`ETAPE3 HTTP ${r3.status} ${r3.text || JSON.stringify(r3.json).slice(0, 300)}`);
  record.tarifs = (sugg3.lca ?? []).map(slimTarif);
  record.scopes = sugg3.produitScopes ?? [];
  record.errors = r3.json.suggestions.etape3.errors ?? [];
  const selection = r3.json.forms?.etape3?.produits?.[0]?.lca?.selection ?? [];
  for (const s of selection) record.entryDates[s.tarif?.codeProduit] = s.dateEntreeVigueur;

  // 3. Indemnité journalière BH : prime sur mesure, une requête par montant journalier.
  const bhIndex = selection.findIndex((s) => s.tarif?.codeProduit === 'BHGA01');
  if (bhIndex >= 0) {
    for (const amount of args.bh) {
      const qs = new URLSearchParams({
        action: 'UPDATE',
        eventTargetName: `forms.etape3.produits[0].lca.selection[${bhIndex}].dailyAmount`,
        value: String(amount),
      });
      const rb = await api(page, 'POST', `/poel-forms/steps/step3/recalculate?${qs}`, {
        produits: r3.json.forms.etape3.produits,
        profiles: r3.json.forms.etape1.profiles,
        suggestions: r3.json.suggestions.etape3,
      });
      await wait();
      const t = rb.json?.produits?.[0]?.lca?.selection?.[bhIndex]?.tarif;
      if (rb.status !== 200 || !t) throw new Error(`recalculate BH HTTP ${rb.status} ${rb.text || JSON.stringify(rb.json).slice(0, 300)}`);
      if (t.codeProduit === 'BHGA01' && t.dailyAmount === amount && typeof t.montant === 'number') {
        record.bh[amount] = { montant: t.montant, tarif: slimTarif(t) };
      } else {
        record.bh[amount] = { montant: null, tarif: slimTarif(t) };
      }
    }
  }
  return record;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsForRecord(rec, labels) {
  const rows = [];
  const produits = labels.produits ?? {};
  const variants = labels.variants ?? {};
  const criteres = labels.criteresComplementaires ?? {};
  const age = YEAR - rec.birthYear;
  const base = (codeProduit) => ({
    insurer: INSURER,
    product_key: '',
    product_name: stripHtml(produits[codeProduit]?.name) || codeProduit,
    year: YEAR,
    birth_year: rec.birthYear,
    age,
    sex: rec.sex,
    postal_code: rec.npa,
    locality: rec.locality,
    source_type: 'official_calculator',
    source_url: CALCULATOR_URL,
    retrieved_at: rec.retrievedAt.slice(0, 10),
  });
  const scopedCriterion = Object.fromEntries(
    rec.scopes.filter((s) => s.scope === 'CRITERE_COMPLEMENTAIRE').map((s) => [s.productCode, s.value]),
  );

  for (const t of rec.tarifs) {
    if (t.codeProduit === 'BHGA01') continue; // traité plus bas (prime sur mesure)
    if (typeof t.montant !== 'number') continue; // pas de prix : rien n'est écrit
    const notes = [];
    const options = [];
    let variant = '';

    if (t.codeVariante && t.codeVariante !== 'N/A') {
      const rebate = REBATE_VARIANTS[t.codeVariante];
      const label = stripHtml(variants[t.codeVariante]?.name) || t.codeVariante;
      if (rebate) {
        if (!rebate.isDefault) options.push(label);
        else notes.push(`variante tarifaire « ${label} »`);
        if (rebate.note) notes.push(rebate.note);
      } else {
        variant = label;
      }
    }
    for (const crit of [t.codeCritereSupplementaire1, t.codeCritereSupplementaire2]) {
      if (!crit) continue;
      const label = stripHtml(criteres[crit]) || crit;
      if (VARIANT_CRITERIA.has(crit)) {
        variant = variant ? `${variant} / ${label}` : label;
      } else {
        const scoped = scopedCriterion[t.codeProduit];
        const isDefault = scoped ? scoped === crit : DEFAULT_CRITERIA.has(crit);
        if (isDefault) notes.push(`critère « ${label} »`);
        else options.push(label);
      }
      if (CRITERIA_NOTES[crit]) notes.push(CRITERIA_NOTES[crit]);
    }
    if (t.franchise > 0) options.push(`Franchise annuelle de CHF ${t.franchise}`);
    let accident = '';
    if (t.codeRisque && t.codeRisque !== 'N/A') {
      accident = t.accident ? 'true' : 'false';
      const risk = t.codeRisque.slice(t.codeProduit.length);
      if (risk === 'M') options.push('Couverture Maladie (sans accident)');
      if (risk === 'A') notes.push('couverture accident seul');
    }
    if (t.defautTarifCombination) notes.push('calculator_preselected');
    if (rec.entryDates[t.codeProduit] && rec.entryDates[t.codeProduit] !== ENTRY_DATE) {
      notes.push(`entrée en vigueur ${rec.entryDates[t.codeProduit]}`);
    }
    notes.push(`codes=${[t.codeProduit, t.codeVariante, t.codeFranchise, t.codeRisque, t.codeCritereSupplementaire1 ?? '', t.codeCritereSupplementaire2 ?? ''].join('|')}`);
    rows.push({
      ...base(t.codeProduit), variant, option: options.join(' ; '), accident, monthly_chf: t.montant.toFixed(2), notes: notes.join('; '),
    });
  }

  for (const [amount, v] of Object.entries(rec.bh ?? {})) {
    if (typeof v.montant !== 'number') continue;
    const t = v.tarif;
    rows.push({
      ...base('BHGA01'),
      variant: `Indemnité journalière CHF ${amount}/jour`,
      option: '',
      accident: t.accident ? 'true' : 'false',
      monthly_chf: v.montant.toFixed(2),
      notes: `prime sur mesure : montant journalier libre de 1 à ${t.toDailyAmount} CHF, relevé pour ${amount} CHF/jour; codes=${[t.codeProduit, t.codeVariante, t.codeFranchise, t.codeRisque, '', ''].join('|')}`,
    });
  }
  return rows;
}

function writeCsv(records, labels, out, localityOrder) {
  const rows = [];
  for (const rec of records) rows.push(...rowsForRecord(rec, labels));
  const locRank = Object.fromEntries(localityOrder.map((npa, i) => [String(npa), i]));
  rows.sort((a, b) => (locRank[a.postal_code] ?? 99) - (locRank[b.postal_code] ?? 99)
    || a.product_name.localeCompare(b.product_name, 'fr')
    || a.variant.localeCompare(b.variant, 'fr', { numeric: true })
    || a.option.localeCompare(b.option, 'fr')
    || a.accident.localeCompare(b.accident)
    || b.birth_year - a.birth_year
    || a.sex.localeCompare(b.sex));
  const lines = [HEADER.join(',')];
  for (const r of rows) lines.push(HEADER.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
  return rows.length;
}

function loadRaw(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line);
    map.set(rec.key, rec);
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv);
  const done = loadRaw(args.raw);
  const labelsFile = `${args.raw}.labels.json`;
  let labels = fs.existsSync(labelsFile) ? JSON.parse(fs.readFileSync(labelsFile, 'utf8')) : null;

  const todo = [];
  for (const npa of args.localities) {
    for (let y = args.years[1]; y >= args.years[0]; y--) {
      for (const sex of args.sexes) if (!done.has(profileKey(npa, y, sex))) todo.push({ npa: String(npa), birthYear: y, sex });
    }
  }
  console.log(`profils déjà relevés : ${done.size} ; à relever : ${todo.length}`);

  let stopped = null;
  if (todo.length || !labels) {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ locale: 'fr-CH' });
      const page = await context.newPage();
      await page.goto(`${CALCULATOR_URL}?langue=fr`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByTestId('step-1:profile-0:firstName').waitFor({ timeout: 60000 });
      const title = await page.locator('h1').first().innerText();
      if (!/2027/.test(title)) throw new StopError(`le calculateur n'annonce pas les primes 2027 : « ${title} »`);

      // Libellés des produits et variantes tels que le calculateur les affiche (même origine que la page).
      labels = await page.evaluate(async (url) => (await fetch(url)).json(), LABELS_URL);
      if (!labels?.produits || !labels?.variants) throw new StopError('libellés des produits introuvables');
      fs.writeFileSync(labelsFile, JSON.stringify(labels));
      await sleep(args.delay);

      // Résolution de toutes les localités avant de commencer (arrêt immédiat si l'une manque).
      const localityCache = new Map();
      for (const npa of new Set(todo.map((p) => p.npa))) {
        const r = await api(page, 'GET', `/localities?search=${npa}`);
        await sleep(args.delay);
        const wanted = LOCALITIES[npa];
        const list = Array.isArray(r.json) ? r.json : [];
        const loc = list.find((l) => l.npa === npa && (!wanted || l.nomComplet === wanted))
          ?? list.find((l) => l.npa === npa && (!wanted || l.nomCommune === wanted));
        if (!loc) throw new StopError(`localité introuvable pour ${npa} : ${JSON.stringify(r.json ?? r.text).slice(0, 300)}`);
        localityCache.set(npa, loc);
        console.log(`localité ${npa} : ${loc.nomComplet} (${loc.codeCanton}), commune ${loc.numeroCommune}`);
      }
      let consecutiveErrors = 0;
      let n = 0;
      for (const p of todo) {
        try {
          const rec = await collectProfile(page, args, localityCache.get(p.npa), p.birthYear, p.sex);
          fs.appendFileSync(args.raw, `${JSON.stringify(rec)}\n`);
          done.set(rec.key, rec);
          consecutiveErrors = 0;
          n += 1;
          if (n % 20 === 0) console.log(`${n}/${todo.length} (${rec.key} : ${rec.tarifs.length} tarifs)`);
        } catch (e) {
          if (e instanceof StopError) throw e;
          consecutiveErrors += 1;
          console.error(`erreur ${p.npa}|${p.birthYear}|${p.sex} : ${e.message}`);
          if (consecutiveErrors >= 3) throw new StopError('3 erreurs consécutives : arrêt');
          await sleep(5000);
        }
      }
    } catch (e) {
      if (!(e instanceof StopError)) throw e;
      stopped = e.message;
      console.error(`ARRÊT : ${stopped}`);
    } finally {
      await browser.close();
    }
  }

  // Le CSV est toujours réécrit à partir de l'ensemble des réponses brutes disponibles.
  const wantedKeys = new Set();
  for (const npa of args.localities) {
    for (let y = args.years[0]; y <= args.years[1]; y++) for (const sex of args.sexes) wantedKeys.add(profileKey(npa, y, sex));
  }
  const records = [...done.values()].filter((r) => wantedKeys.has(r.key));
  if (labels && records.length) {
    const count = writeCsv(records, labels, args.out, args.localities);
    console.log(`${count} lignes écrites dans ${args.out} (${records.length} profils sur ${wantedKeys.size})`);
  }
  if (stopped) process.exitCode = 2;
}

main().catch((e) => { console.error(e); process.exit(1); });
