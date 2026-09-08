import { expect, it } from "vitest";
import {
  profileCompletionAverage,
  profileStepCompletion,
} from "@coverview/contracts";

it("weights the displayed steps equally rather than weighting each field equally", () => {
  const steps = profileStepCompletion(
    "person",
    "health",
    { insurer: "Institution", primaryDoctorName: "Médecin", allergies: "Aucune" },
  );
  expect(steps).toEqual({ information: 33, details: 29 });
  expect(profileCompletionAverage(steps)).toBe(31);
  expect(profileCompletionAverage({ information: 100, details: 0 })).toBe(50);
  expect(profileCompletionAverage({ information: 100, details: 100 })).toBe(100);
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
    ),
  ).toEqual({ information: 25, details: 0 });
  expect(
    profileStepCompletion("legal_entity", "general", { registrationNumber: "CHE-1" }),
  ).toEqual({ information: 25, details: 0 });
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
    ),
  ).toEqual({ information: 67, details: 50 });
});
