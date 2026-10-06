// Files of a professional's own dossier: proofs (competence, convention) and, since C8c, the
// profile photo and the organisation logo. They never enter a person's Wallet library, never feed
// a client profile and never become a request's source.
export const professionalPurposes = [
  "partner_competence",
  "partner_convention",
  "partner_profile_photo",
  "partner_organization_logo",
] as const;
export type ProfessionalPurpose = (typeof professionalPurposes)[number];
export const isProfessionalPurpose = (purpose: unknown): purpose is ProfessionalPurpose =>
  typeof purpose === "string" && (professionalPurposes as readonly string[]).includes(purpose);
// Constant literals only, for SQL written by hand.
export const professionalPurposesSql = professionalPurposes.map((p) => `'${p}'`).join(",");
