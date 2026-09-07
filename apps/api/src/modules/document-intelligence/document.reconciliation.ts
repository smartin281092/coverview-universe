import { profileFieldSchema, type DocumentAnalysis, type Profile } from "@coverview/contracts";

export const sameProfileValue = (left: string, right: string) =>
  left.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr") ===
  right.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");

export function documentProfileComparisons(analysis: DocumentAnalysis | null, profile: Profile) {
  return (analysis?.fields ?? []).flatMap((extraction) => {
    const field = profileFieldSchema.safeParse(extraction.field);
    const current = field.success ? profile.fields[field.data] : undefined;
    return current
      ? [
          {
            extractionId: extraction.id,
            currentValue: current.value,
            different: !sameProfileValue(current.value, extraction.value),
          },
        ]
      : [];
  });
}
