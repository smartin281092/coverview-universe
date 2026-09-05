import { indexableEditorials } from "./editorial";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
// Les trois formats partagent la sélection des contenus réellement indexables.
export const discovery = {
  sitemap: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexableEditorials.map(({ data }) => `<url><loc>https://coverview.ch/${data.slug}</loc><lastmod>${data.updatedAt}</lastmod></url>`).join("")}</urlset>`,
  feed: `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>CoverView — préversion éditoriale</title><link>https://coverview.ch</link><description>Aucun contenu indexable dans cette préversion locale.</description>${indexableEditorials.map(({ data }) => `<item><title>${escapeXml(data.title)}</title><link>https://coverview.ch/${data.slug}</link><description>${escapeXml(data.description)}</description><guid>https://coverview.ch/${data.slug}</guid></item>`).join("")}</channel></rss>`,
  llms: `# CoverView\n\nPréversion locale non indexable. Aucun contenu ouvert aux moteurs.\n${indexableEditorials.map(({ data }) => `- [${data.title}](https://coverview.ch/${data.slug}) : ${data.description}`).join("\n")}\n`,
};
