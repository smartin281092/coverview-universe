#!/usr/bin/env node
// Relevé des primes LCA 2027 d'Atupri dans le calculateur officiel (brief : ../../premium-brief.md).
//
// Usage : node atupri.mjs [--localities=1003,1204] [--from=1947] [--to=2026]
//                         [--out=../atupri.csv] [--raw-dir=<dossier>]
//
// ÉTAT AU 2026-11-18 : seule l'étape 1 a été exécutée, et elle s'arrête. Le pare-feu applicatif
// d'Atupri répond « Web Page Blocked! » (HTTP 500, Attack ID 20000051) à Chromium sans interface :
// la signature visée est l'agent utilisateur « HeadlessChrome ». Le brief demande l'arrêt en cas de
// blocage ; ce script ne déguise donc pas son agent utilisateur et sort avec le code 2.
// Les étapes 2 à 5 sont écrites d'après le HTML servi et le code de l'application (schémas zod
// des bundles), JAMAIS exécutées : sélecteurs du formulaire, forme des réponses de prix et
// `rowsFromGroup` sont à relire contre les premières réponses réelles (--raw-dir) avant de se
// fier au CSV. Le contrôle à l'écran de l'étape 4 bloque l'écriture s'il échoue.
//
// Codes de sortie : 0 = CSV écrit ; 2 = calculateur bloqué ou injoignable (rien écrit) ;
// 3 = arrêt en cours de relevé (lignes déjà observées écrites) ; 4 = contrôle à l'écran échoué.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALC_URL = 'https://shop.atupri.ch/fr'; // cible de https://calculateur-de-primes.atupri.ch
const YEAR = 2027;
const WANTED_BEGIN = `${YEAR}-01-01`;
const DELAY_MS = 1100;
const PERSONS_PER_LEAD = 12; // INSURED_PERSONS_MAX_FORM_ROWS dans le code de l'application
const HEADER =
  'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
// Localité attendue dans la liste du calculateur (`utils.getPostalCodes`, observé le 2026-11-18).
const LOCALITIES = {
  1003: { city: 'Lausanne', municipality: 'Lausanne' },
  1204: { city: 'Genève', municipality: 'Genève' },
  1950: { city: 'Sion', municipality: 'Sion' },
  2000: { city: 'Neuchâtel', municipality: 'Neuchâtel' },
  1700: { city: 'Fribourg', municipality: 'Fribourg' },
  2800: { city: 'Delémont', municipality: 'Delémont' },
};
// Groupes du calculateur (énumération ProductGroup) ; `basic.insurance` (LAMal) est hors périmètre.
const GROUPS = ['supplementary.insurance', 'hospital.insurance', 'dental.insurance', 'capital.insurance'];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const localities = String(args.localities ?? '1003').split(',').map((s) => s.trim()).filter(Boolean);
const fromYear = Number(args.from ?? 1947);
const toYear = Number(args.to ?? 2026);
const outPath = path.resolve(HERE, String(args.out ?? '../atupri.csv'));
const rawDir = path.resolve(String(args['raw-dir'] ?? path.join(os.tmpdir(), 'atupri-premiums-raw')));
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const money = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : null);

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Étape 1 (exécutée) : ouvrir le calculateur et reconnaître la page de blocage du pare-feu.
async function openCalculator(page) {
  const response = await page.goto(CALC_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const body = await page.locator('body').innerText().catch(() => '');
  if (/Web Page Blocked|requested has been blocked/i.test(`${await page.title()} ${body}`)) {
    const attack = body.match(/Attack ID:\s*(\d+)/)?.[1] ?? 'inconnu';
    throw new Stop(2, `calculateur bloqué par le pare-feu d'Atupri (HTTP ${response?.status()}, Attack ID ${attack})`);
  }
  if (!response?.ok()) throw new Stop(2, `calculateur injoignable (HTTP ${response?.status()})`);
  await page.locator('form[name="insuredPersonsForm"]').waitFor({ timeout: 30000 });
}

// Requête tRPC rejouée depuis la page (cookies de session conservés). Forme observée sur
// `utils.getInsuranceBegin` et `utils.getPostalCodes` ; les autres procédures viennent du code.
async function trpcQuery(page, procedure, input) {
  await sleep(DELAY_MS);
  const res = await page.evaluate(
    async ({ procedure, input }) => {
      const qs = new URLSearchParams({ batch: '1', input: JSON.stringify({ 0: { json: input } }) });
      const r = await fetch(`/api/trpc/${procedure}?${qs}`, { headers: { 'x-trpc-source': 'nextjs-react' } });
      return { status: r.status, text: await r.text() };
    },
    { procedure, input },
  );
  if (res.status === 403 || res.status === 429 || /Web Page Blocked|captcha/i.test(res.text)) {
    throw new Stop(3, `blocage sur ${procedure} (HTTP ${res.status})`);
  }
  if (res.status !== 200) throw new Error(`${procedure} : HTTP ${res.status}`);
  return JSON.parse(res.text)[0]?.result?.data?.json;
}

// Étape 2 (non exécutée) : saisir jusqu'à 12 personnes dans le formulaire, puis « Choisir les
// assurances ». L'application crée alors un brouillon (`offerLead.create`) et ouvre
// /offer/<offerLeadId>/person/<personId>/insurance. Aucune coordonnée n'est saisie.
async function createLead(page, npa, persons) {
  await openCalculator(page);
  const loc = LOCALITIES[npa];
  for (const [i, p] of persons.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Ajouter une personne' }).click();
    await page.locator(`#insuredPersons_${i}_gender_${p.sex === 'f' ? 'female' : 'male'}`).check({ force: true });
    await page.locator(`#insuredPersons_${i}_firstName`).fill('Test');
    await page.locator(`#insuredPersons_${i}_dateOfBirth`).fill(`15.06.${p.birthYear}`);
    const place = page.locator(`input[name="insuredPersons.${i}.postalCodeId"]`);
    if (!(await place.inputValue())) {
      await place.fill(String(npa));
      const options = page.getByRole('option').filter({ hasText: loc.city });
      const exact = options.filter({ hasText: loc.municipality });
      await ((await exact.count()) ? exact.first() : options.first()).click();
    }
  }
  await page.getByRole('button', { name: 'Choisir les assurances' }).click();
  await page.waitForURL(/\/offer\/[0-9a-f-]+\/person\/[0-9a-f-]+\/insurance/, { timeout: 60000 });
  const offerLeadId = page.url().match(/\/offer\/([0-9a-f-]+)\//)[1];
  const people = await trpcQuery(page, 'offerLead.person.getAll', { offerLeadId });
  return { offerLeadId, people };
}

// Étape 3 (non exécutée) : lignes CSV depuis `offerLead.cartesianProduct.getGroup`. Champs attendus
// d'après le schéma : name, group, insuranceBegin, price { amount, currency }, tariff,
// criteria[] { name, type, valueType, value }, pricingElements[] { name, price }.
function rowsFromGroup(products, who, npa) {
  const rows = [];
  for (const p of products ?? []) {
    const amount = money(p?.price?.amount);
    if (!p?.name || amount === null) continue;
    const criteria = (p.criteria ?? []).map((c) => {
      const v = c.value && typeof c.value === 'object' ? (c.value.amount ?? JSON.stringify(c.value)) : c.value;
      return { key: c.name ?? c.type ?? '', value: String(v ?? '') };
    });
    const accident = criteria.find((c) => /accident|unfall/i.test(c.key));
    const others = criteria.filter((c) => c !== accident);
    const notes = [
      `group=${p.group ?? ''}`,
      `insurance_begin=${p.insuranceBegin ?? ''}`,
      p.insuranceBegin !== WANTED_BEGIN ? `begin_differs_from_${WANTED_BEGIN}` : '',
      p.price?.currency && p.price.currency !== 'CHF' ? `currency=${p.price.currency}` : '',
      ...(p.pricingElements ?? []).map((e) => `element:${e.name}=${money(e.price?.amount) ?? ''}`),
    ].filter(Boolean);
    rows.push([
      'atupri', '', p.name, others.map((c) => `${c.key}=${c.value}`).join(' | '), '', YEAR, who.birthYear,
      YEAR - who.birthYear, who.sex, npa, LOCALITIES[npa].city,
      accident ? String(/^(true|yes|oui|ja|1)$/i.test(accident.value)) : '', amount,
      'official_calculator', CALC_URL, today, notes.join('; '),
    ]);
  }
  return rows;
}

async function collectLead(page, npa, persons, raw) {
  const { offerLeadId, people } = await createLead(page, npa, persons);
  const rows = [];
  for (const who of persons) {
    // Appariement par date de naissance et sexe : `getAll` ne garantit pas l'ordre du formulaire.
    const person = (people ?? []).find(
      (x) => x.dateOfBirth === `${who.birthYear}-06-15` && x.gender === (who.sex === 'f' ? 'FEMALE' : 'MALE'),
    );
    if (!person?.id) throw new Error(`personne ${who.birthYear}/${who.sex} absente du brouillon`);
    const offer = await trpcQuery(page, 'offerLead.person.getOffer', { offerLeadId, personId: person.id });
    for (const group of GROUPS) {
      const products = await trpcQuery(page, 'offerLead.cartesianProduct.getGroup', {
        offerLeadId, personId: person.id, offerId: offer?.id, group, insuranceBegin: WANTED_BEGIN,
      });
      fs.writeFileSync(path.join(raw, `${npa}-${who.birthYear}-${who.sex}-${group}.json`), JSON.stringify(products));
      rows.push(...rowsFromGroup(products, who, npa));
    }
  }
  return rows;
}

function writeCsv(rows) {
  fs.writeFileSync(outPath, [HEADER, ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n');
  console.log(`${rows.length} lignes écrites dans ${outPath}`);
}

const browser = await chromium.launch();
const rows = [];
let exitCode = 0;
try {
  const context = await browser.newContext({ locale: 'fr-CH' });
  const page = await context.newPage();
  await openCalculator(page); // s'arrête ici au 2026-11-18
  fs.mkdirSync(rawDir, { recursive: true });

  // Étape 4 (non exécutée) : profil pilote, puis contrôle à l'écran avant tout relevé en série.
  const pilot = [{ birthYear: 1987, sex: 'f' }, { birthYear: 1957, sex: 'm' }, { birthYear: 2017, sex: 'f' }];
  const pilotRows = await collectLead(page, localities[0], pilot, rawDir);
  const screen = (await page.locator('body').innerText()).replace(/[’'  ]/g, '');
  const seen = pilotRows.filter((r) => r[6] === 1987 && screen.includes(r[12])).length;
  if (seen < 3) throw new Stop(4, `contrôle à l'écran : ${seen} prix du profil pilote retrouvés dans la page (3 requis)`);
  console.log(`contrôle à l'écran : ${seen} prix retrouvés`);

  // Étape 5 (non exécutée) : toutes les années et les deux sexes, 12 personnes par brouillon.
  for (const npa of localities) {
    const everyone = [];
    for (let y = fromYear; y <= toYear; y += 1) everyone.push({ birthYear: y, sex: 'f' }, { birthYear: y, sex: 'm' });
    for (let i = 0; i < everyone.length; i += PERSONS_PER_LEAD) {
      await context.clearCookies(); // un brouillon par lot, sans reprise du précédent
      rows.push(...(await collectLead(page, npa, everyone.slice(i, i + PERSONS_PER_LEAD), rawDir)));
    }
  }
} catch (err) {
  exitCode = err instanceof Stop ? err.code : 3;
  console.error(`arrêt : ${err.message}`);
} finally {
  await browser.close();
}
if (rows.length && (exitCode === 0 || exitCode === 3)) writeCsv(rows);
else console.error('aucun CSV écrit');
process.exit(exitCode);
