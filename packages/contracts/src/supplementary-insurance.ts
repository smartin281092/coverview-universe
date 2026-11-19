import { z } from "zod";

// Public contracts of the supplementary health insurance (LCA) comparator, 19 November 2026.
// The catalogue and premiums come from data/supplementary-insurance/<year>, imported into the
// database; amounts are integers in centimes (DATA-11).

const key = z.string().regex(/^[a-z0-9][a-z0-9:_.-]{0,119}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const minor = z.number().int().min(0).max(100_000_000);
const url = z.string().url().max(600);

export const supplementaryCantons = ["VD", "GE", "FR", "VS", "NE", "JU"] as const;
export const supplementaryCantonSchema = z.enum(supplementaryCantons);
export const supplementarySexSchema = z.enum(["female", "male"]);

export const supplementaryTagSchema = z
  .object({ key: z.string().min(1).max(80), family: key, label: text(160) })
  .strict();
export const supplementaryFamilySchema = z.object({ key, label: text(120) }).strict();
export const supplementaryCategorySchema = z.object({ key, label: text(120) }).strict();
export const supplementaryInsurerSchema = z
  .object({
    key,
    name: text(120),
    // Insurers with a CoverView agreement (health.partner.1): Assura and Groupe Mutuel.
    partner: z.boolean(),
    website: url.nullable(),
    calculatorUrl: url.nullable(),
    // Basic-insurance company id (BAG), used by the site to find the insurer's logo.
    bagInsurerId: z.number().int().positive().nullable(),
  })
  .strict();
export const supplementaryBenefitSchema = z
  .object({
    id: z.string().min(1).max(160),
    // First tag = main tag; tags starting with "other:" have no equivalent in the taxonomy.
    tags: z.array(z.string().min(1).max(80)).min(1).max(8),
    label: text(400),
    variant: z.string().max(120).nullable(),
    coverage: z.string().max(1200),
    ratePercent: z.number().min(0).max(100).nullable(),
    maxAmountMinor: minor.nullable(),
    maxPeriod: z.string().max(40).nullable(),
    unlimited: z.boolean(),
    waitingPeriod: z.string().max(400).nullable(),
    conditions: z.string().max(2000).nullable(),
    sourceUrl: url.nullable(),
  })
  .strict();
export const supplementaryVariantSchema = z
  .object({ key: z.string().min(1).max(120), name: text(200), description: z.string().max(1200) })
  .strict();
export const supplementaryPublishedPriceSchema = z
  .object({
    profile: z.string().max(600),
    monthlyMinor: minor.nullable(),
    year: z.number().int().min(2000).max(2100).nullable(),
    sourceUrl: url.nullable(),
  })
  .strict();
export const supplementaryProductSchema = z
  .object({
    key,
    insurer: key,
    name: text(300),
    category: key,
    audience: z.string().max(40).nullable(),
    summary: z.string().max(2000),
    variants: z.array(supplementaryVariantSchema).max(40),
    prerequisites: z.string().max(2000).nullable(),
    factors: z.array(z.string().max(80)).max(20),
    ageBands: z.string().max(2000).nullable(),
    discounts: z.string().max(3000).nullable(),
    conditionsDoc: z
      .object({ title: z.string().max(400), edition: z.string().max(120), url: url.nullable() })
      .strict()
      .nullable(),
    sourceUrls: z.array(url).max(40),
    // Every tag of the product's benefits, main and secondary, without duplicates.
    tags: z.array(z.string().min(1).max(80)).max(200),
    families: z.array(key).max(20),
    benefits: z.array(supplementaryBenefitSchema).max(400),
    publishedPrices: z.array(supplementaryPublishedPriceSchema).max(60),
    // True when the official calculator gave prices for at least one profile.
    priced: z.boolean(),
  })
  .strict();
export const supplementaryReferenceLocalitySchema = z
  .object({ canton: supplementaryCantonSchema, postalCode: z.string().regex(/^\d{4}$/), locality: text(80) })
  .strict();
export const supplementaryCatalogSchema = z
  .object({
    id: z.string().min(1).max(120),
    year: z.number().int().min(2026).max(2100),
    retrievedAt: z.iso.date(),
    insurers: z.array(supplementaryInsurerSchema).max(60),
    categories: z.array(supplementaryCategorySchema).max(40),
    families: z.array(supplementaryFamilySchema).max(40),
    tags: z.array(supplementaryTagSchema).max(400),
    products: z.array(supplementaryProductSchema).max(600),
    localities: z.array(supplementaryReferenceLocalitySchema).max(26),
  })
  .strict();

// Premiums for one person, read from the official calculators' survey (19 November 2026).
// Without a sex, each price carries the range between the female and male premiums.
export const supplementaryQuoteInputSchema = z
  .object({
    year: z.literal(2027),
    birthYear: z.number().int().min(1900).max(2026),
    sex: supplementarySexSchema.nullable(),
    canton: supplementaryCantonSchema,
  })
  .strict();
export const supplementaryPriceSchema = z
  .object({
    productKey: key,
    // Variant and option exactly as the insurer's calculator names them; empty option = default.
    variant: z.string().max(200),
    option: z.string().max(200),
    accident: z.boolean().nullable(),
    minMinor: minor,
    maxMinor: minor,
    // Remarks of the survey (first year free, discount included…), in French.
    note: z.string().max(400).nullable(),
  })
  .strict()
  .refine((value) => value.minMinor <= value.maxMinor, "min_above_max");
export const supplementaryQuoteSchema = z
  .object({
    year: z.literal(2027),
    birthYear: z.number().int(),
    age: z.number().int().min(0).max(130),
    sex: supplementarySexSchema.nullable(),
    reference: supplementaryReferenceLocalitySchema,
    prices: z.array(supplementaryPriceSchema).max(2000),
  })
  .strict();

// Assistant: understands a need written freely, ranks products against the database and asks a
// question only when its answer would change the recommendation.
export const supplementaryAssistantQuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,40}$/),
    text: text(300),
    options: z
      .array(z.object({ value: z.string().min(1).max(60), label: text(120) }).strict())
      .min(2)
      .max(8),
    allowCustom: z.boolean(),
  })
  .strict();
export const supplementaryAssistantInputSchema = z
  .object({
    message: text(800),
    profile: z
      .object({
        birthYear: z.number().int().min(1900).max(2026).nullable(),
        sex: supplementarySexSchema.nullable(),
        canton: supplementaryCantonSchema.nullable(),
      })
      .strict(),
    answers: z
      .record(z.string().regex(/^[a-z][a-z0-9_]{0,40}$/), z.string().trim().min(1).max(200))
      .refine((value) => Object.keys(value).length <= 10, "too_many_answers"),
  })
  .strict();
export const supplementaryAssistantResultSchema = z
  .object({
    engine: z.enum(["llm", "rules"]),
    interpretation: z
      .object({
        tags: z.array(z.string().max(80)).max(30),
        categories: z.array(key).max(15),
        insurers: z.array(key).max(15),
        maxMonthlyMinor: minor.nullable(),
      })
      .strict(),
    // Profile actually used for the prices, after defaults and answers.
    profile: supplementaryQuoteInputSchema,
    assumptions: z.array(text(300)).max(8),
    summary: z.string().max(1200),
    question: supplementaryAssistantQuestionSchema.nullable(),
    results: z
      .array(
        z
          .object({
            productKey: key,
            variant: z.string().max(200).nullable(),
            monthlyMinor: minor.nullable(),
            score: z.number().min(0).max(100),
            matchedTags: z.array(z.string().max(80)).max(30),
            reasons: z.array(text(300)).max(6),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

export type SupplementaryCanton = z.infer<typeof supplementaryCantonSchema>;
export type SupplementarySex = z.infer<typeof supplementarySexSchema>;
export type SupplementaryTag = z.infer<typeof supplementaryTagSchema>;
export type SupplementaryInsurer = z.infer<typeof supplementaryInsurerSchema>;
export type SupplementaryBenefit = z.infer<typeof supplementaryBenefitSchema>;
export type SupplementaryProduct = z.infer<typeof supplementaryProductSchema>;
export type SupplementaryCatalog = z.infer<typeof supplementaryCatalogSchema>;
export type SupplementaryQuoteInput = z.infer<typeof supplementaryQuoteInputSchema>;
export type SupplementaryPrice = z.infer<typeof supplementaryPriceSchema>;
export type SupplementaryQuote = z.infer<typeof supplementaryQuoteSchema>;
export type SupplementaryAssistantInput = z.infer<typeof supplementaryAssistantInputSchema>;
export type SupplementaryAssistantQuestion = z.infer<typeof supplementaryAssistantQuestionSchema>;
export type SupplementaryAssistantResult = z.infer<typeof supplementaryAssistantResultSchema>;
