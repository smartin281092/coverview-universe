import { expect, it } from "vitest";
import {
  isProfileConfirmed,
  profileCompletionAverage,
  profileSchema,
  profileStepCompletion,
} from "@coverview/contracts";

it("weights the displayed steps equally rather than weighting each field equally", () => {
  const steps = profileStepCompletion(
    "person",
    "health",
    { insurer: "Institution", primaryDoctorName: "Médecin", allergies: "Aucune" },
    true,
  );
  expect(steps).toEqual({ information: 33, details: 29, review: 100 });
  expect(profileCompletionAverage(steps)).toBe(54);
  expect(profileCompletionAverage({ information: 100, details: 0, review: 0 })).toBe(33);
  expect(profileCompletionAverage({ information: 100, details: 100, review: 100 })).toBe(100);
});

it("counts the visible optional fields and zero amounts while ignoring empty controls", () => {
  expect(
    profileStepCompletion(
      "person",
      "general",
      {
        firstName: " ",
        lastName: null,
        birthDate: undefined,
        avsNumber: "756.0000.0000.02",
        occupation: "Profession",
      },
      false,
    ),
  ).toEqual({ information: 25, details: 0, review: 0 });
  expect(
    profileStepCompletion("legal_entity", "general", { registrationNumber: "CHE-1" }, false),
  ).toEqual({ information: 25, details: 0, review: 0 });
  expect(
    profileStepCompletion(
      "person",
      "finances",
      {
        annualIncomeMinor: 0,
        monthlyExpensesMinor: " ",
        currency: "CHF",
        savingsMinor: "0",
        debtsMinor: null,
      },
      false,
    ),
  ).toEqual({ information: 67, details: 50, review: 0 });
});

it("treats explicit confirmation independently from the optional prefill choice", () => {
  const profile = profileSchema.parse({
    id: "profile_test",
    userId: "user_test",
    revision: 1,
    step: "review",
    fields: {},
    prefill: { enabled: false, version: "1", decidedAt: "2026-09-08T10:00:00.000Z" },
  });
  expect(isProfileConfirmed(profile)).toBe(true);
  expect(profileCompletionAverage(profileStepCompletion("person", "general", {}, true))).toBe(33);
  expect(isProfileConfirmed({ ...profile, prefill: { ...profile.prefill, decidedAt: null } })).toBe(
    false,
  );
  expect(
    isProfileConfirmed({
      ...profile,
      fields: {
        firstName: {
          value: "Nom",
          source: "user_entered",
          confidence: null,
          confirmedAt: null,
          proposal: null,
        },
      },
    }),
  ).toBe(false);
});
