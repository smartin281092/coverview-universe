import type { InsuranceCompanyId } from "@coverview/contracts";

type Palette = readonly [deep: string, main: string, accent: string];

// The main colour of each company is read from its logo in public/companies; the deep and accent
// tones around it are chosen for the offer page's gradient (8 October 2026). Display only.
const palettes: Partial<Record<InsuranceCompanyId, Palette>> = {
  allianz: ["#001f4d", "#003781", "#13a0d3"],
  assura: ["#5c1406", "#e03010", "#ff8a65"],
  automate: ["#1f1f29", "#404050", "#8a8aa3"],
  axa: ["#00005a", "#00008f", "#ff1721"],
  baloise: ["#000740", "#000d6e", "#4d6bff"],
  css: ["#003a52", "#00a4e0", "#7fd8f7"],
  generali: ["#5e0d0b", "#c21b17", "#ff6f4f"],
  "groupe-mutuel": ["#00242d", "#003d4c", "#f2a900"],
  helsana: ["#4a0420", "#9a0941", "#e85d8a"],
  tsm: ["#0f2349", "#1d4189", "#a69b95"],
};
// CoverView's own call-to-action colours, for a company without a known logo.
const coverview: Palette = ["#111e38", "#3567b2", "#5955a3"];

export function companyPalette(companyId: InsuranceCompanyId | undefined): Palette {
  return (companyId && palettes[companyId]) || coverview;
}
