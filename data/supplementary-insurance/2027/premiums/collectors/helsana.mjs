#!/usr/bin/env node
// Relevé des primes LCA 2027 de Helsana dans le calculateur officiel « easySales ».
//
// Le calculateur ne demande aucun prix au serveur : il charge un modèle tarifaire PROMOS
// (model/Offer_Helsana.prt et stammdaten/*.csv) et calcule les primes dans le navigateur (WebAssembly).
// Le script parcourt une fois le formulaire (personne, localité), puis interroge ce même moteur
// (window.PMSRT) avec les expressions que l'interface emploie pour afficher ses prix, en changeant
// la date de naissance, le sexe et la localité de la personne déjà saisie.
//
// Usage : node helsana.mjs [--out <dossier>] [--years 1990,1947] [--npa 1003,1204] [--verify]
//   --out     dossier du CSV (défaut : le dossier parent de ce script)
//   --years   années de naissance (défaut : 1947 à 2026)
//   --npa     localités parmi celles du profil standard (défaut : les six)
//   --verify  ressaisit en plus six profils dans l'interface (un par localité) et confronte les prix
//             affichés au relevé ; six sessions supplémentaires du calculateur.
// Résumé (méta, limites d'âge, vérifications) sur la sortie standard, en JSON.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const CALCULATOR_URL = 'https://portal.helsana.ch/offer/#/personal-details/persons?locale=fr';
const LOCALE_URL = 'https://portal.helsana.ch/offer/locales/fr.json';
const INSURER = 'helsana';
const YEAR = 2027;
const START_DATE = '01.01.2027';
const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';

// Localités du profil standard : NPA, complément de NPA et numéro OFS de la commune (stammdaten/pkv_PLZ.csv).
const LOCALITIES = [
  { npa: '1003', zusatz: '00', gemeinde: '5586', name: 'Lausanne' },
  { npa: '1204', zusatz: '00', gemeinde: '6621', name: 'Genève' },
  { npa: '1950', zusatz: '00', gemeinde: '6266', name: 'Sion' },
  { npa: '2000', zusatz: '00', gemeinde: '6458', name: 'Neuchâtel' },
  { npa: '1700', zusatz: '00', gemeinde: '2196', name: 'Fribourg' },
  { npa: '2800', zusatz: '00', gemeinde: '6711', name: 'Delémont' },
];
const FULL_OPTIONS_NPA = '1003'; // franchises hospitalières autres que CHF 0 : Lausanne seulement

// Produits LCA du calculateur (clé PROMOS -> clé de ../insurers/helsana.json).
//   variantDims  : paramètres énumérés, rendus dans `variant`
//   fixedVariant : paramètres laissés à la valeur proposée, décrits dans `variant`
//   optionDims   : paramètres énumérés, rendus dans `option` quand ils s'écartent du défaut
// Les autres paramètres visibles gardent la valeur proposée par le calculateur, sauf la couverture
// accident, incluse dès que l'option existe (bothAccident : les deux valeurs).
const PRODUCTS = {
  PRO_Z1TOP__HEL_IG: { key: 'helsana-top' },
  PRO_Z1SANA_HEL_IG: { key: 'helsana-sana' },
  PRO_Z1COMP_HEL_IG: { key: 'helsana-completa' },
  PRO_Z1COPL_HEL_IG: { key: 'helsana-completa-plus' },
  PRO_Z1COEX_HEL_IG: { key: '' },
  PRO_Z1PRIM_HEL_IG: { key: 'helsana-primeo' },
  PRO_Z1WORL_HEL_IG: { key: 'helsana-world' },
  PRO_Z8DEPL_HEL_IG: { key: 'helsana-dentaplus', variantDims: ['variante'] },
  PRO_Z2ECO__HEL_IG: { key: 'helsana-hospital-eco' },
  PRO_Z2FLEX_HEL_IG: { key: 'helsana-hospital-flex', variantDims: ['variante'], optionDims: ['ergaenzungsmodul'] },
  PRO_Z2HHP__HEL_IG: { key: 'helsana-hospital-demi-privee-privee', variantLabel: 'Demi-Privée', optionDims: ['franchise', 'mutterschaft'] },
  PRO_Z2HPR__HEL_IG: { key: 'helsana-hospital-demi-privee-privee', variantLabel: 'Privée', optionDims: ['franchise', 'mutterschaft'] },
  PRO_Z2EXTR_HEL_IG: { key: 'helsana-hospital-extra', variantDims: ['versicherterBetragCode'] },
  PRO_Z9ADPL_HEL_IG: { key: 'helsana-advocare-plus' },
  PRO_Z9ADEX_HEL_IG: { key: 'helsana-advocare-extra' },
  PRO_Z7CURA_HEL_IG: { key: 'helsana-cura', fixedVariant: ['versicherterBetragCode'], optionDims: ['wartefrist'] },
  PRO_Z7VIVA_HEL_IG: { key: 'helsana-vivante', variantDims: ['variante'] },
  PRO_Z4PRUN_HEL_IG: { key: 'helsana-prevea-accident', fixedVariant: ['todesfallkapital', 'invaliditaetskapital'] },
  PRO_Z4PRKR_HEL_IG: { key: 'helsana-prevea-maladie', fixedVariant: ['todesfallkapital', 'invaliditaetskapital'] },
  PRO_Z5SALA_HEL_IG: { key: 'helsana-salaria-lca', fixedVariant: ['variante', 'versicherterBetrag', 'wartefrist', 'leistungsdauer'], bothAccident: true },
};

// Profils ressaisis dans l'interface par --verify (un par localité).
const VERIFY_PROFILES = [
  { birthYear: 1990, sex: 'f', npa: '1003' },
  { birthYear: 2015, sex: 'm', npa: '1204' },
  { birthYear: 1950, sex: 'f', npa: '1950' },
  { birthYear: 2001, sex: 'f', npa: '2000' },
  { birthYear: 1972, sex: 'm', npa: '1700' },
  { birthYear: 1960, sex: 'm', npa: '2800' },
];
// Libellé d'une carte de la page de comparaison -> produit (et variante) du relevé.
const UI_LABELS = {
  TOP: ['TOP'], SANA: ['SANA'], COMPLETA: ['COMPLETA'], 'COMPLETA PLUS': ['COMPLETA PLUS'], PRIMEO: ['PRIMEO'], WORLD: ['WORLD'],
  'Advocare PLUS': ['Helsana Advocare PLUS'], 'Advocare EXTRA': ['Helsana Advocare EXTRA'],
  Light: ['DENTAplus', 'Light'], Bronze: ['DENTAplus', 'Bronze'], Argent: ['DENTAplus', 'Argent'], Or: ['DENTAplus', 'Or'], Combi: ['DENTAplus', 'Combi'],
  ECO: ['HOSPITAL ECO'], FLEX: ['HOSPITAL FLEX'], 'Demi-Privée': ['HOSPITAL Demi-Privée'], 'Privée': ['HOSPITAL Privée'], 'HOSPITAL EXTRA': ['HOSPITAL EXTRA'],
  'PREVEA Accident': ['PREVEA Accident'], 'PREVEA Maladie': ['PREVEA Maladie'], CURA: ['CURA'], VIVANTE: ['VIVANTE'], SALARIA: ['SALARIA'],
};

function parseArgs(argv) {
  const args = { out: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), verify: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--years') args.years = argv[++i].split(',').map(Number);
    else if (argv[i] === '--npa') args.npa = argv[++i].split(',');
    else if (argv[i] === '--verify') args.verify = true;
    else throw new Error(`option inconnue : ${argv[i]}`);
  }
  return args;
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const chf = (n) => Number(n).toFixed(2);

// Libellés français des valeurs de paramètres, calqués sur ceux du calculateur.
function valueLabel(param, value, choiceLabel) {
  const m = /^COD_(?:Franchise_VVG|Betrag|Wartefrist|Leistungsdauer)_(\d+)_HEL$/.exec(value);
  switch (param) {
    case 'franchise': return `franchise hospitalière CHF ${m[1]}`;
    case 'mutterschaft': return value === 'COD_eingeschlossen_HEL' ? 'maternité incluse' : 'maternité exclue';
    case 'ergaenzungsmodul': return value === 'Ja' ? 'module complémentaire inclus' : 'module complémentaire exclu';
    case 'wartefrist': return `délai d'attente ${m[1]} jours`;
    case 'leistungsdauer': return `durée des prestations ${m[1]} jours`;
    case 'versicherterBetragCode': return `indemnité journalière CHF ${m[1]}`;
    case 'versicherterBetrag': return `indemnité journalière CHF ${value}`;
    case 'todesfallkapital': return `capital décès CHF ${value}`;
    case 'invaliditaetskapital': return `capital invalidité CHF ${value}`;
    case 'variante': {
      const dent = { Light: 'Light', Bronze: 'Bronze', Silber: 'Argent', Gold: 'Or', Combi: 'Combi' };
      let x;
      if ((x = /^COD_Z8DEPL_(\w+)_HEL$/.exec(value))) return dent[x[1]] ?? x[1];
      if ((x = /^COD_Z2FLEX_Variante_FLEX(\d)_HEL$/.exec(value))) return `FLEX ${x[1]}`;
      if (/^COD_Z7VIVA_Variante_/.test(value)) return `indemnité journalière CHF ${choiceLabel}`;
      if (value === 'COD_Krankheit_HEL') return 'variante LCA';
      return value;
    }
    default: return `${param}=${value}`;
  }
}

// Exécuté dans la page : fixe la personne et renvoie les primes de tous les produits LCA proposés.
function inPageCollect({ birth, sex, loc, products, fullOptions }) {
  const R = window.PMSRT;
  const c = (e) => R.compute(e).value;
  const list = (e) => c(e).split('\t').filter((x) => x.length);
  const choices = (a) => R.choices(undefined, a).choices.map((x) => ({ id: x.shortText, label: x.longText })).filter((x) => x.id.length);
  if (loc) {
    R.setVar('A_GLB_PLZ', loc.npa);
    R.setVar('A_GLB_PLZ_Zusatz', loc.zusatz);
    R.setVar('A_GLB_Gemeindenummer', loc.gemeinde);
  }
  if (birth) R.setVar('A_PER_GebDat[0]', birth);
  if (sex) R.setVar('A_PER_Geschlecht[0]', sex);
  R.maxLength(R.RESULT_VALUE, 4096);
  const mix = list('S_VPF_AlleProdukteImMix(0)');
  R.maxLength(R.RESULT_VALUE, 256);
  const state = { persons: c('A_PER_i'), birth: c('A_PER_GebDat[0]'), sex: c('A_PER_Geschlecht[0]'), npa: c('A_GLB_PLZ'), gemeinde: c('A_GLB_Gemeindenummer'), start: c('A_PER_VertragsbeginnVVG[0]'), duration: c('A_GLB_Vertragsdauer'), group: c('A_GLB_Kollektivvertrag') };
  const out = { state, products: {} };
  const SKIP = ['vertragsdauer', 'abgeloestesProdukt', 'secondOpinion', 'bonusstufe'];
  for (const p of mix) {
    if (!p.startsWith('PRO_Z')) continue; // PRO_H* : assurance de base et indemnités journalières LAMal
    const info = { available: c(`F_PRM_IstProduktAuswaehlbar(0;"${p}")`) === '1', closed: c(`F_PRM_IstGeschlossenesProdukt("${p}")`) === '1', known: p in products, rows: [] };
    out.products[p] = info;
    if (!info.available || !info.known) continue;
    const spec = products[p];
    const names = list(`S_VPF_Produkteparameter("${p}")`);
    const attrs = c(`S_VPF_Attribute(0;"${p}";"0")`).split('\t');
    const hasChoice = c(`S_VPF_ParameterHasChoice("${p}")`).split('\t');
    const ageGroup = c(`F_PRM_AltersgruppeInternalName(0;"${p}")`);
    info.ageGroup = ageGroup;
    const params = [];
    names.forEach((name, i) => {
      const attr = attrs[i];
      if (!attr || SKIP.includes(name) || c(`${attr}.vVisible`) !== '1') return;
      if (name === 'eintrittsalter') { params.push({ name, values: [ageGroup], def: ageGroup, labels: {} }); return; }
      const def = c(`${attr}.default`);
      const ch = hasChoice[i] === '1' ? choices(attr) : [];
      const ids = ch.map((x) => x.id);
      let values = [def];
      if (name === 'unfall') values = spec.bothAccident ? ids : [ids.includes('COD_eingeschlossen_HEL') ? 'COD_eingeschlossen_HEL' : def];
      else if ((spec.variantDims || []).includes(name)) values = ids;
      else if ((spec.optionDims || []).includes(name)) values = name === 'franchise' && !fullOptions ? [def] : ids;
      params.push({ name, values, def, labels: Object.fromEntries(ch.map((x) => [x.id, x.label])) });
    });
    let combos = [[]];
    for (const prm of params) combos = combos.flatMap((cmb) => prm.values.map((v) => [...cmb, { name: prm.name, value: v, def: prm.def, label: prm.labels[v] ?? '' }]));
    const surcharges = list(`P_VPF_Praemienzuschlagprodukt("LIST";0;"${p}")`).map((k) => `${k} ${c(`P_VPF_Praemienzuschlagprodukt("${k}";0;"${p}")`)}`);
    for (const cmb of combos) {
      // Même forme d'argument que l'interface : paires « paramètre<TAB>valeur<TAB> ».
      const arg = `0;"${p}";"${cmb.filter((x) => x.value).map((x) => `${x.name}\t${x.value}\t`).join('')}"`;
      info.rows.push({
        params: cmb,
        net: c(`P_VPF_ExtrahiereNettoPraemie(${arg})`),
        gross: c(`P_VPF_ExtrahiereBruttoPraemie(${arg})`),
        rebates: list(`P_VPF_ExtrahiereRabattprodukt("LIST"; ${arg})`).map((k) => `${k} ${c(`P_VPF_ExtrahiereRabattprodukt("${k}"; ${arg})`)}`),
        surcharges,
      });
    }
  }
  return out;
}

// Parcourt les deux étapes du formulaire (personne, localité).
async function openCalculator(context, { birth, female, loc }) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(CALCULATOR_URL, { waitUntil: 'networkidle', timeout: 90000 });
  const inputs = page.locator('input.mat-input-element');
  await inputs.nth(0).waitFor();
  await inputs.nth(0).fill('Test'); // prénom fictif
  await inputs.nth(1).fill(birth);
  await page.locator('app-toggle-gender button').nth(female ? 0 : 1).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  // Localité ; début d'assurance, durée de contrat et contrat collectif laissés tels que proposés.
  const npaInput = page.locator('input[placeholder="3000 Bern"]');
  await npaInput.waitFor();
  await npaInput.click();
  await npaInput.pressSequentially(loc.npa, { delay: 120 });
  await page.locator('mat-option').first().waitFor();
  const offered = (await page.locator('mat-option').allInnerTexts()).map((t) => t.trim());
  const wanted = offered.indexOf(`${loc.npa} ${loc.name}`);
  await page.locator('mat-option').nth(Math.max(wanted, 0)).click();
  // Un NPA partagé par plusieurs communes fait apparaître une liste « Commune » obligatoire.
  let communes = [];
  await page.waitForTimeout(800);
  const communeSelect = page.locator('mat-form-field').filter({ hasText: 'Commune' }).locator('mat-select');
  if (await communeSelect.count()) {
    await communeSelect.click();
    await page.locator('mat-option').first().waitFor();
    communes = (await page.locator('mat-option').allInnerTexts()).map((t) => t.trim());
    await page.locator('mat-option').nth(Math.max(communes.indexOf(loc.name), 0)).click();
  }
  const startShown = await page.locator('input.mat-datepicker-input').inputValue();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForURL(/\/benefits/);
  await page.waitForFunction(() => window.PMSRT && window.PMSRT.compute('A_PER_i').value === '1');
  return { context, page, offered, communes, startShown };
}

function toCsvRows(res, { birthYear, sex, loc, labels, retrievedAt }) {
  const rows = [];
  for (const [p, info] of Object.entries(res.products)) {
    const spec = PRODUCTS[p];
    for (const row of info.rows) {
      const byName = Object.fromEntries(row.params.map((x) => [x.name, x]));
      const variantParts = [...(spec.variantDims || []), ...(spec.fixedVariant || [])].filter((n) => byName[n]).map((n) => valueLabel(n, byName[n].value, byName[n].label));
      const variant = spec.variantLabel ?? variantParts.join(', ');
      const optionDims = (spec.optionDims || []).filter((n) => byName[n]);
      const option = optionDims.filter((n) => byName[n].value !== byName[n].def).map((n) => valueLabel(n, byName[n].value)).join('; ');
      const accident = byName.unfall ? String(byName.unfall.value === 'COD_eingeschlossen_HEL') : '';
      const net = Number(row.net), gross = Number(row.gross);
      const notes = [`tranche=${(/^COD_Alter_(.+)_HEL$/.exec(info.ageGroup) || [null, info.ageGroup])[1]}`];
      if (!option && optionDims.length) notes.push(`défaut du calculateur: ${optionDims.map((n) => valueLabel(n, byName[n].def)).join(', ')}`);
      if (byName.unfall && byName.unfall.value !== byName.unfall.def) notes.push('accident exclu par défaut dans le calculateur');
      if (byName.praemienrabatt) notes.push(`rabais sur les primes ${byName.praemienrabatt.value} % déjà déduit`);
      if (row.surcharges.length) notes.push(`supplément inclus: ${row.surcharges.join(', ')}`);
      if (row.rebates.length) notes.push(`poste de rabais inclus: ${row.rebates.join(', ')}`);
      if (Math.abs(net - gross) > 0.001) notes.push(`prime brute du moteur ${chf(gross)}`);
      rows.push({
        ok: Number.isFinite(net) && net > 0, product: p, name: labels[`products.${p}.name`]?.trim() ?? p, variant, option, accident, net,
        cells: [INSURER, spec.key, labels[`products.${p}.name`]?.trim() ?? p, variant, option, YEAR, birthYear, YEAR - birthYear, sex, loc.npa, loc.name, accident, chf(net), 'official_calculator', CALCULATOR_URL, retrievedAt, notes.join(' | ')],
      });
    }
  }
  return rows;
}

// Lit les prix affichés sur les pages de comparaison de toutes les catégories de produits.
async function readDisplayedPrices(page) {
  const expand = async () => {
    for (const name of [/Afficher les assurances indemnités/, /Afficher d'autres assurances/]) {
      const link = page.getByText(name).first();
      if (await link.count()) { await link.click(); await page.waitForTimeout(600); }
    }
  };
  await page.getByRole('button', { name: /Afficher les assurances pour Test/ }).click();
  await page.getByText('Visualiser les produits').first().waitFor();
  await expand();
  const count = await page.getByText('Visualiser les produits').count();
  const shown = [];
  for (let i = 0; i < count; i++) {
    await page.getByText('Visualiser les produits').nth(i).click();
    await page.getByText(/^Comparaison /).first().waitFor();
    await page.waitForTimeout(1500);
    const lines = (await page.locator('body').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    const category = lines.find((l) => l.startsWith('Comparaison '));
    lines.forEach((l, k) => {
      if (l !== 'Prime nette CHF / mois' || !/^\d+\.\d\d$/.test(lines[k + 1] ?? '')) return;
      let label = null;
      for (let b = k - 1; b >= Math.max(0, k - 3) && !label; b--) if (lines[b] in UI_LABELS) label = lines[b];
      shown.push({ category, label, price: Number(lines[k + 1]), after: lines.slice(k + 2, k + 6) });
    });
    await page.getByText('Retour', { exact: true }).first().click();
    await page.getByText('Visualiser les produits').first().waitFor();
    await expand();
  }
  return shown;
}

async function verifyProfile(browser, profile, labels, retrievedAt) {
  const loc = LOCALITIES.find((l) => l.npa === profile.npa);
  const birth = `15.06.${profile.birthYear}`;
  const context = await browser.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 1600 } });
  try {
    const { page, offered, communes } = await openCalculator(context, { birth, female: profile.sex === 'f', loc });
    // Relevé du moteur dans l'état laissé par l'interface (rien n'est modifié), puis lecture de l'écran.
    const res = await page.evaluate(inPageCollect, { products: PRODUCTS, fullOptions: false });
    const rows = toCsvRows(res, { birthYear: profile.birthYear, sex: profile.sex, loc, labels, retrievedAt });
    const shown = await readDisplayedPrices(page);
    const checks = shown.filter((s) => !s.category.includes('Assurance de base')).map((s) => {
      if (!s.label) return { ...s, match: false, reason: 'libellé inconnu' };
      const [name, variant] = UI_LABELS[s.label];
      let cand = rows.filter((r) => r.name === name && r.option === '' && (variant ? r.variant === variant : true));
      const hint = s.after.find((l) => /^FLEX \d$/.test(l) || /^CHF \d+$/.test(l));
      if (!variant && hint && cand.some((r) => r.variant.endsWith(hint))) cand = cand.filter((r) => r.variant.endsWith(hint));
      if (name === 'SALARIA') cand = cand.filter((r) => r.accident === 'false'); // défaut de l'interface
      return { product: name, variant: cand.length === 1 ? cand[0].variant : variant ?? '', shown: s.price, candidates: cand.map((r) => r.net), match: cand.length === 1 && Math.abs(cand[0].net - s.price) < 0.001 };
    });
    return { profile, offered, communes, state: res.state, expectedGemeinde: loc.gemeinde, engineRows: rows.map((r) => r.cells), checks };
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const years = args.years ?? Array.from({ length: 80 }, (_, i) => 2026 - i);
  const localities = args.npa ? LOCALITIES.filter((l) => args.npa.includes(l.npa)) : LOCALITIES;
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 1600 } });
    const { page, offered, startShown } = await openCalculator(context, { birth: '15.06.1990', female: true, loc: LOCALITIES[0] });
    const labels = await page.evaluate((u) => fetch(u).then((r) => r.json()), LOCALE_URL); // dans la page : mêmes cookies, même proxy
    const meta = await page.evaluate(() => {
      const c = (e) => window.PMSRT.compute(e).value;
      return { app: document.querySelector('meta[name="hls-app-version"]')?.content, model: c('F_Version'), runtime: window.PMSRT.version, start: c('A_GLB_Vertragsbeginn'), approvedUntil: c('F_PRM_TarifGenehmigtBis') };
    });
    Object.assign(meta, { offeredLocalities: offered, startShown });
    console.error('calculateur', JSON.stringify(meta));
    if (meta.start !== START_DATE) throw new Error(`début d'assurance inattendu : ${meta.start}`);

    const lines = [HEADER];
    const index = new Map(); // « npa|année|sexe » -> lignes, pour --verify
    const limits = {}; // produit -> sexe -> années de naissance proposées (première localité)
    const unknownProducts = new Set();
    const anomalies = [];
    for (const loc of localities) {
      for (const birthYear of years) {
        for (const sex of ['f', 'm']) {
          const birth = `15.06.${birthYear}`;
          const res = await page.evaluate(inPageCollect, { birth, sex: sex === 'f' ? 'w' : 'm', loc, products: PRODUCTS, fullOptions: loc.npa === FULL_OPTIONS_NPA });
          const st = res.state;
          if (st.persons !== '1' || st.birth !== birth || st.sex !== (sex === 'f' ? 'w' : 'm') || st.npa !== loc.npa || st.gemeinde !== loc.gemeinde || st.start !== START_DATE || st.duration !== '1' || st.group !== '000') throw new Error(`état du moteur inattendu : ${JSON.stringify(st)}`);
          for (const [p, info] of Object.entries(res.products)) {
            if (!info.known) { if (info.available) unknownProducts.add(p); continue; }
            if (loc === localities[0]) ((limits[p] ??= { f: [], m: [], closed: info.closed })[sex]).push(info.available ? birthYear : null);
          }
          const rows = toCsvRows(res, { birthYear, sex, loc, labels, retrievedAt });
          index.set(`${loc.npa}|${birthYear}|${sex}`, rows);
          for (const r of rows) {
            if (r.ok) lines.push(r.cells.map(csvCell).join(','));
            else anomalies.push(r.cells); // un prix non calculable n'est jamais écrit
          }
        }
      }
      console.error(`${loc.npa} ${loc.name} : ${lines.length - 1} lignes cumulées`);
    }
    await context.close();
    fs.mkdirSync(args.out, { recursive: true });
    fs.writeFileSync(path.join(args.out, `${INSURER}.csv`), lines.join('\n') + '\n');

    const summary = { meta, retrievedAt, rows: lines.length - 1, unknownProducts: [...unknownProducts], anomalyCount: anomalies.length, anomalies: anomalies.slice(0, 40), limits: {} };
    for (const [p, l] of Object.entries(limits)) {
      const span = (a) => { const ys = a.filter((y) => y != null); return ys.length ? `${Math.min(...ys)}-${Math.max(...ys)} (${ys.length}/${a.length} années)` : 'aucune'; };
      summary.limits[p] = { name: labels[`products.${p}.name`]?.trim(), closed: l.closed, f: span(l.f), m: span(l.m) };
    }
    if (args.verify) {
      summary.verify = [];
      for (const profile of VERIFY_PROFILES.filter((v) => localities.some((l) => l.npa === v.npa))) {
        let v;
        try { v = await verifyProfile(browser, profile, labels, retrievedAt); } catch (e) { summary.verify.push({ profile, error: String(e.message).split('\n')[0] }); console.error(`vérification ${JSON.stringify(profile)} : échec`, e.message.split('\n')[0]); continue; }
        // Le relevé (personne modifiée dans le moteur) doit redonner les lignes d'une saisie réelle.
        const collected = index.get(`${profile.npa}|${profile.birthYear}|${profile.sex}`);
        const key = (cells) => [cells[2], cells[3], cells[4], cells[11], cells[12]].join('|');
        const fresh = new Set(v.engineRows.map(key));
        const mine = collected ? collected.filter((r) => !r.option.includes('franchise')).map((r) => key(r.cells)) : null;
        summary.verify.push({
          profile, offered: v.offered, communes: v.communes, gemeindeFromUi: v.state.gemeinde, gemeindeExpected: v.expectedGemeinde,
          collectedVsFreshSession: mine ? { compared: mine.length, freshRows: fresh.size, differing: mine.filter((k) => !fresh.has(k)) } : 'profil hors du relevé',
          screen: { compared: v.checks.length, matching: v.checks.filter((c) => c.match).length, details: v.checks },
        });
        console.error(`vérification ${JSON.stringify(profile)} : écran ${v.checks.filter((c) => c.match).length}/${v.checks.length}`);
      }
    }
    console.log(JSON.stringify(summary, null, 1));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
