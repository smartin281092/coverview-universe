/**
 * Couleurs d’identité des solutions dans les graphiques : la palette catégorielle validée de la
 * méthode dataviz, dans son ordre (la sienne en bleu, Hyperion en orange, puis les suivantes).
 * Une solution garde sa couleur tant qu’elle est affichée, même quand une autre disparaît.
 */
const SERIES_PALETTE = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
] as const;

const assigned = new Map<string, number>([
  ["own", 0],
  ["prosperity", 1],
]);

export function seriesColor(id: string): string {
  let slot = assigned.get(id);
  if (slot === undefined) {
    const taken = new Set(assigned.values());
    slot = SERIES_PALETTE.findIndex((_, index) => !taken.has(index));
    if (slot < 0) slot = assigned.size % SERIES_PALETTE.length;
    assigned.set(id, slot);
  }
  return SERIES_PALETTE[slot % SERIES_PALETTE.length] ?? SERIES_PALETTE[0];
}

/** Libère la couleur d’une solution retirée pour qu’une nouvelle puisse la prendre. */
export function releaseSeriesColor(id: string) {
  if (id !== "own" && id !== "prosperity") assigned.delete(id);
}

export const CHART_INK = {
  primary: "#181923",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e4e3dd",
  axis: "#c3c2b7",
};
