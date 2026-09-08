import type {
  ManagedProfile,
  ProfileSectionName,
  ProfileSectionValues,
} from "./managed-profiles.js";

type Field = keyof ProfileSectionValues;
type StepCompletion = Readonly<{ information: number; contact?: number; details: number }>;

// Shared presentation groups keep the section score aligned with its visible step indicators.
export function profileStepFields(
  kind: ManagedProfile["kind"],
  section: ProfileSectionName,
): { information: readonly Field[]; contact?: readonly Field[]; details: readonly Field[] } {
  if (section === "finances")
    return {
      information: ["annualIncomeMinor", "monthlyExpensesMinor", "currency"],
      details: ["savingsMinor", "debtsMinor"],
    };
  if (section === "health")
    return {
      information: ["insurer", "deductibleMinor", "accidentCoverage"],
      details: [
        "primaryDoctorName",
        "heightCm",
        "weightKg",
        "smokingStatus",
        "allergies",
        "chronicConditions",
        "ongoingTreatments",
      ],
    };
  return {
    information:
      kind === "legal_entity"
        ? ["companyName", "registrationNumber"]
        : [
            "firstName",
            "lastName",
            "birthDate",
            "nationality",
            "avsNumber",
            "occupation",
          ],
    contact: ["phone", "contactEmail"],
    details: ["street", "postalCode", "city", "country"],
  };
}

export function profileStepCompletion(
  kind: ManagedProfile["kind"],
  section: ProfileSectionName,
  values: Readonly<Partial<Record<Field, unknown>>>,
): StepCompletion {
  const fields = profileStepFields(kind, section);
  const percent = (keys: readonly Field[]) => {
    const filled = keys.filter((key) => {
      const value = values[key];
      return typeof value === "string"
        ? value.trim().length > 0
        : value !== undefined && value !== null;
    }).length;
    return keys.length ? Math.round((filled / keys.length) * 100) : 0;
  };
  return {
    information: percent(fields.information),
    ...(fields.contact ? { contact: percent(fields.contact) } : {}),
    details: percent(fields.details),
  };
}

export function profileCompletionAverage(steps: StepCompletion): number {
  const percentages = [steps.information, steps.details];
  if (steps.contact !== undefined) percentages.push(steps.contact);
  return Math.round(percentages.reduce((sum, percent) => sum + percent, 0) / percentages.length);
}
