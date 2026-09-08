import { z } from "zod";
import {
  profileFieldSchema,
  profileValuesSchema,
  type Profile,
  type ProfileDraft,
  type ProfileSaveInput,
} from "@coverview/contracts";

export type ProfileFieldName = (typeof profileFieldSchema.options)[number];
export const informationFields = [
  "firstName",
  "lastName",
  "birthDate",
  "nationality",
  "avsNumber",
  "occupation",
  "phone",
  "contactEmail",
] as const;
export const addressFields = ["street", "postalCode", "city", "country"] as const;
export const allFields = profileFieldSchema.options;
// Empty controls are presentation state; the public schema remains the validation authority.
export const profileFormSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    birthDate: z.string(),
    nationality: z.string(),
    avsNumber: z.string(),
    occupation: z.string(),
    street: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
    phone: z.string(),
    contactEmail: z.string(),
  })
  .superRefine((values, context) => {
    const result = profileValuesSchema.safeParse(
      Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== "")),
    );
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: "invalid" });
  });
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function profileValues(record: Profile | ProfileDraft | null): ProfileFormValues {
  return Object.fromEntries(
    allFields.map((field) => {
      const value = record?.fields[field];
      return [field, typeof value === "string" ? value : (value?.value ?? "")];
    }),
  ) as ProfileFormValues;
}

export function profilePatch(
  values: ProfileFormValues,
  saved: ProfileFormValues,
  explicit: ReadonlySet<ProfileFieldName>,
): ProfileSaveInput["fields"] {
  return Object.fromEntries(
    allFields.flatMap((field) => {
      const next = values[field].trim();
      return next !== saved[field] || explicit.has(field) ? [[field, next || null]] : [];
    }),
  );
}
