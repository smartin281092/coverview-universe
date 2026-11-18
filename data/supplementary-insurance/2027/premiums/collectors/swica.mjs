#!/usr/bin/env node
// Relevé des primes LCA 2027 de SWICA dans le calculateur officiel (brief : ../../premium-brief.md).
//
// Usage : node swica.mjs [--localities=1003,1204,1950,2000,1700,2800] [--from=1947] [--to=2026]
//                        [--years=1962,1987] [--out=../swica.csv] [--raw-dir=<dossier>]
//                        [--net-localities=1003] [--group-size=8] [--skip-screen-check]
//
// Méthode : le calculateur (Nuxt) lit ses prix dans `GET …/session/{pin}/insurableperson/{id}/productgroup`,
// qui renvoie en une réponse tous les produits et toutes les combinaisons d'options d'une personne.
// Le script ouvre le calculateur, reprend les en-têtes que l'application envoie elle-même, puis rejoue
// ces appels depuis la page (`fetch`), à 1,1 s d'intervalle.
//
// Deux états sont relevés :
//  - BRUT (colonne monthly_chf) : `productgroup` lu avant toute proposition de produits. Aucune assurance
//    de base n'est dans le panier, le bonus BENEVITA n'est pas appliqué. C'est aussi le prix renvoyé avec
//    une base autre que Favorit Sante une fois BENEVITA désactivé (vérifié, voir swica.md).
//  - NET PAR DÉFAUT (note `calc_default_net`, localités de --net-localities) : `productgroup` relu après
//    `insuranceneeds/productproposal`, c'est-à-dire l'état que l'écran affiche à l'arrivée sur l'étape
//    « Assurances » : base proposée dans le panier et rabais BENEVITA (plus Tarif SANTE si la base
//    proposée est Favorit Sante) déjà déduits.
//
// Les réponses brutes sont gardées dans --raw-dir : relancer le script reprend là où il s'est arrêté.
// Codes de sortie : 0 = CSV écrit ; 2 = calculateur injoignable (rien écrit) ; 3 = arrêt en cours de
// relevé (seules les localités terminées sont écrites, le reste attend dans --raw-dir) ; 4 = contrôle à
// l'écran ou contrôle de session groupée échoué (le CSV est écrit, à relire avant usage).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALC_URL = 'https://calculate.swica.ch/fr?ID=prm-allg&LANGUAGES=2&SWICAKDN=0';
const API = 'https://calculate.swica.ch/backend/offer/v1';
const CAMPAIGN = 'prm-allg';
const YEAR = 2027;
const START = `${YEAR}-01-01`;
const DELAY_MS = 1100;
const HEADER =
  'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
// Nom attendu dans la liste du calculateur pour chaque code postal du brief.
const LOCALITY_NAMES = { 1003: 'Lausanne', 1204: 'Genève', 1950: 'Sion', 2000: 'Neuchâtel', 1700: 'Fribourg', 2800: 'Delémont' };
const GROUPS = ['group.additional.insurance', 'group.hospital.insurance']; // group.base.insurance = LAMal, hors périmètre
const FRANCHISE_TYPES = new Set(['DEDUCTIBLE', 'FRANCHISE', 'YEARLY_FRANCHISE']);
const ACC_ON = 'COD_UZ_EIN';
const ACC_OFF = 'COD_UZ_AUS';
const PILOTS = [
  [1987, 'f'],
  [2015, 'm'],
  [1962, 'm'],
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
const localities = list(args.localities ?? Object.keys(LOCALITY_NAMES).join(','));
const years = args.years
  ? list(args.years).map(Number)
  : Array.from({ length: Number(args.to ?? 2026) - Number(args.from ?? 1947) + 1 }, (_, i) => Number(args.from ?? 1947) + i);
const netLocalities = new Set(list(args['net-localities'] ?? localities[0]));
const groupSize = Number(args['group-size'] ?? 8);
const outPath = path.resolve(HERE, String(args.out ?? '../swica.csv'));
const rawDir = path.resolve(String(args['raw-dir'] ?? path.join(os.tmpdir(), 'swica-premiums-raw')));
fs.mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const money = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : null);
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// --- Règles reprises du code du calculateur ------------------------------------------------------
// `working8HoursPerWeek` n'est pas demandé à l'écran : l'application le déduit de l'âge au jour du
// calcul (moins de 16 ans : non ; femme de moins de 65 ans ou homme de moins de 66 ans : oui).
function working(birthYear, sex) {
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() < 5 || (now.getMonth() === 5 && now.getDate() < 15)) age -= 1;
  return age >= 16 && age < (sex === 'f' ? 65 : 66);
}
const personDto = (who, postcodeId) => ({
  name: 'Test',
  country: 'CH',
  postcodeId,
  postCode: null,
  dateOfBirth: `${who.birthYear}-06-15`,
  working8HoursPerWeek: working(who.birthYear, who.sex),
  unborn: false,
  female: who.sex === 'f',
});
// Libellés « _young » des franchises : 18 ans révolus au plus au début du contrat (né le 15.06).
const isYoung = (birthYear) => YEAR - 1 - birthYear <= 18;
// Identifiant d'affichage d'un modèle : celui du modèle pour les Flex et les capitaux, sinon le produit.
const displayId = (model, productId) => (/\.flex\./.test(model.id) || model.id.startsWith('special.') ? model.id : productId);
const critKey = (criteria) => criteria.map((c) => `${c.name}=${c.value}`).sort().join('&');
const priceKey = (modelId, productId, criteria) => `${modelId}|${productId}|${critKey(criteria)}`;

function flatten(groups) {
  const out = new Map();
  for (const g of groups) {
    for (const m of g.productModels ?? []) {
      for (const cp of m.cartesianProduct ?? []) out.set(priceKey(m.id, cp.productId, cp.criteria), cp.price?.amount);
    }
  }
  return out;
}

// --- Traductions (rms.swica.ch) --------------------------------------------------------------------
function buildTranslator(payload) {
  const map = new Map();
  for (const item of payload?.data ?? []) {
    const text = String(item.data?.value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    map.set(String(item.data?.name ?? '').trim(), text);
  }
  return (key) => map.get(key) || null;
}

// --- Lignes du CSV -------------------------------------------------------------------------------
// Une ligne par produit × variante × option ; le prix retenu est celui « accident inclus » quand
// l'option existe, le prix sans accident allant dans les notes.
function rowsFromGroups(groups, netGroups, netBase, who, t, retrievedAt) {
  const rows = [];
  const net = netGroups ? flatten(netGroups) : null;
  const young = isYoung(who.birthYear);
  const valueLabel = (name, value) =>
    (young && (name === 'FRANCHISE' || name === 'YEARLY_FRANCHISE') && t(`app.product.option.label.${value}_young`)) ||
    t(`app.product.option.label.${value}`) ||
    value;
  for (const groupId of GROUPS) {
    const group = groups.find((g) => g.id === groupId);
    for (const model of group?.productModels ?? []) {
      const productIds = [...new Set(model.cartesianProduct.map((cp) => cp.productId))];
      for (const productId of productIds) {
        const name = t(`${displayId(model, productId)}.title`) ?? displayId(model, productId);
        const typeLabel = (critName) => {
          if (critName === 'INSURED_SUM' && productId === 'prod.denta') return t('app.product.option.type.DENTA_INSURED_SUM');
          if (critName === 'INSURED_SUM' && productId.endsWith('.disability')) return t('app.product.option.type.DISABILITY_INSURED_SUM');
          if (critName === 'INSURED_SUM' && productId.endsWith('.death')) return t('app.product.option.type.DEATH_INSURED_SUM');
          return t(`app.product.option.type.${critName}`) ?? critName;
        };
        // Regroupe les combinaisons qui ne diffèrent que par la couverture accident.
        const combos = new Map();
        for (const cp of model.cartesianProduct.filter((c) => c.productId === productId)) {
          const rest = cp.criteria.filter((c) => c.name !== 'ACCIDENT');
          const acc = cp.criteria.find((c) => c.name === 'ACCIDENT')?.value ?? '';
          const key = critKey(rest);
          if (!combos.has(key)) combos.set(key, { rest, byAcc: new Map() });
          combos.get(key).byAcc.set(acc, cp);
        }
        // Valeur standard d'une franchise : le code le plus bas proposé (CHF 0 quand il existe).
        const lowest = {};
        for (const { rest } of combos.values()) {
          for (const c of rest) if (FRANCHISE_TYPES.has(c.name) && (!lowest[c.name] || c.value < lowest[c.name])) lowest[c.name] = c.value;
        }
        // Optima : la « franchise » reprend celle de l'assurance de base ; si elle ne change aucun prix,
        // une seule ligne est écrite.
        const sig = (combo) => [...combo.byAcc].map(([a, cp]) => `${a}:${cp.price?.amount}`).sort().join(',');
        const yearlyNoEffect =
          [...combos.values()].every((c) => c.rest.some((x) => x.name === 'YEARLY_FRANCHISE')) &&
          new Set([...combos.values()].map((c) => `${critKey(c.rest.filter((x) => x.name !== 'YEARLY_FRANCHISE'))}#${sig(c)}`)).size ===
            new Set([...combos.values()].map((c) => critKey(c.rest.filter((x) => x.name !== 'YEARLY_FRANCHISE')))).size;
        for (const combo of [...combos.values()].sort((a, b) => critKey(a.rest).localeCompare(critKey(b.rest)))) {
          const yearly = combo.rest.find((c) => c.name === 'YEARLY_FRANCHISE');
          if (yearly && yearlyNoEffect && yearly.value !== lowest.YEARLY_FRANCHISE) continue;
          const chosen = combo.byAcc.get(ACC_ON) ?? combo.byAcc.get('') ?? combo.byAcc.get(ACC_OFF);
          const price = money(chosen?.price?.amount);
          if (price === null) continue; // prix absent : rien n'est écrit
          const accident = combo.byAcc.has(ACC_ON) ? 'true' : combo.byAcc.has('') ? '' : 'false';
          const variant = [];
          const option = [];
          const notes = ['gross_no_base'];
          for (const c of combo.rest) {
            const label = valueLabel(c.name, c.value);
            if (!FRANCHISE_TYPES.has(c.name)) variant.push(`${typeLabel(c.name)} ${label}`);
            else if (c.name === 'YEARLY_FRANCHISE' && yearlyNoEffect) notes.push('base_franchise_no_effect');
            else if (c.value !== lowest[c.name]) option.push(`${typeLabel(c.name)} ${label}`);
            else if (label !== 'CHF 0') notes.push(`franchise=${label}`);
          }
          if (accident === 'true' && combo.byAcc.has(ACC_OFF)) notes.push(`no_accident=${money(combo.byAcc.get(ACC_OFF).price?.amount)}`);
          if (net) {
            const netPrice = money(net.get(priceKey(model.id, productId, chosen.criteria)));
            if (netPrice !== null) notes.push(`calc_default_net=${netPrice}`, `calc_default_base=${netBase ?? 'none'}`);
          }
          notes.push(`id=${model.id.startsWith('special.') ? productId : model.id}`);
          rows.push([
            'swica',
            '',
            name,
            variant.join(' / '),
            option.join(' / '),
            YEAR,
            who.birthYear,
            YEAR - who.birthYear,
            who.sex,
            who.postalCode,
            who.locality,
            accident,
            price,
            'official_calculator',
            CALC_URL,
            retrievedAt,
            notes.join(';'),
          ]);
        }
      }
    }
  }
  return rows;
}

// --- Navigateur ------------------------------------------------------------------------------------
const browser = await chromium.launch();
let exitCode = 0;
const rows = [];
const collected = new Map(); // `${postalCode}-${birthYear}-${sex}` -> groupes bruts
const blocked = new Set();
let requestCount = 0;
try {
  const context = await browser.newContext({ locale: 'fr-CH' });
  const page = await context.newPage();
  page.on('requestfailed', (r) => {
    if (/ERR_TUNNEL_CONNECTION_FAILED/.test(r.failure()?.errorText ?? '')) blocked.add(new URL(r.url()).host);
  });

  // 1. Page d'entrée : en-têtes que l'application envoie à son backend, et traductions françaises.
  const firstCall = page.waitForRequest((r) => r.url().startsWith(`${API}/countries`), { timeout: 90000 });
  const i18n = page.waitForResponse((r) => /rms\.swica\.ch\/.*\/translations/.test(r.url()) && r.ok(), { timeout: 90000 });
  let appHeaders;
  let t;
  try {
    await page.goto(CALC_URL, { waitUntil: 'networkidle', timeout: 90000 });
    const h = (await firstCall).headers();
    appHeaders = {
      authorization: h.authorization,
      'x-adc-account-id': h['x-adc-account-id'],
      'client-page': h['client-page'],
      accept: 'application/json, text/plain, */*',
    };
    t = buildTranslator(await (await i18n).json());
  } catch (error) {
    throw new Stop(2, `Calculateur injoignable (${error.message.split('\n')[0]}) ; hôtes refusés : ${[...blocked].join(', ') || 'aucun'}.`);
  }
  if (!appHeaders.authorization || t('prod.completa.top.title') === null) throw new Stop(2, 'En-têtes ou traductions du calculateur introuvables.');

  let failures = 0;
  const call = async (method, pathname, body, zip) => {
    const res = await page.evaluate(
      async ([m, u, b, hd]) => {
        try {
          const r = await fetch(u, { method: m, headers: b ? { ...hd, 'content-type': 'application/json' } : hd, body: b ? JSON.stringify(b) : undefined });
          return { status: r.status, text: await r.text() };
        } catch (e) {
          return { status: 0, text: String(e) };
        }
      },
      [method, `${API}${pathname}`, body, zip ? { ...appHeaders, 'x-adc-passphrase': zip } : appHeaders],
    );
    requestCount += 1;
    await sleep(DELAY_MS);
    if (res.status === 403 || res.status === 429 || /captcha|turnstile/i.test(res.text.slice(0, 3000))) {
      throw new Stop(3, `Blocage (HTTP ${res.status}) sur ${method} ${pathname} : arrêt.`);
    }
    if (res.status < 200 || res.status >= 300) {
      failures += 1;
      console.log(`HTTP ${res.status} sur ${method} ${pathname}`);
      if (failures >= 3) throw new Stop(3, 'Trois erreurs consécutives : arrêt.');
      return null;
    }
    failures = 0;
    return res.text ? JSON.parse(res.text) : {};
  };

  const rawFile = (who, kind) => path.join(rawDir, `${who.postalCode}-${who.birthYear}-${who.sex}-${kind}.json`);
  const readRaw = (who, kind) => {
    const file = rawFile(who, kind);
    if (!fs.existsSync(file)) return null;
    return { data: JSON.parse(fs.readFileSync(file, 'utf8')), date: isoDate(fs.statSync(file).mtime) };
  };
  const writeRaw = (who, kind, data) => fs.writeFileSync(rawFile(who, kind), JSON.stringify(data));

  const openSession = async (who, postcodeId) => {
    const session = await call('POST', '', { ...personDto(who, postcodeId), offerAnalytics: { campaignId: CAMPAIGN, utmParameters: {} } });
    if (!session?.pin) return null;
    await call('PUT', `/session/${session.pin}/kvg`, { ...session, insuranceBegin: START }, who.postalCode);
    await call('PUT', `/session/${session.pin}/vvg`, { ...session, insuranceBegin: START }, who.postalCode);
    return session;
  };
  const productGroups = (pin, personId, zip) => call('GET', `/session/${pin}/insurableperson/${personId}/productgroup`, null, zip);

  // Une personne par session, comme l'écran : brut, puis proposition du calculateur, puis net par défaut.
  const collectSolo = async (who, postcodeId) => {
    const session = await openSession(who, postcodeId);
    if (!session) return;
    const gross = await productGroups(session.pin, session.personId, who.postalCode);
    if (!Array.isArray(gross)) return;
    const proposal = await call('GET', `/session/${session.pin}/insurableperson/${session.personId}/insuranceneeds/productproposal`, null, who.postalCode);
    const netGroups = proposal ? await productGroups(session.pin, session.personId, who.postalCode) : null;
    if (!proposal || !Array.isArray(netGroups)) return;
    writeRaw(who, 'proposal', proposal);
    writeRaw(who, 'net', netGroups);
    writeRaw(who, 'gross', gross); // écrit en dernier : sa présence marque le profil comme complet
  };
  // Plusieurs personnes par session (brut seulement) : la première ouvre la session, les autres s'y ajoutent.
  const collectGroup = async (people, postcodeId, kind = 'gross') => {
    const session = await openSession(people[0], postcodeId);
    if (!session) return;
    const ids = [session.personId];
    for (const who of people.slice(1)) {
      const added = await call('POST', `/session/${session.pin}/insurableperson`, { ...personDto(who, postcodeId), idSynced: false }, who.postalCode);
      ids.push(added?.personId ?? null);
    }
    for (let i = 0; i < people.length; i += 1) {
      if (!ids[i]) continue;
      const gross = await productGroups(session.pin, ids[i], people[i].postalCode);
      if (Array.isArray(gross)) writeRaw(people[i], kind, gross);
    }
  };

  // 2. Relevé.
  let groupChecked = false;
  for (const postalCode of localities) {
    const found = await call('GET', `/postcode?q=${encodeURIComponent(postalCode)}`);
    const wanted = LOCALITY_NAMES[postalCode];
    const match = (found ?? []).find((l) => l.postcode === postalCode && (!wanted || String(l.city).includes(wanted)));
    if (!match) {
      console.log(`Localité ${postalCode} introuvable dans le calculateur : ignorée.`);
      continue;
    }
    const locality = String(match.city).replace(/\s*\(.*\)\s*$/, '');
    const people = years.flatMap((birthYear) => ['f', 'm'].map((sex) => ({ birthYear, sex, postalCode, locality })));
    const withNet = netLocalities.has(postalCode);
    const todo = people.filter((who) => !readRaw(who, 'gross') || (withNet && !readRaw(who, 'net')));
    console.log(`${postalCode} ${locality} : ${people.length} profils, ${todo.length} à relever (${withNet ? 'une personne par session, brut + net' : `sessions de ${groupSize} personnes, brut`}).`);
    if (withNet) {
      for (const who of todo) await collectSolo(who, match.id);
    } else {
      if (!groupChecked) {
        // Contrôle : le prix brut d'une personne ajoutée à une session groupée doit être celui de la même
        // personne seule (profils pilotes de la première localité relevée seule).
        const ref = PILOTS.map(([birthYear, sex]) => ({ birthYear, sex, postalCode: localities[0] })).filter((who) => readRaw(who, 'gross'));
        if (netLocalities.has(localities[0]) && ref.length > 1) {
          const refMatch = (await call('GET', `/postcode?q=${localities[0]}`) ?? []).find((l) => l.postcode === localities[0]);
          await collectGroup(ref, refMatch.id, 'groupcheck');
          for (const who of ref) {
            const solo = flatten(readRaw(who, 'gross').data);
            const grouped = flatten(readRaw(who, 'groupcheck')?.data ?? []);
            const differs = solo.size !== grouped.size || [...solo].some(([k, v]) => grouped.get(k) !== v);
            if (differs) throw new Stop(4, `Session groupée ≠ session seule pour ${who.birthYear}/${who.sex} : relancer avec --net-localities=${localities.join(',')}.`);
          }
          console.log(`Contrôle session groupée : ${ref.length} profils identiques à leur session seule.`);
        }
        groupChecked = true;
      }
      for (let i = 0; i < todo.length; i += groupSize) await collectGroup(todo.slice(i, i + groupSize), match.id);
    }
    let missing = 0;
    for (const who of people) {
      const gross = readRaw(who, 'gross');
      if (!gross) {
        missing += 1;
        continue;
      }
      const netRaw = withNet ? readRaw(who, 'net') : null;
      const base = withNet ? readRaw(who, 'proposal')?.data?.productGroups?.find((g) => g.id === 'group.base.insurance')?.products?.[0]?.id : null;
      collected.set(`${postalCode}-${who.birthYear}-${who.sex}`, gross.data);
      rows.push(...rowsFromGroups(gross.data, netRaw?.data, base?.replace(/^prod\./, ''), who, t, gross.date));
    }
    if (missing) console.log(`  ${missing} profils sans réponse pour ${postalCode}.`);
  }

  // 3. Contrôle à l'écran (profils pilotes, première localité) : le calculateur est mis dans l'état
  // « base Standard, BENEVITA désactivé, accident inclus », où il affiche les prix bruts du relevé.
  if (!args['skip-screen-check']) {
    const zip = localities[0];
    let ok = 0;
    let ko = 0;
    for (const [birthYear, sex] of PILOTS) {
      const expected = collected.get(`${zip}-${birthYear}-${sex}`);
      if (!expected) continue;
      const result = await screenCheck(browser, { birthYear, sex, postalCode: zip }, flatten(expected), t);
      ok += result.ok;
      ko += result.ko;
      await sleep(DELAY_MS);
    }
    console.log(`Contrôle à l'écran : ${ok} prix identiques, ${ko} différents.`);
    if (ko > 0 || ok < 3) throw new Stop(4, 'Contrôle à l\'écran insuffisant ou en échec : relire avant de se fier au CSV.');
  }
} catch (error) {
  if (!(error instanceof Stop)) {
    await browser.close();
    throw error;
  }
  exitCode = error.code;
  console.error(`ARRÊT : ${error.message}`);
} finally {
  await browser.close();
}

// Parcourt l'interface pour une personne et compare les prix affichés aux prix bruts relevés.
async function screenCheck(browserInstance, who, expected, t) {
  const context = await browserInstance.newContext({ locale: 'fr-CH', viewport: { width: 1280, height: 2000 } });
  const page = await context.newPage();
  const result = { ok: 0, ko: 0 };
  try {
    let latest = null;
    let headers = null;
    page.on('response', async (r) => {
      if (!/\/insurableperson\/[^/]+\/productgroup$/.test(r.url()) || r.request().method() !== 'GET' || !r.ok()) return;
      headers = r.request().headers();
      latest = { url: r.url(), data: await r.json().catch(() => null) };
    });
    const settle = async () => {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    };
    await page.goto(CALC_URL, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.getByText(who.sex === 'f' ? 'Féminin' : 'Masculin', { exact: true }).click();
    await page.getByLabel('Prénom').fill('Test');
    await page.getByLabel('Date de naissance').fill(`15.06.${who.birthYear}`);
    await page.getByLabel('NPA').click();
    await page.getByLabel('NPA').pressSequentially(who.postalCode, { delay: 200 });
    await page.locator('.v-overlay .v-list-item', { hasText: LOCALITY_NAMES[who.postalCode] ?? who.postalCode }).first().click({ timeout: 15000 });
    const start = await page.getByLabel('Début souhaité du contrat').inputValue();
    if (start !== `01.01.${YEAR}`) throw new Error(`début de contrat proposé : ${start}`);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForURL(/\/products/, { timeout: 30000 });
    await settle();
    if (!latest?.data) throw new Error('aucune réponse productgroup observée');
    // BENEVITA désactivé par l'appel que fait l'écran « Résumé », puis base Standard choisie à l'écran.
    const personUrl = latest.url.replace(/\/productgroup$/, '');
    const status = await page.evaluate(
      async ([u, hd]) => (await fetch(u, { method: 'PUT', headers: { ...hd, 'content-type': 'application/json' }, body: JSON.stringify({ bonusProgram: false }) })).status,
      [`${personUrl}/bonusprogram`, { authorization: headers.authorization, 'x-adc-account-id': headers['x-adc-account-id'], 'x-adc-passphrase': headers['x-adc-passphrase'], 'client-page': headers['client-page'], accept: 'application/json, text/plain, */*' }],
    );
    if (status !== 200) throw new Error(`désactivation de BENEVITA : HTTP ${status}`);
    await page.locator('[data-testid="prod.standard.switch"]').click();
    await settle();
    const readCards = () =>
      page.locator('.product-model').evaluateAll((cards) =>
        cards.map((card) => ({
          id: (card.querySelector('[data-testid$=".switch"]')?.getAttribute('data-testid') ?? '').replace(/\.switch$/, ''),
          title: card.querySelector('.title')?.textContent.trim(),
          price: card.querySelector('.price-container .price')?.textContent.trim(),
        })),
      );
    const compare = (cards, accidentOn) => {
      const models = GROUPS.flatMap((g) => latest.data.find((x) => x.id === g)?.productModels ?? []);
      for (const card of cards) {
        const model = models.find((m) => m.cartesianProduct.some((cp) => displayId(m, cp.productId) === card.id));
        if (!model || !card.price) continue;
        let sum = 0;
        for (const def of model.defaultCartesianProducts) {
          const cp = model.cartesianProduct.find((c) => c.id === def.cartesianProductId);
          const hasOn = model.cartesianProduct.some((c) => c.productId === cp.productId && c.criteria.some((x) => x.value === ACC_ON));
          const criteria = cp.criteria.map((c) => (c.name === 'ACCIDENT' && accidentOn && hasOn ? { ...c, value: ACC_ON } : c));
          sum += expected.get(priceKey(model.id, cp.productId, criteria)) ?? NaN;
        }
        const same = money(Math.round(sum * 100) / 100) === card.price.replace(/[’']/g, '');
        result[same ? 'ok' : 'ko'] += 1;
        console.log(`  ${same ? 'OK ' : 'KO '} ${who.birthYear}/${who.sex} ${accidentOn ? 'accident inclus' : 'accident par défaut'} — ${card.title} : écran ${card.price}, relevé ${money(sum)}`);
      }
    };
    for (const groupId of ['group.hospital.insurance', 'group.additional.insurance']) {
      await page.getByText(t(groupId), { exact: true }).first().click();
      await page.waitForTimeout(1500);
      // L'onglet des complémentaires ouvre un dialogue « Besoins » : on le ferme sans rien choisir.
      const closeDialog = page.locator('.v-overlay--active .app-dialog-close-btn');
      if (await closeDialog.count()) {
        await closeDialog.first().click();
        await page.waitForTimeout(800);
      }
      compare((await readCards()).filter((c) => c.id), false);
      // Ajoute le premier produit qui propose les deux couvertures accident et choisit « Avec ».
      const models = latest.data.find((x) => x.id === groupId)?.productModels ?? [];
      const target = models.find((m) => [ACC_ON, ACC_OFF].every((v) => m.cartesianProduct.some((cp) => cp.criteria.some((x) => x.value === v))));
      if (!target) continue;
      const id = displayId(target, target.cartesianProduct[0].productId);
      await page.locator(`[data-testid="${id}.switch"]`).click();
      await settle();
      const select = page.locator(`#product-details-${id.replace(/[._]/g, '-')} .v-select`, { hasText: t('app.product.option.type.ACCIDENT') });
      await select.first().click();
      await page.locator('.v-overlay--active .v-list-item', { hasText: t('app.product.option.label.COD_UZ_EIN') }).first().click();
      await settle();
      // Le produit ajouté affiche sa propre sélection (franchise par défaut) : même règle de calcul.
      compare((await readCards()).filter((c) => c.id), true);
    }
  } catch (error) {
    result.ko += 1;
    console.log(`  KO  ${who.birthYear}/${who.sex} — parcours à l'écran interrompu : ${error.message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
  return result;
}

if (rows.length > 0) {
  fs.writeFileSync(outPath, `${[HEADER, ...rows.map((r) => r.map(csv).join(','))].join('\n')}\n`);
  const ages = new Map();
  for (const r of rows) {
    const range = ages.get(r[2]) ?? [Infinity, -Infinity];
    ages.set(r[2], [Math.min(range[0], r[7]), Math.max(range[1], r[7])]);
  }
  console.log(`${rows.length} lignes écrites dans ${outPath} (${requestCount} requêtes au backend).`);
  for (const [key, [min, max]] of ages) console.log(`  ${key} : ${min} à ${max} ans`);
} else {
  console.log('Aucun prix observé : aucun CSV écrit.');
}
if (blocked.size) console.log(`Hôtes refusés par le proxy : ${[...blocked].join(', ')}`);
process.exit(exitCode);
