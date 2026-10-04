import { conclusionActionSchema } from "@coverview/contracts/partner-conclusion";

// Corrections preserve every original record, but remove the corrected fact and its dependents
// from the effective chain. The signature is outside this chain and can never be erased here.
export function conclusionHistory<T extends { id: string; input: unknown }>(rows: T[]) {
  const history = rows.map((r) => ({ ...r, input: conclusionActionSchema.parse(r.input) }));
  let active: typeof history = [];
  for (const entry of history) {
    if (entry.input.action === "correct") {
      const targetId = entry.input.targetActionId;
      const index = active.findIndex((a) => a.id === targetId);
      if (index >= 0) active = active.slice(0, index);
    } else active.push(entry);
  }
  const ids = new Set(active.map((r) => r.id));
  return {
    active,
    history: history.map((r) => ({
      ...r,
      superseded: r.input.action !== "correct" && !ids.has(r.id),
    })),
  };
}
