#!/usr/bin/env node
// Relevé des primes LCA 2027 d'Assura dans le calculateur officiel (brief : ../../premium-brief.md).
//
// Usage : node assura.mjs [--localities=1003,1204] [--from=1947] [--to=2026]
//                         [--out=../assura.csv] [--raw-dir=<dossier>] [--skip-screen-check]
//
// ÉTAT AU 2026-11-18 : les étapes 1 et 2 ont été exécutées ; l'étape 2 s'arrête parce que
// `public-api.assura.ch` (localités ET prix) est refusé par le proxy de la session. Les étapes 3
// à 5 sont écrites d'après le code du calculateur (bundle `_app`), JAMAIS exécutées : la forme de
// la réponse de prix n'a pas été observée. `rowsFromResponse` est donc à relire contre la première
// réponse réelle (enregistrée dans --raw-dir) avant de se fier au CSV ; le contrôle à l'écran de
// l'étape 4 bloque l'écriture si les prix lus ne se retrouvent pas dans la page.
//
// Codes de sortie : 0 = CSV écrit ; 2 = hôte de prix injoignable (rien écrit) ;
// 3 = arrêt en cours de relevé (lignes déjà observées écrites) ; 4 = contrôle à l'écran échoué.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALC_URL = 'https://calculator.assura.ch/fr';
const API_HOST = 'public-api.assura.ch';
const API_BASE = `https://${API_HOST}/api`;
const PRICE_PATH = '/DisplayRules/GetDisplayProductRulesSyrius';
const YEAR = 2027;
const DELAY_MS = 1100;
const HEADER =
  'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';
// Nom attendu dans la liste du calculateur pour chaque code postal du brief.
const LOCALITY_NAMES = {
  1003: 'Lausanne',
  1204: 'Genève',
  1950: 'Sion',
  2000: 'Neuchâtel',
  1700: 'Fribourg',
  2800: 'Delémont',
};
// Groupes du calculateur hors périmètre : assurance de base (LAMal) et protection juridique.
const EXCLUDED_GROUPS = new Set(['Default_Basic', 'Default_Lexa']);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const localities = String(args.localities ?? Object.keys(LOCALITY_NAMES).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const fromYear = Number(args.from ?? 1947);
const toYear = Number(args.to ?? 2026);
const outPath = path.resolve(HERE, String(args.out ?? '../assura.csv'));
const rawDir = path.resolve(String(args['raw-dir'] ?? path.join(os.tmpdir(), 'assura-premiums-raw')));
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

// Titres affichés par le calculateur : ils viennent du CMS (`productsConfigurations`).
function catalogFromCms(config) {
  const products = new Map();
  for (const group of config?.[0]?.products_groups ?? []) {
    for (const sub of group.products_sub_groups ?? []) {
      for (const p of sub.products ?? []) {
        if (!p?.insurance_id) continue;
        const variants = new Map((p.variants ?? []).map((v) => [v.value?.variantId, v.value?.title]));
        products.set(p.insurance_id, { title: p.title, group: group.identifier, obsolete: !!p.obsolete, variants });
      }
    }
  }
  return products;
}

// NON VÉRIFIÉ (voir en-tête) : champs lus par le calculateur lui-même dans la réponse de prix —
// partners[].products[] { id, basicInsurance, variants[] { id, franchise, insuredCapital,
// annualAmount, premium { gross, net, netWithAccident } }, accident { selectable }, contractStartDate }.
function rowsFromResponse(data, catalog, who) {
  const rows = [];
  for (const product of data?.partners?.[0]?.products ?? []) {
    const meta = catalog.get(product.id);
    if (product.basicInsurance || !meta || EXCLUDED_GROUPS.has(meta.group)) continue;
    for (const variant of product.variants ?? []) {
      const p = variant.premium ?? {};
      const withAccident = product.accident?.selectable === true && money(p.netWithAccident) !== null;
      const price = withAccident ? money(p.netWithAccident) : (money(p.gross) ?? money(p.net));
      if (price === null) continue; // prix absent : rien n'est écrit
      const notes = [`price_field=${withAccident ? 'netWithAccident' : money(p.gross) !== null ? 'gross' : 'net'}`];
      if (money(p.gross) !== null && money(p.gross) !== price) notes.push(`gross=${money(p.gross)}`);
      if (money(p.net) !== null && money(p.net) !== price) notes.push(`net=${money(p.net)}`);
      if (product.contractStartDate) notes.push(`start=${String(product.contractStartDate).slice(0, 10)}`);
      const option = variant.franchise ?? variant.insuredCapital ?? variant.annualAmount ?? '';
      rows.push([
        'assura',
        '',
        meta.title,
        meta.variants.get(variant.id) ?? (variant.id === product.id ? '' : variant.id),
        option === null ? '' : option,
        YEAR,
        who.birthYear,
        YEAR - who.birthYear,
        who.sex,
        who.postalCode,
        who.locality,
        product.accident?.selectable === true ? String(withAccident) : '',
        price,
        'official_calculator',
        CALC_URL,
        today,
        notes.join(';'),
      ]);
    }
  }
  return rows;
}

const browser = await chromium.launch();
let exitCode = 0;
const rows = [];
try {
  const context = await browser.newContext({ locale: 'fr-CH' });
  const page = await context.newPage();
  const blocked = new Set();
  page.on('requestfailed', (r) => {
    if (/ERR_TUNNEL_CONNECTION_FAILED/.test(r.failure()?.errorText ?? '')) blocked.add(new URL(r.url()).host);
  });

  // 1. Page d'entrée et catalogue de produits (CMS).
  const cmsResponse = page.waitForResponse((r) => r.url().endsWith('/api/collections/get/productsConfigurations'), {
    timeout: 60000,
  });
  await page.goto(CALC_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500); // le formulaire n'accepte les saisies qu'une fois l'application hydratée
  const catalog = catalogFromCms(await (await cmsResponse).json());
  const inScope = [...catalog].filter(([, p]) => !EXCLUDED_GROUPS.has(p.group));
  console.log(`Catalogue : ${inScope.length} produits complémentaires — ${inScope.map(([, p]) => p.title).join(', ')}`);

  // 2. Profil pilote dans l'interface : femme, 15.06.1987, première localité demandée.
  const pilot = { birthYear: 1987, sex: 'f', postalCode: localities[0] };
  await page.locator(`input[name="persons.0.gender"][value="${pilot.sex}"]`).check({ force: true });
  await page.fill('[data-testid="form-editFamily-firstname"]', 'Test');
  await page.fill('input[name="persons[0].birthDate"]', `15.06.${pilot.birthYear}`);
  await page.locator('#locality').focus();
  await page.locator('#locality').pressSequentially(pilot.postalCode, { delay: 150 });
  const option = page.locator('[role="option"]', { hasText: LOCALITY_NAMES[pilot.postalCode] ?? pilot.postalCode }).first();
  try {
    await option.waitFor({ timeout: 15000 });
  } catch {
    if (blocked.has(API_HOST)) {
      throw new Stop(2, `${API_HOST} est refusé par le proxy : ni localités ni prix. Rien n'est écrit.`);
    }
    throw new Stop(2, `Aucune localité proposée pour ${pilot.postalCode} (hôtes refusés : ${[...blocked].join(', ') || 'aucun'}).`);
  }
  pilot.locality = (await option.innerText()).replace(/^\d{4}\s*/, '').trim();

  // 3. Enregistrement : le calculateur envoie sa requête de prix, qui sert de gabarit.
  const priceResponse = page.waitForResponse((r) => r.url().includes(PRICE_PATH), { timeout: 60000 });
  await option.click();
  await page.click('[data-testid="form-editFamily-save"]');
  const first = await priceResponse;
  if (!first.ok()) throw new Stop(2, `Requête de prix du calculateur : HTTP ${first.status()}.`);
  const template = first.request().postDataJSON();
  const pilotData = await first.json();
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, 'pilot-request.json'), JSON.stringify(template, null, 2));
  fs.writeFileSync(path.join(rawDir, 'pilot-response.json'), JSON.stringify(pilotData, null, 2));

  // 4. Contrôle à l'écran : les prix lus pour le profil pilote doivent figurer dans la page.
  await page.waitForTimeout(3000);
  const screenText = (await page.evaluate(() => document.body.innerText)).replace(/[’']/g, '');
  const pilotRows = rowsFromResponse(pilotData, catalog, pilot);
  const seen = pilotRows.filter((r) => screenText.includes(r[12]));
  console.log(`Contrôle à l'écran (pilote) : ${seen.length}/${pilotRows.length} prix retrouvés dans la page.`);
  for (const r of seen.slice(0, 5)) console.log(`  vu à l'écran : ${r[2]} ${r[3]} ${r[4]} = ${r[12]}`);
  if (seen.length < 3 && !args['skip-screen-check']) {
    throw new Stop(4, `Moins de 3 prix retrouvés à l'écran : relire rowsFromResponse contre ${rawDir}/pilot-response.json.`);
  }

  // 5. Rejeu de la requête depuis la page (mêmes cookies et origine), une personne par requête.
  const call = (method, url, body) =>
    page.evaluate(
      async ([m, u, b]) => {
        const res = await fetch(u, {
          method: m,
          headers: b ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
          body: b ? JSON.stringify(b) : undefined,
        });
        const text = await res.text();
        return { status: res.status, text };
      },
      [method, url, body],
    );
  let failures = 0;
  for (const postalCode of localities) {
    let localityId = template.common.localityId;
    let locality = pilot.locality;
    if (postalCode !== pilot.postalCode) {
      const res = await call('GET', `${API_BASE}/Localities/${encodeURIComponent(postalCode)}`);
      await sleep(DELAY_MS);
      const list = res.status === 200 ? JSON.parse(res.text) : [];
      const match = (Array.isArray(list) ? list : (list.localities ?? [])).find((l) =>
        String(l.name).includes(LOCALITY_NAMES[postalCode] ?? postalCode),
      );
      if (!match) {
        console.log(`Localité ${postalCode} introuvable (HTTP ${res.status}) : ignorée.`);
        continue;
      }
      localityId = match.id;
      locality = String(match.name).replace(/^\d{4}\s*/, '').trim();
    }
    for (let birthYear = fromYear; birthYear <= toYear; birthYear += 1) {
      for (const sex of ['f', 'm']) {
        const who = { birthYear, sex, postalCode, locality };
        const partner = {
          ...template.partners[0],
          gender: sex,
          birthDate: String(template.partners[0].birthDate).replace(String(pilot.birthYear), String(birthYear)),
          selectedProducts: [],
        };
        const body = { ...template, common: { ...template.common, localityId }, partners: [partner] };
        const res = await call('POST', `${API_BASE}${PRICE_PATH}`, body);
        await sleep(DELAY_MS);
        if (res.status === 403 || res.status === 429 || /captcha/i.test(res.text.slice(0, 2000))) {
          throw new Stop(3, `Blocage (HTTP ${res.status}) à ${postalCode}/${birthYear}/${sex} : arrêt.`);
        }
        if (res.status !== 200) {
          failures += 1;
          console.log(`HTTP ${res.status} pour ${postalCode}/${birthYear}/${sex}`);
          if (failures >= 3) throw new Stop(3, 'Trois erreurs consécutives : arrêt.');
          continue;
        }
        failures = 0;
        fs.writeFileSync(path.join(rawDir, `${postalCode}-${birthYear}-${sex}.json`), res.text);
        rows.push(...rowsFromResponse(JSON.parse(res.text), catalog, who));
      }
    }
  }
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  exitCode = error.code;
  console.error(`ARRÊT : ${error.message}`);
} finally {
  await browser.close();
}

if (rows.length > 0) {
  fs.writeFileSync(outPath, `${[HEADER, ...rows.map((r) => r.map(csv).join(','))].join('\n')}\n`);
  const ages = new Map();
  for (const r of rows) {
    const key = `${r[2]}${r[3] ? ` / ${r[3]}` : ''}`;
    const range = ages.get(key) ?? [Infinity, -Infinity];
    ages.set(key, [Math.min(range[0], r[7]), Math.max(range[1], r[7])]);
  }
  console.log(`${rows.length} lignes écrites dans ${outPath}`);
  for (const [key, [min, max]] of ages) console.log(`  ${key} : ${min} à ${max} ans`);
} else {
  console.log('Aucun prix observé : aucun CSV écrit.');
}
process.exit(exitCode);
