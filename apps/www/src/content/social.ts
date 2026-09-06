import { marketing } from "./fr/marketing";

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

// Une seule source de texte pour la page et ses aperçus de partage.
export function socialSvg() {
  const lines = marketing.hero.title.split("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <g fill="none" stroke="#d5d9e2" stroke-width="2"><circle cx="1040" cy="345" r="255"/><circle cx="1040" cy="345" r="193"/><circle cx="1040" cy="345" r="131"/></g>
  <circle cx="1040" cy="345" r="12" fill="#0a0a0a"/>
  <text x="72" y="105" fill="#0a0a0a" font-family="Arial,sans-serif" font-size="32" font-weight="400">CoverView</text>
  <text x="72" y="236" fill="#545454" font-family="Arial,sans-serif" font-size="22">${escapeXml(marketing.hero.eyebrow)}</text>
  ${lines.map((line, index) => `<text x="68" y="${335 + index * 85}" fill="#0a0a0a" font-family="Arial,sans-serif" font-size="72" font-weight="400" letter-spacing="-1.8">${escapeXml(line)}</text>`).join("")}
  <text x="72" y="558" fill="#0a0a0a" font-family="Arial,sans-serif" font-size="22">coverview.ch</text>
  </svg>`;
}
