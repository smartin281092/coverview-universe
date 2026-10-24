import { describe, expect, it } from "vitest";
import { healthOfferSchema } from "@coverview/contracts/health-insurance";
import { healthOfferPresentation } from "./health.presentation.js";

const offer = healthOfferSchema.parse({
  id: "offer",
  modelId: "model",
  insurerId: 8,
  insurerName: "Test",
  name: "Test",
  category: "FLEX",
  regionId: "VD-1",
  monthlyPremiumMinor: 40000,
  deductible: 2500,
  accident: true,
  ageGroup: "adult",
  restricted: false,
  eligibility: "region",
});
const model = {
  id: "model",
  year: 2027,
  access: {
    contacts: ["gp", "phone"] as ("gp" | "phone")[],
    verifiedYear: true,
    ageScope: "all" as const,
  },
};
describe("offer presentation keeps year and eligibility explicit", () => {
  it("reports the documented 2027 environmental credit separately from the gross premium", () => {
    expect(healthOfferPresentation(offer, 2027).redistribution).toMatchObject({
      year: 2027,
      monthlyMinor: 475,
      annualMinor: 5700,
    });
    expect(offer.monthlyPremiumMinor).toBe(40000);
  });
  it("does not carry the amount to another tariff year", () => {
    expect(healthOfferPresentation(offer, 2028).redistribution).toBeNull();
  });
  it("excludes foreign residence and cross-border regions", () => {
    expect(
      healthOfferPresentation({ ...offer, residenceCountry: "FR" }, 2027).redistribution,
    ).toBeNull();
    expect(
      healthOfferPresentation({ ...offer, regionId: "EU-FR" }, 2027).redistribution,
    ).toBeNull();
  });
  it("marks every model of a partner insurer, and only those", () => {
    expect(healthOfferPresentation({ ...offer, insurerId: 1542 }, 2027).partner).toBe(true);
    expect(healthOfferPresentation({ ...offer, insurerId: 343 }, 2027).partner).toBe(true);
    expect(healthOfferPresentation(offer, 2027).partner).toBe(false);
  });
  it("returns all documented first contacts, without interpreting multiple accepted contacts as obligations", () => {
    expect(healthOfferPresentation(offer, 2027, model)).toMatchObject({
      firstContacts: ["gp", "phone"],
      contactsVerified: true,
    });
  });
  it("never promotes an unknown, expired or adult-only condition to a confirmed child pathway", () => {
    for (const value of [
      undefined,
      { ...model, year: 2026 },
      { ...model, access: { ...model.access, ageScope: "adult" as const } },
    ]) {
      expect(healthOfferPresentation({ ...offer, ageGroup: "child" }, 2027, value)).toMatchObject({
        firstContacts: [],
        contactsVerified: false,
      });
    }
  });
  it("shows the contacts documented by the insurer without confirming them for the year", () => {
    expect(
      healthOfferPresentation(offer, 2027, {
        ...model,
        access: { ...model.access, verifiedYear: false },
      }),
    ).toMatchObject({ firstContacts: ["gp", "phone"], contactsVerified: false });
  });
});
