// Presentation of the current controls, independent of the saved section-wide score.
export function filledFieldsPercent(
  fields: readonly string[],
  values: Readonly<Partial<Record<string, string>>>,
): number {
  if (fields.length === 0) return 0;
  const filled = fields.filter((field) => (values[field]?.trim().length ?? 0) > 0).length;
  return Math.round((filled / fields.length) * 100);
}
