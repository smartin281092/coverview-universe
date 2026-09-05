import { z } from "astro/zod";

const date = z.iso.date();
// Ce registre ne contient aucune preuve externe validée au démarrage.
// Son alimentation exige la pièce source et la revue éditoriale, pas un statut dans un MDX.
const approvedProofIds: readonly string[] = [];
const quantitativeClaim = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    source: z.url(),
    date,
    currency: z.enum(["CHF", "EUR", "USD"]),
    fees: z.string().min(1),
    periodStart: date,
    periodEnd: date,
    methodology: z.string().min(1),
    universe: z.string().min(1),
  })
  .refine((claim) => claim.periodEnd >= claim.periodStart, "Période incohérente")
  .refine(
    (claim) => approvedProofIds.includes(claim.id),
    "Preuve non validée dans le registre éditorial",
  );

const editorialSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/),
    title: z.string().min(10),
    description: z.string().min(30),
    date,
    updatedAt: date,
    author: z.literal("coverview"),
    tags: z.array(z.string().min(1)).min(1),
    ogImage: z.literal("/og-preview.svg"),
    version: z.string().min(1),
    // Aucune activation publique n'est déduite du contenu ou d'une variable d'environnement.
    status: z.enum(["draft", "preview"]),
    kind: z.enum(["page", "person", "case", "report", "article", "faq"]),
    fictional: z.boolean().default(false),
    sources: z
      .array(z.object({ label: z.string().min(1), anchor: z.string().regex(/^p\d{4}$/) }))
      .min(1)
      .max(20),
    quantitativeClaims: z.array(quantitativeClaim).default([]),
  })
  .refine((entry) => entry.updatedAt >= entry.date, "Mise à jour antérieure à la création");

export type EditorialData = z.infer<typeof editorialSchema>;

export function validateEditorial(frontmatter: unknown, body: string) {
  const data = editorialSchema.parse(frontmatter);
  if (/^(?:import |export )|<[A-Za-z]|\{[^}]*\}/m.test(body))
    throw new Error(`${data.slug} : le miroir exige du Markdown sans code MDX`);
  if ((body.match(/^# /gm) ?? []).length !== 1)
    throw new Error(`${data.slug} : un titre principal requis`);
  if (["case", "report"].includes(data.kind) && (!data.fictional || !/ficti[fv]/i.test(body)))
    throw new Error(`${data.slug} : exemple fictif explicitement requis`);
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  if (data.kind === "case" && headings.length !== 5)
    throw new Error(`${data.slug} : cinq sections de cas requises`);
  if (data.kind === "report" && headings.length !== 10)
    throw new Error(`${data.slug} : dix sections de rapport requises`);
  const financialText = `${data.title}\n${data.description}\n${body}`;
  const financialNumber =
    /\b(?:(?:CHF|EUR|USD)\s*\d[\d’'.,\s]*|\d(?:[\d’'.,\s]*\d)?\s*(?:%|pour cent|CHF|EUR|USD|francs? suisses?|euros?|dollars?))/gi;
  for (const [claim] of financialText.matchAll(financialNumber)) {
    if (!data.fictional && !data.quantitativeClaims.some((proof) => proof.text.includes(claim)))
      throw new Error(`${data.slug} : chiffre financier sans preuve validée`);
  }
  return data;
}
