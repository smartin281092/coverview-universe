import type { AdvisorAssessment, AdvicePreferences } from "@coverview/contracts/partner";

// Only structured declarations and the current confirmation may produce a comparison.
export function compareAdvisorCriterion(
  preferencesStatus: AdvicePreferences["status"],
  wanted: string | null,
  values: string[],
  source: "declared" | "scope_changed" | "missing" | "unset",
): AdvisorAssessment["criteria"]["language"] {
  if (preferencesStatus !== "confirmed")
    return { status: "unknown", reason: `preferences_${preferencesStatus}` };
  if (!wanted) return { status: "unknown", reason: "preference_unspecified" };
  if (source !== "declared")
    return {
      status: "unknown",
      reason: source === "scope_changed" ? "declaration_scope_changed" : "declaration_missing",
    };
  if (!values.length) return { status: "unknown", reason: "declaration_unspecified" };
  return values.includes(wanted)
    ? { status: "matches", reason: "declared_match" }
    : { status: "differs", reason: "declared_difference" };
}
