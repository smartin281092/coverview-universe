#!/usr/bin/env node
// Relevé des primes LCA 2027 d'AXA dans le calculateur officiel https://www.axa.ch/health-dsn/fr
//
// Méthode : le calculateur (Next.js + Apollo) obtient ses prix par des requêtes GraphQL persistées
// (POST https://www.axa.ch/health-dsn/api/graphql). Le script ouvre la page une fois avec Playwright
// (cookie de session HEALTH_DSN_SESSION_TOKEN), observe les empreintes des requêtes persistées, puis
// rejoue `UpdateSession` dans le contexte de la page : une personne seule par appel (deux personnes
// ou plus déclenchent le rabais famille), avec la configuration de produits voulue.
//
// Usage (Playwright installé globalement) :
//   NODE_PATH=$(npm root -g) node collectors/axa.mjs
//   options : --out=<csv> --localities=1003,1204 --years=1947-2026 --options=first|all|none
//             --raw=<fichier.jsonl> --append
//
// Rien n'est soumis : aucune coordonnée, aucun questionnaire, aucune proposition.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const CALCULATOR_URL = 'https://www.axa.ch/health-dsn/fr';
const GRAPHQL_PATH = '/health-dsn/api/graphql';
const YEAR = 2027;
const CONTRACT_BEGIN = '2027-01-01T00:00:00.000Z';
const MIN_DELAY_MS = 1100;
const HEADER = 'insurer,product_key,product_name,variant,option,year,birth_year,age,sex,postal_code,locality,accident,monthly_chf,source_type,source_url,retrieved_at,notes';

// Empreintes observées le 2026-11-18 ; remplacées par celles que la page envoie réellement quand elles sont vues.
const HASHES = {
  Session: '90099b81ad518ce4ed694c4d9d30a129e039bc1638fcdc14c6ad19c081296711',
  UpdateSession: '2c73fd2a4fc4260e716f19db45224a9842feb802cc8e540144d184251acea5cb',
  MunicipalitySearch: '73c842a1e4ad22aad2232eae9dc6d4ddbfb504a813085307c6fa95513607b286',
};

// Profil standard du brief : Lausanne d'abord, puis les cinq autres localités.
const LOCALITIES = [
  { zip: '1003', city: 'Lausanne' },
  { zip: '1204', city: 'Genève' },
  { zip: '1950', city: 'Sion' },
  { zip: '2000', city: 'Neuchâtel' },
  { zip: '1700', city: 'Fribourg' },
  { zip: '2800', city: 'Delémont' },
];

// Critères tarifaires dont on relève aussi les valeurs non par défaut (franchise hospitalière, somme de l'indemnité).
const OPTION_CRITERIA = new Set(['franchise', 'insuranceSumIndemnityValues']);
const SUM_CRITERIA = /^insuranceSum/;
const HOSPITAL_GROUP = 'PRD_SV';
const PREFERRED_SELECTION = 'PRD_SV_HPS_V001';

function args() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const chf = (cents) => (cents / 100).toFixed(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const a = args();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(a.out || path.join(here, '..', 'axa.csv'));
  const [yFrom, yTo] = (a.years || '1947-2026').split('-').map(Number);
  const wanted = a.localities ? String(a.localities).split(',') : LOCALITIES.map((l) => l.zip);
  const localities = wanted.map((z) => LOCALITIES.find((l) => l.zip === z) || { zip: z, city: null });
  const optionMode = a.options || 'first';
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const raw = a.raw ? fs.createWriteStream(path.resolve(a.raw), { flags: 'a' }) : null;

  const out = fs.createWriteStream(outPath, { flags: a.append ? 'a' : 'w' });
  if (!a.append) out.write(HEADER + '\n');

  const browser = await chromium.launch();
  const stats = { calls: 0, rows: 0, refused: {}, empty: {}, errors: [] };
  try {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    page.on('request', (req) => {
      if (!req.url().endsWith(GRAPHQL_PATH) || req.method() !== 'POST') return;
      try {
        const p = JSON.parse(req.postData());
        const h = p.extensions && p.extensions.persistedQuery && p.extensions.persistedQuery.sha256Hash;
        if (h && p.operationName in HASHES && HASHES[p.operationName] !== h) {
          console.error(`[axa] empreinte ${p.operationName} mise à jour depuis la page`);
          HASHES[p.operationName] = h;
        }
      } catch { /* corps non JSON : ignoré */ }
    });

    await page.goto(CALCULATOR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#residence', { timeout: 30000 });
    await page.waitForTimeout(3000);
    // Une saisie dans le champ NPA fait émettre MunicipalitySearch par la page (empreinte à jour).
    await page.fill('#residence', '1003');
    await page.waitForTimeout(2500);

    let last = 0;
    const gql = async (operationName, variables) => {
      const wait = MIN_DELAY_MS - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      const body = {
        operationName,
        variables,
        extensions: { clientLibrary: { name: '@apollo/client', version: '4.3.3' }, persistedQuery: { version: 1, sha256Hash: HASHES[operationName] } },
      };
      const res = await page.evaluate(async ({ url, body }) => {
        const r = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', accept: 'application/graphql-response+json,application/json;q=0.9' },
          body: JSON.stringify(body),
        });
        return { status: r.status, text: await r.text() };
      }, { url: GRAPHQL_PATH, body });
      last = Date.now();
      stats.calls += 1;
      let json = null;
      try { json = JSON.parse(res.text); } catch { /* HTML (blocage, captcha) */ }
      if (res.status !== 200 || !json) {
        throw new Error(`Réponse inattendue (${operationName}) HTTP ${res.status} : ${res.text.slice(0, 200)}`);
      }
      return json;
    };

    let session = (await gql('Session', { language: 'FR' })).data.dsnSession;

    const resolveLocality = async (loc) => {
      const list = (await gql('MunicipalitySearch', { searchString: loc.zip })).data.municipalityByCityNameOrZip
        .filter((m) => m.zipCode === loc.zip);
      const pick = list.find((m) => m.municipalityName === m.cityName && (!loc.city || m.cityName === loc.city))
        || list.find((m) => !loc.city || m.cityName === loc.city) || list[0];
      if (!pick) throw new Error(`Localité introuvable : ${loc.zip}`);
      return pick;
    };

    // Un appel UpdateSession = une personne seule, avec sélection et configuration de produits.
    const quote = async (muni, profileUuid, birthYear, gender, selected, configurations) => {
      const profile = {
        uuid: profileUuid,
        gender,
        birthDate: `${birthYear}-06-15T00:00:00.000Z`,
        contractBeginDate: CONTRACT_BEGIN,
        firstName: 'Personne 1',
        profileType: 'ADULT', // le serveur recalcule ADULT/CHILD d'après la date de naissance
      };
      if (selected) profile.selectedProducts = [selected];
      if (configurations) profile.productConfigurations = configurations;
      const json = await gql('UpdateSession', {
        step: 'HOUSEHOLD',
        language: 'FR',
        session: {
          uuid: session.uuid,
          dateCreated: session.dateCreated,
          dateUpdated: session.dateUpdated,
          isESignature: true,
          uiLanguage: 'FR',
          lastVisitedUiRoute: '',
          profiles: [profile],
          residence: { bfsNo: muni.bfsNo, zipOrderNo: muni.zipOrderNo },
          distributionPartner: { extId: 'CP-DIRECT-SALE' },
          userAcceptedTracking: false,
        },
      });
      if (raw) raw.write(JSON.stringify({ zip: muni.zipCode, birthYear, gender, selected, configurations, json }) + '\n');
      if (json.data && json.data.updateDsnSession) {
        session = json.data.updateDsnSession;
        return { session };
      }
      const text = JSON.stringify(json.errors || json);
      const code = (/([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+)/.exec(text) || [])[1] || text.slice(0, 200);
      return { error: code };
    };

    const defaultConfig = (product) => ({
      internalName: product.internalName,
      productCriterias: product.productCriterias.map((c) => ({ internalName: c.internalName, value: c.selectedValue.internalName })),
    });

    const emit = (muni, birthYear, sex, product, optionLabel, extraNotes) => {
      if (!product.price || typeof product.price.priceInCents !== 'number') return;
      const acc = product.productCriterias.find((c) => c.type === 'accidentalCoverage');
      const notes = [`internal=${product.internalName}`, `tariff_id=${product.price.id}`];
      const sums = product.productCriterias.filter((c) => SUM_CRITERIA.test(c.type));
      if (sums.length && !optionLabel) notes.push('default_option: ' + sums.map((c) => `${c.name} CHF ${c.selectedValue.value}`).join(' / '));
      const franchise = product.productCriterias.find((c) => c.type === 'franchise');
      if (franchise && !optionLabel) notes.push(`default_option: ${franchise.name} CHF ${franchise.selectedValue.value}`);
      if (product.discountRules && product.discountRules.length) notes.push('discounts_included=' + product.discountRules.join('+'));
      for (const f of product.futureProductsWithPrices || []) {
        for (const p of f.prices || []) notes.push(`price_from_${String(p.validAt).slice(0, 10)}=${chf(p.priceInCents)}`);
      }
      notes.push(...extraNotes);
      const row = [
        'AXA', '', product.name, product.description ? product.description.name : '', optionLabel, YEAR, birthYear, YEAR - birthYear, sex,
        muni.zipCode, muni.cityName, acc ? String(acc.selectedValue.value) : '', chf(product.price.priceInCents),
        'official_calculator', CALCULATOR_URL, retrievedAt, notes.join('; '),
      ];
      out.write(row.map(csvCell).join(',') + '\n');
      stats.rows += 1;
    };

    for (let li = 0; li < localities.length; li += 1) {
      const muni = await resolveLocality(localities[li]);
      const withOptions = optionMode === 'all' || (optionMode === 'first' && li === 0);
      console.error(`[axa] ${muni.zipCode} ${muni.cityName} (commune ${muni.municipalityName}, OFS ${muni.bfsNo}, ${muni.canton}) options=${withOptions}`);
      let refusedStreak = 0;
      // Du plus jeune au plus âgé : hors première localité, on arrête après deux années refusées de suite.
      for (let by = yTo; by >= yFrom; by -= 1) {
        let refusedThisYear = 0;
        for (const [sex, gender] of [['f', 'FEMALE'], ['m', 'MALE']]) {
          const uuid = crypto.randomUUID();
          const key = `${muni.zipCode}/${by}/${sex}`;
          // Appel 1 : variante par défaut, un produit d'hospitalisation au panier (condition d'affichage de l'indemnité d'hospitalisation).
          let selected = PREFERRED_SELECTION;
          let r = await quote(muni, uuid, by, gender, selected, null);
          if (r.error) {
            stats.refused[key] = r.error;
            refusedThisYear += 1;
            console.error(`[axa] ${key} refusé : ${r.error}`);
            continue;
          }
          let products = r.session.profiles[0].productsNew || [];
          if (products.length && !products.some((p) => p.internalName === selected)) {
            const alt = products.find((p) => p.groupId === HOSPITAL_GROUP);
            selected = alt ? alt.internalName : null;
            if (alt) {
              r = await quote(muni, uuid, by, gender, selected, null);
              if (r.error) { stats.errors.push(`${key}: ${r.error}`); continue; }
              products = r.session.profiles[0].productsNew || [];
            }
          }
          if (!products.length) {
            stats.empty[key] = 'aucun produit proposé';
            console.error(`[axa] ${key} : aucun produit proposé`);
            continue;
          }
          const depNote = (p) => (p.groupId !== HOSPITAL_GROUP && /SPG/.test(p.internalName) && selected
            ? [`requires_hospital_product (in basket: ${selected})`] : []);
          for (const p of products) emit(muni, by, sex, p, '', depNote(p));

          if (!withOptions) continue;
          // Appels suivants : k-ième valeur non par défaut de chaque critère d'option (franchise, somme d'indemnité).
          const optionProducts = products
            .map((p) => ({ p, crit: p.productCriterias.filter((c) => OPTION_CRITERIA.has(c.type)) }))
            .filter((x) => x.crit.length);
          const alternatives = (c) => c.possibleValues.filter((v) => v.internalName !== c.selectedValue.internalName);
          const rounds = Math.max(0, ...optionProducts.flatMap((x) => x.crit.map((c) => alternatives(c).length)));
          for (let k = 0; k < rounds; k += 1) {
            const configurations = [];
            const expect = [];
            for (const { p, crit } of optionProducts) {
              const cfg = defaultConfig(p);
              const labels = [];
              for (const c of crit) {
                const v = alternatives(c)[k];
                if (!v) continue;
                cfg.productCriterias.find((x) => x.internalName === c.internalName).value = v.internalName;
                labels.push({ c: c.internalName, v: v.internalName, label: `${c.name}: CHF ${v.value}` });
              }
              if (labels.length) { configurations.push(cfg); expect.push({ internalName: p.internalName, labels }); }
            }
            if (!configurations.length) break;
            const selCfg = configurations.find((c) => c.internalName === selected);
            if (!selCfg) configurations.push(defaultConfig(products.find((p) => p.internalName === selected)));
            const ro = await quote(muni, uuid, by, gender, selected, configurations);
            if (ro.error) { stats.errors.push(`${key} options ${k}: ${ro.error}`); continue; }
            for (const e of expect) {
              const p = (ro.session.profiles[0].productsNew || []).find((x) => x.internalName === e.internalName);
              if (!p) continue;
              // N'écrire que si le serveur a bien appliqué la valeur demandée.
              const applied = e.labels.every((l) => {
                const c = p.productCriterias.find((x) => x.internalName === l.c);
                return c && c.selectedValue && c.selectedValue.internalName === l.v;
              });
              if (!applied) { stats.errors.push(`${key} ${e.internalName}: option non appliquée`); continue; }
              emit(muni, by, sex, p, e.labels.map((l) => l.label).join(' / '), depNote(p));
            }
          }
        }
        if (stats.errors.length > 10) throw new Error('Trop d\'erreurs, arrêt : ' + stats.errors.slice(-3).join(' | '));
        refusedStreak = refusedThisYear === 2 ? refusedStreak + 1 : 0;
        if (li > 0 && refusedStreak >= 2) {
          console.error(`[axa] ${muni.zipCode} : arrêt après ${by} (deux années de naissance refusées de suite ; limite d'âge indépendante de la localité)`);
          break;
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise((r) => out.end(r));
    if (raw) await new Promise((r) => raw.end(r));
    console.error(JSON.stringify({ out: outPath, calls: stats.calls, rows: stats.rows, refused: Object.keys(stats.refused).length, empty: stats.empty, errors: stats.errors }, null, 1));
  }
}

main().catch((e) => { console.error('[axa] ARRÊT :', e.message); process.exitCode = 1; });
