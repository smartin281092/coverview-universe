import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  documentAnalysisSchema,
  documentCategorySchema,
  documentClassificationSchema,
  documentFieldSchema,
  insuranceCompanyIdSchema,
  insuranceDomainSchema,
  insurancePremiumSchema,
  type DocumentAnalysis,
  type DocumentSource,
} from "@coverview/contracts";
import { referencedCompanyIds } from "./document.companies.js";
import { detectedInsuranceDomain, quotedPremium } from "./document.insurance.js";

const quote = z
  .object({ page: z.number().int().min(1).max(20), text: z.string().min(1).max(1000) })
  .strict();
const fact = z.object({ value: z.string().min(1).max(240), evidence: quote }).strict();
const insuranceSchema = z
  .object({
    company: z.object({ value: insuranceCompanyIdSchema, evidence: quote }).strict().nullable(),
    domain: z.object({ value: insuranceDomainSchema, evidence: quote }).strict().nullable(),
    policyNumber: fact.nullable(),
    insuredSubject: fact.nullable(),
    startsOn: z.object({ value: z.iso.date(), evidence: quote }).strict().nullable(),
    endsOn: z.object({ value: z.iso.date(), evidence: quote }).strict().nullable(),
    premium: insurancePremiumSchema.extend({ evidence: quote }).strict().nullable(),
  })
  .strict();
export const resultSchema = z
  .object({
    pageCount: z.number().int().min(1).max(20),
    category: documentCategorySchema,
    classification: documentClassificationSchema,
    title: z.string().trim().min(1).max(140).nullable(),
    titleEvidence: quote.nullable(),
    evidence: quote.nullable(),
    insurance: insuranceSchema.nullable(),
    pages: z
      .array(
        z.object({ page: z.number().int().min(1).max(20), text: z.string().max(30000) }).strict(),
      )
      .min(1)
      .max(20),
    fields: z
      .array(
        z
          .object({
            field: documentFieldSchema,
            value: z.string().min(1).max(240),
            evidence: quote,
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export function readDocumentResult(value: unknown, version: string): DocumentAnalysis {
  type Warning = NonNullable<DocumentAnalysis["warnings"]>[number];
  const warnings = new Set<Warning>();
  const read = <T>(schema: z.ZodType<T>, input: unknown, warning: Warning): T | null => {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    warnings.add(warning);
    return null;
  };
  const record = z.record(z.string(), z.unknown()).safeParse(value);
  const data = record.success ? record.data : {};
  const items = (input: unknown, limit: number, warning: Warning): unknown[] => {
    if (!Array.isArray(input)) {
      warnings.add(warning);
      return [];
    }
    if (input.length > limit) warnings.add(warning);
    return input.slice(0, limit);
  };
  const parsedPages = items(data.pages, 20, "pages").flatMap((page) => {
    const parsed = read(resultSchema.shape.pages.element, page, "pages");
    return parsed ? [parsed] : [];
  });
  const pages = parsedPages
    .filter((page) => {
      if (parsedPages.filter((candidate) => candidate.page === page.page).length === 1) return true;
      warnings.add("pages");
      return false;
    })
    .sort((a, b) => a.page - b.page);
  const count = read(resultSchema.shape.pageCount, data.pageCount, "pages");
  if (
    !pages.length ||
    count !== pages.length ||
    pages.some((page, index) => page.page !== index + 1)
  )
    warnings.add("pages");
  const source = (input: unknown, warning: Warning): DocumentSource | null => {
    const evidence = read(quote, input, warning);
    if (!evidence) return null;
    const page = pages.find((candidate) => candidate.page === evidence.page);
    // Only layout whitespace may differ. Store the exact contiguous excerpt found on that page.
    const pattern = evidence.text
      .trim()
      .split(/\s+/u)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("\\s+");
    const found = evidence.text.trim() && page?.text.match(new RegExp(pattern, "u"))?.[0];
    if (!found || found.length > 1000) {
      warnings.add(warning);
      return null;
    }
    return {
      page: evidence.page,
      text: found,
      method: "openai_vision",
      version,
      confidence: null,
      box: null,
    };
  };
  const parsedFields = items(data.fields, 40, "fields").flatMap((field) => {
    const parsed = read(resultSchema.shape.fields.element, field, "fields");
    return parsed ? [parsed] : [];
  });
  const fields = parsedFields.flatMap((field) => {
    if (
      parsedFields.filter((candidate) => candidate.field === field.field).length !== 1 ||
      (["birthDate", "expiresOn"].includes(field.field) &&
        !z.iso.date().safeParse(field.value).success)
    ) {
      warnings.add("fields");
      return [];
    }
    const citation = source(field.evidence, "fields");
    return citation
      ? [{ id: randomUUID(), field: field.field, value: field.value, source: citation }]
      : [];
  });
  const category = read(resultSchema.shape.category, data.category, "classification") ?? "unknown";
  const classification =
    read(resultSchema.shape.classification, data.classification, "classification") ?? "unknown";
  const evidence =
    data.evidence == null && category === "unknown" && classification === "unknown"
      ? null
      : source(data.evidence, "classification");
  const title = read(resultSchema.shape.title, data.title, "title");
  const titleSource = title ? source(data.titleEvidence, "title") : null;
  if (!title && data.titleEvidence != null) warnings.add("title");
  const rawInsurance =
    data.insurance == null
      ? null
      : read(z.record(z.string(), z.unknown()), data.insurance, "insurance");
  const insuranceFact = <T>(schema: z.ZodType<T>, key: string): T | null =>
    rawInsurance?.[key] == null ? null : read(schema, rawInsurance[key], "insurance");
  const sourced = (input: z.infer<typeof fact> | null) => {
    if (!input) return null;
    const citation = source(input.evidence, "insurance");
    if (!citation) return null;
    const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(input.value);
    const alternatives = date
      ? [input.value, `${date[3]}.${date[2]}.${date[1]}`, `${date[3]}/${date[2]}/${date[1]}`]
      : [input.value];
    if (!alternatives.some((candidate) => citation.text.includes(candidate))) {
      warnings.add("insurance");
      return null;
    }
    return { value: input.value, source: citation };
  };
  const company = insuranceFact(insuranceSchema.shape.company, "company");
  const companySource = company ? source(company.evidence, "insurance") : null;
  const companyIds = companySource ? referencedCompanyIds([companySource.text]) : [];
  const validCompany = company && companyIds.length === 1 && companyIds[0] === company.value;
  if (company && !validCompany) warnings.add("insurance");
  const domain = insuranceFact(insuranceSchema.shape.domain, "domain");
  const domainSource = domain ? source(domain.evidence, "insurance") : null;
  const validDomain =
    domain && domainSource && detectedInsuranceDomain(domainSource.text) === domain.value;
  if (domain && !validDomain) warnings.add("insurance");
  const premium = insuranceFact(insuranceSchema.shape.premium, "premium");
  const premiumSource = premium ? source(premium.evidence, "insurance") : null;
  const quoted = premiumSource ? quotedPremium(premiumSource.text) : null;
  const validPremium =
    premium &&
    quoted &&
    quoted.amountMinor === premium.amountMinor &&
    quoted.currency === premium.currency &&
    quoted.period === premium.period;
  if (premium && !validPremium) warnings.add("insurance");
  const insurance = rawInsurance
    ? {
        companyId: validCompany ? company.value : null,
        companySource: validCompany ? companySource : null,
        domain: validDomain ? domain.value : null,
        domainSource: validDomain ? domainSource : null,
        premium: validPremium && premiumSource ? { ...quoted, source: premiumSource } : null,
        policyNumber: sourced(insuranceFact(insuranceSchema.shape.policyNumber, "policyNumber")),
        insuredSubject: sourced(
          insuranceFact(insuranceSchema.shape.insuredSubject, "insuredSubject"),
        ),
        startsOn: sourced(insuranceFact(insuranceSchema.shape.startsOn, "startsOn")),
        endsOn: sourced(insuranceFact(insuranceSchema.shape.endsOn, "endsOn")),
      }
    : null;
  return documentAnalysisSchema.parse({
    category: evidence ? category : "unknown",
    classification: evidence ? classification : "unknown",
    evidence,
    title: titleSource ? title : null,
    titleSource,
    fields,
    insurance,
    pages: pages.map((page) => ({ ...page, method: "openai_vision", version })),
    warnings: [...warnings],
  });
}
