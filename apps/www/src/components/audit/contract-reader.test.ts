import { describe, expect, it } from "vitest";
import { readContractText } from "./contract-reader";

describe("lecture d’un texte de contrat", () => {
  it("repère le prestataire, le versement mensuel, le début et la naissance", () => {
    const text = `Police d'assurance-vie liée au pilier 3a
      Liechtenstein Life Assurance AG · Preneur d'assurance : Jeanne Exemple, née le 12.03.1988
      Début du contrat : 01.05.2019   Échéance : 01.05.2053
      Prime mensuelle : CHF 350.00   Prime annuelle : CHF 4'200.00`;
    const reading = readContractText(text);
    expect(reading.provider).toBe("liechtenstein-life");
    expect(reading.monthly).toBe(350);
    expect(reading.startYear).toBe(2019);
    expect(reading.birthYear).toBe(1988);
  });
  it("ramène une prime annuelle au mois et accepte les formats suisses", () => {
    const reading = readContractText(
      "Versement annuel 7’258 CHF · Vertragsbeginn 15.01.2021 · AXA Vie SA",
    );
    expect(reading.monthly).toBe(605);
    expect(reading.startYear).toBe(2021);
    expect(reading.provider).toBe("axa");
  });
  it("ignore les montants sans période et les années hors bornes", () => {
    const reading = readContractText(
      "Capital garanti CHF 120'000 · Début : 01.01.1975 · Banque exemple",
    );
    expect(reading.monthly).toBeUndefined();
    expect(reading.startYear).toBeUndefined();
    expect(reading.provider).toBeUndefined();
  });
  it("retient le prestataire le plus cité", () => {
    const text = "Helvetia Assurances SA — Helvetia Global Passive — transfert depuis UBS";
    expect(readContractText(text).provider).toBe("helvetia");
  });
});
