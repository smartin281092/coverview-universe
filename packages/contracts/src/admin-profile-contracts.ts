import { z } from "zod";
import { documentSummarySchema, insuranceCompanyDetailsSchema } from "./documents.js";

export const adminProfileContractsSchema = z.object({
  companies: z.array(insuranceCompanyDetailsSchema).max(11),
  unassigned: z.array(documentSummarySchema).max(200),
});
