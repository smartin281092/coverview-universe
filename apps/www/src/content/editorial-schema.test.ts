import { describe, expect, it } from "vitest";
import { validateEditorial } from "./editorial-schema";

const metadata = {
  slug: "exemple",
  title: "Une page de méthode",
  description: "Une description éditoriale de longueur suffisante.",
  date: "2026-09-06",
  updatedAt: "2026-09-06",
  author: "coverview",
  tags: ["méthode"],
  ogImage: "/og-preview.svg",
  version: "1",
  status: "preview",
  kind: "page",
  sources: [{ label: "Bible produit v1.5 · §4", anchor: "p0138" }],
};

describe("garde éditorial avant génération", () => {
  it("refuse une revendication financière sans pièce approuvée, même avec métadonnées complètes", () => {
    for (const claim of ["12 %", "CHF 100", "1’000 CHF", "12 pour cent", "100 francs suisses"]) {
      expect(() => validateEditorial(metadata, `# Résultat\n\n${claim}`)).toThrow(/preuve/);
      expect(() =>
        validateEditorial({ ...metadata, title: `Un résultat de ${claim}` }, "# Résultat"),
      ).toThrow(/preuve/);
    }
    expect(() =>
      validateEditorial({ ...metadata, quantitativeClaims: [{ id: "sans-source" }] }, "# Résultat"),
    ).toThrow();
    expect(() =>
      validateEditorial(
        {
          ...metadata,
          quantitativeClaims: [
            {
              id: "non-approuve",
              text: "12 %",
              source: "https://example.test/preuve",
              date: "2026-09-06",
              currency: "CHF",
              fees: "Net des frais décrits",
              periodStart: "2025-01-01",
              periodEnd: "2025-12-31",
              methodology: "Méthode fictive",
              universe: "Univers fictif",
            },
          ],
        },
        "# Résultat\n\n12 %",
      ),
    ).toThrow(/non validée/);
  });
  it("refuse d'activer une publication, une date invalide ou une fausse signature éditoriale", () => {
    for (const change of [
      { status: "published" },
      { date: "2026-02-30" },
      { updatedAt: "2025-01-01" },
      { author: "personne-non-validee" },
    ])
      expect(() => validateEditorial({ ...metadata, ...change }, "# Page")).toThrow();
  });
  it("exige la structure et le marquage fictif des cas et rapports", () => {
    const body =
      "# Cas fictif\n\n## Situation initiale\n\n## Analyse\n\n## Benchmark\n\n## Décision\n\n## Résultat";
    expect(() => validateEditorial({ ...metadata, kind: "case" }, body)).toThrow(/fictif/);
    expect(validateEditorial({ ...metadata, kind: "case", fictional: true }, body).fictional).toBe(
      true,
    );
    expect(() => validateEditorial({ ...metadata, kind: "report", fictional: true }, body)).toThrow(
      /dix sections/,
    );
  });
  it("refuse du code caché ou un corps non équivalent au miroir Markdown", () => {
    for (const body of [
      "# Page\n\n<script>fetch('/private')</script>",
      "# Page\n\n{secret}",
      "# Page\n\nimport X from './private'",
      "# Page\n\n# Autre titre",
    ])
      expect(() => validateEditorial(metadata, body)).toThrow();
  });
});
