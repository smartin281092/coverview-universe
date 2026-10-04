// Read-only verification against the running API and its real imported PostgreSQL snapshot.
// The fixed amounts below were independently checked against the official CSV by the source audit.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const origin = process.env.HEALTH_API_URL ?? "http://127.0.0.1:4100";
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname));
let assertions = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  assertions++;
};
async function request(path, body, expected = 200) {
  const response = await fetch(
    `${origin}/health-insurance/${path}`,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        }
      : { signal: AbortSignal.timeout(15000) },
  );
  assert.equal(response.status, expected, path);
  return response.json();
}
const base = { birthYear: 1990, accident: false, deductible: 2500, regionId: "VD-1" };
const status = await request("status");
ok(
  status.available &&
    status.premiumCount === 219916 &&
    status.modelCount === 153 &&
    status.insurerCount === 32,
  "active snapshot counts",
);
ok(
  status.regions.length === 42 && status.regions.every((x) => !["ZE", "ZR"].includes(x.canton)),
  "42 Swiss regions",
);
const vd = await request("compare", base);
assert.deepEqual(
  vd.offers.slice(0, 3).map((x) => x.monthlyPremiumMinor),
  [42700, 42805, 43020],
);
assertions++;
const ge = await request("compare", { ...base, regionId: "GE-0" });
assert.deepEqual(
  ge.offers.slice(0, 3).map((x) => x.monthlyPremiumMinor),
  [44960, 46560, 46620],
);
assertions++;
const next = await request("compare", { ...base, offset: 15 });
ok(
  next.total === vd.total && !next.offers.some((a) => vd.offers.some((b) => a.id === b.id)),
  "pagination neither overlaps nor changes totals",
);
ok(
  next.offers[0].monthlyPremiumMinor >= vd.offers.at(-1).monthlyPremiumMinor,
  "stable price ordering",
);
const included = await request("compare", { ...base, accident: true });
ok(
  included.offers.every((x) => x.accident) &&
    included.offers[0].monthlyPremiumMinor > vd.offers[0].monthlyPremiumMinor,
  "accident coverage changes real premiums",
);
const locality = await request("localities?q=1003");
const lausanne = locality.items.find((x) => x.municipality === "Lausanne");
ok(lausanne?.regionId === "VD-1", "Lausanne exact NPA region");
const ambiguous = await request("localities?q=3053");
ok(
  new Set(ambiguous.items.map((x) => x.municipalityId)).size > 1,
  "ambiguous postcode preserves municipality choice",
);
for (const [birthYear, ageGroup] of [
  [2009, "child"],
  [2008, "young_adult"],
  [2002, "young_adult"],
  [2001, "adult"],
]) {
  const result = await request("compare", {
    ...base,
    birthYear,
    deductible: birthYear === 2009 ? 0 : 300,
  });
  ok(
    result.ageGroup === ageGroup &&
      result.offers.length > 0 &&
      result.offers.every((x) => x.ageGroup === ageGroup),
    `age boundary ${birthYear}`,
  );
}
await request("compare", { ...base, birthYear: 2015 }, 400);
await request("compare", { ...base, municipalityId: 301 }, 400);
await request("compare", { ...base, regionId: "ZE-0" }, 400);
const be = await request("compare", { ...base, regionId: "BE-2" });
const meikirch = await request("compare", { ...base, regionId: "BE-2", municipalityId: 307 });
const aarberg = await request("compare", { ...base, regionId: "BE-2", municipalityId: 301 });
ok(
  be.offers[0].name === "Plan de santé VIVA" &&
    be.offers[0].monthlyPremiumMinor === 37030 &&
    be.offers[0].eligibility === "municipality_required",
  "restricted VIVA signals missing municipality",
);
ok(
  meikirch.offers[0].name === "Plan de santé VIVA" &&
    meikirch.offers[0].eligibility === "municipality_confirmed",
  "eligible Meikirch includes VIVA",
);
ok(
  !aarberg.offers.some((x) => x.modelId === be.offers[0].modelId),
  "ineligible Aarberg excludes VIVA",
);
const benefit = await request("compare", { ...base, benefitKeys: ["breast_screening_free"] });
const source = await request(`models/${vd.offers[0].modelId}`);
ok(
  source.benefits.every(
    (x) =>
      x.sourceUrl.startsWith("https://") &&
      x.verifiedAt &&
      (x.value === null || typeof x.value === "boolean"),
  ),
  "benefits carry a source and tri-state fact",
);
ok(
  benefit.offers.length > 0 && benefit.offers.every((x) => x.name === "TelMed Plus"),
  "confirmed breast screening filter selects only the sourced model",
);
const screened = await request(`models/${benefit.offers[0].modelId}`);
const deductibleWaiver = await request("compare", {
  ...base,
  benefitKeys: ["breast_screening_deductible_waiver"],
});
ok(
  deductibleWaiver.offers.some((x) => x.modelId === benefit.offers[0].modelId),
  "full screening exemption also meets the deductible waiver filter",
);
ok(
  screened.benefits.some(
    (x) =>
      x.key === "breast_screening_free" &&
      x.value === true &&
      x.yearConfirmed &&
      x.requiresSupplementary === false,
  ),
  "filter fact is explicitly confirmed for 2027",
);
const unknown = await request("compare", { ...base, benefitKeys: ["generic_deductible_waiver"] });
ok(unknown.total === 0, "unconfirmed future benefits are not promoted to verified filters");
const guideInput = {
  ...base,
  municipalityId: lausanne.municipalityId,
  annualCareMinor: 1000000,
  reserveMinor: 320000,
  preferredAccess: "any",
  answers: {
    doctor: "keep",
    treatment: "planned",
    medication: "generics",
    household: "maternity",
    subsidy: "review",
  },
};
const annual = await request("guide", { ...guideInput, objective: "annual" });
const premium = await request("guide", { ...guideInput, objective: "premium" });
ok(
  annual.scenarios.length === 6 && annual.bestDeductible === 300 && premium.bestDeductible === 2500,
  "objective changes optimum for high care expenditure",
);
ok(
  annual.guidance.includes("doctor_network") &&
    annual.guidance.includes("maternity") &&
    annual.guidance.includes("subsidy"),
  "answers drive guidance",
);
const short = await request("guide", { ...guideInput, reserveMinor: 50000 });
ok(
  short.bestDeductible === null && short.scenarios.every((x) => !x.reserveSufficient),
  "insufficient reserve does not recommend a deductible",
);
const free = await request("guide", { ...guideInput, preferredAccess: "free" });
ok(
  free.scenarios.every((x) => x.offer.category === "BASE"),
  "free access constrains the actual selection",
);
const conflict = await request("guide", {
  ...guideInput,
  preferredAccess: "free",
  categories: ["TEL_DIG"],
});
ok(conflict.scenarios.length === 0, "contradictory filters are not silently discarded");
// Independent oracle: parse the official CSV, not the normalized import.
const [csvHeader, ...csvRows] = readFileSync(
  new URL("../data/health-insurance/2027/premiums-eu.csv", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split(","));
const official = csvRows.map((cells) =>
  Object.fromEntries(csvHeader.map((key, i) => [key, cells[i]])),
);
ok(
  status.foreign?.premiumCount === 2230 &&
    status.foreign.insurerCount === 14 &&
    status.foreign.countries.length === 30,
  "foreign snapshot counts",
);
for (const [birthYear, age] of [
  [1990, "E1"],
  [2005, "J1"],
  [2020, "K1"],
]) {
  for (const accident of [false, true]) {
    const result = await request("compare", {
      birthYear,
      accident,
      deductible: age === "K1" ? 0 : 300,
      regionId: "EU-FR",
    });
    ok(
      result.regions.some((r) => r.regionId === "VD-1") &&
        result.regions.some((r) => r.regionId === "FR-1"),
      "Swiss regions remain available while a foreign country is selected",
    );
    for (const country of status.foreign.countries) {
      const expected = official
        .filter(
          (r) =>
            r.Land === country.code &&
            r.Altersuntergruppe === age &&
            r.Unfalleinschluss === (accident ? "MIT_UNF" : "OHN_UNF"),
        )
        .map((r) => ({ id: Number(r.Versicherer), amount: Math.round(Number(r["Prämie"]) * 100) }))
        .sort((a, b) => a.amount - b.amount || a.id - b.id);
      const actual = result.regions.find((r) => r.regionId === `EU-${country.code}`)?.offers ?? [];
      assert.deepEqual(
        actual.map((r) => ({ id: r.insurerId, amount: r.monthlyPremiumMinor })),
        expected.slice(0, 3),
        `${country.code}/${age}/${accident}`,
      );
      assertions++;
    }
    const france = official
      .filter(
        (r) =>
          r.Land === "FR" &&
          r.Altersuntergruppe === age &&
          r.Unfalleinschluss === (accident ? "MIT_UNF" : "OHN_UNF"),
      )
      .map((r) => Math.round(Number(r["Prämie"]) * 100))
      .sort((a, b) => a - b);
    assert.deepEqual(
      result.offers.map((o) => o.monthlyPremiumMinor),
      france,
    );
    assertions++;
  }
}
await request(
  "compare",
  { birthYear: 1990, accident: false, deductible: 2500, regionId: "EU-FR" },
  422,
);
assertions++;
const located = await request("locate", { latitude: 46.5197, longitude: 6.6323, accuracy: 20 });
ok(
  located.regionId === "VD-1" && located.items.some((x) => x.municipalityId === 5586),
  "local location lookup",
);
const locatedFrance = await request("locate", { latitude: 46.195, longitude: 6.236, accuracy: 20 });
ok(
  locatedFrance.items[0]?.country === "FR" && locatedFrance.items[0]?.municipalityId === null,
  "France is not a Swiss municipality",
);
console.log(
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      assertions,
      premiums: status.premiumCount,
      regions: status.regions.length,
      annualBest: annual.bestDeductible,
      premiumBest: premium.bestDeductible,
    },
    null,
    2,
  ),
);
