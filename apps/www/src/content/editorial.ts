import type { MDXInstance } from "astro";
import { validateEditorial, type EditorialData } from "./editorial-schema";
import { editorialCopy as copy } from "./fr/editorial-interface";

const modules = import.meta.glob<MDXInstance<Record<string, unknown>>>(
  ["./fr/editorial/*.mdx", "./fr/methode.mdx", "./fr/sebastien-martin.mdx"],
  { eager: true },
);
const raw = import.meta.glob<string>(
  ["./fr/editorial/*.mdx", "./fr/methode.mdx", "./fr/sebastien-martin.mdx"],
  { eager: true, query: "?raw", import: "default" },
);
export const editorials = Object.entries(modules)
  .map(([path, module]) => {
    const body = raw[path]!.replaceAll("\r\n", "\n")
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim();
    return { data: validateEditorial(module.frontmatter, body), body, Content: module.Content };
  })
  .filter((entry) => entry.data.status === "preview")
  .sort((a, b) => a.data.slug.localeCompare(b.data.slug));
if (new Set(editorials.map((entry) => entry.data.slug)).size !== editorials.length)
  throw new Error("Slug éditorial dupliqué");
export type Editorial = (typeof editorials)[number];

export function editorialFor(slug: string) {
  const entry = editorials.find((item) => item.data.slug === slug);
  if (!entry) throw new Error(`Contenu absent : ${slug}`);
  return entry;
}

export const editorialIndexes = Object.entries(copy.indexes).flatMap(([slug, index]) => {
  const entries = editorials.filter((entry) => index.kinds.includes(entry.data.kind));
  const total = Math.max(1, Math.ceil(entries.length / 2));
  return Array.from({ length: total }, (_, i) => ({
    slug: i === 0 ? slug : `${slug}/page/${i + 1}`,
    root: slug,
    index,
    page: i + 1,
    total,
    entries: entries.slice(i * 2, i * 2 + 2),
  }));
});
export const readableEditorialPaths = new Set([
  ...editorials.map((entry) => entry.data.slug),
  ...editorialIndexes.map((index) => index.slug),
]);
export const editorialAnchor = (slug: string) => `article-${slug.replaceAll("/", "-")}`;
// Préversion uniquement. L'ouverture aux moteurs relève d'une décision et revue ultérieures.
export const indexableEditorials: Editorial[] = [];

export function structuredEditorial(entry: Editorial, canonical: string) {
  const data = entry.data;
  const organization = {
    "@type": "Organization",
    "@id": "https://coverview.ch/#organization",
    name: copy.author,
    url: "https://coverview.ch/",
  };
  const page = {
    "@type": ["article", "case", "report"].includes(data.kind) ? "Article" : "WebPage",
    "@id": `${canonical}#content`,
    url: canonical,
    headline: data.title,
    description: data.description,
    inLanguage: "fr-CH",
    dateCreated: data.date,
    dateModified: data.updatedAt,
    author: { "@id": organization["@id"] },
    isAccessibleForFree: true,
    creativeWorkStatus: copy.preview,
    citation: data.sources.map((source) => ({
      "@type": "CreativeWork",
      name: source.label,
      url: "https://coverview.ch/sources#bible-v15",
    })),
  };
  const nodes: Record<string, unknown>[] = [organization, page];
  if (data.kind === "person")
    nodes.push({
      "@type": "Person",
      "@id": `${canonical}#person`,
      name: "Sébastien Martin",
      url: canonical,
    });
  if (data.kind === "faq") {
    // Les questions et réponses proviennent du même Markdown simple que le HTML rendu.
    const questions = [...entry.body.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
    nodes.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: questions.map((match) => ({
        "@type": "Question",
        name: match[1],
        acceptedAnswer: { "@type": "Answer", text: plainMarkdown(match[2]!.trim()) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": nodes };
}

function plainMarkdown(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replaceAll("**", "")
    .replaceAll("\n", " ");
}

export function metadataMarkdown(data: EditorialData) {
  return `${copy.author} — ${copy.authorNote}\n\n${copy.created} ${data.date} · ${copy.updated} ${data.updatedAt} · ${copy.version} ${data.version}\n\n${copy.preview}${data.fictional ? `\n\n${copy.fictional}` : ""}`;
}
