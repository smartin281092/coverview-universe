import { describe, expect, it } from "vitest";
import {
  contractYearsElapsed,
  decodeAnswers,
  emptyAnswers,
  encodeAnswers,
  isComplete,
  ownSolution,
  resolveStrategyId,
  yearsToRetirement,
  type Answers,
} from "./audit-state";
import { INSURANCE_REDUCTION } from "./strategies";

const filled = (): Answers => ({
  ...emptyAnswers(),
  has: true,
  provider: "viac",
  monthly: 300,
  startYear: 2019,
  capital: null,
  income: 6000,
  birthYear: 1990,
  compare: ["prosperity", "finpension-global-100"],
});

describe("état de l’audit dans l’URL", () => {
  it("fait l’aller-retour des réponses et n’écrit pas les hypothèses par défaut", () => {
    const answers = filled();
    const params = encodeAnswers(answers);
    expect(params.has("ra")).toBe(false);
    expect(params.get("cmp")).toBe("prosperity,finpension-global-100");
    expect(decodeAnswers(new URLSearchParams(params.toString()))).toEqual(answers);
  });
  it("conserve des hypothèses modifiées et ignore les valeurs hors bornes", () => {
    const answers = { ...filled(), retirementAge: 62, inflation: 0.02, replacement: 0.7 };
    const decoded = decodeAnswers(encodeAnswers(answers));
    expect(decoded.retirementAge).toBe(62);
    expect(decoded.inflation).toBe(0.02);
    expect(decoded.replacement).toBe(0.7);
    const bad = decodeAnswers(
      new URLSearchParams("m=-5&b=1900&p=unknown&s=nope&cmp=prosperity,ghost"),
    );
    expect(bad.monthly).toBeNull();
    expect(bad.birthYear).toBeNull();
    expect(bad.provider).toBeNull();
    expect(bad.strategy).toBeNull();
    expect(bad.compare).toEqual(["prosperity"]);
  });
});

describe("solution de la personne", () => {
  it("prend la stratégie de référence du prestataire", () => {
    const own = ownSolution(filled());
    expect(resolveStrategyId(filled())).toBe("viac-global-100");
    expect(own?.kind).toBe("bank");
    expect(own?.profile).toBeNull();
    expect(isComplete(filled())).toBe(true);
  });
  it("emprunte une série pour un profil et garde le type du prestataire", () => {
    const answers: Answers = { ...filled(), provider: "pax", profile: "balanced" };
    const own = ownSolution(answers);
    expect(own?.strategyId).toBe("baloise-bvg-mix-40-r");
    expect(own?.kind).toBe("insurance");
    expect(own?.reduction).toEqual(INSURANCE_REDUCTION);
    expect(own?.provider).toBe("Pax");
    expect(own?.profile).toBe("balanced");
  });
  it("reconnaît Hyperion chez Liechtenstein Life", () => {
    const own = ownSolution({ ...filled(), provider: "liechtenstein-life", profile: "hyperion" });
    expect(own?.strategyId).toBe("prosperity");
    expect(own?.coverview).toBe(true);
    expect(own?.reduction).toEqual([0.67, 0.67, 0.67, 0.67, 0.67]);
  });
  it("sans 3e pilier, part d’un compte rémunéré et n’exige ni prestataire ni année de début", () => {
    const answers: Answers = {
      ...emptyAnswers(),
      has: false,
      monthly: 400,
      income: 5000,
      birthYear: 1995,
    };
    expect(isComplete(answers)).toBe(true);
    expect(ownSolution(answers)?.strategyId).toBe("compte-3a");
    expect(contractYearsElapsed(answers)).toBe(0);
  });
  it("attend un prestataire ou un profil résolu", () => {
    expect(isComplete({ ...filled(), provider: "pax", profile: null })).toBe(false);
    expect(isComplete({ ...filled(), provider: "pax", profile: "unknown" })).toBe(true);
  });
  it("compte les années de contrat et les années avant la retraite", () => {
    expect(contractYearsElapsed(filled())).toBe(8);
    expect(yearsToRetirement(filled())).toBe(29);
  });
});
