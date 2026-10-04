import { managedProfileIdSchema } from "@coverview/contracts";

type WalletProfileScope = string;

export function parseWalletProfileScope(value: unknown): WalletProfileScope | undefined {
  return value === "all" ? "all" : managedProfileIdSchema.safeParse(value).data;
}

export function walletProfileScope(search: Record<string, unknown>): WalletProfileScope {
  // Existing profile/authorization deep links explicitly name their subject as `person`.
  return (
    parseWalletProfileScope(search.person) ??
    parseWalletProfileScope(search.profile) ??
    (search.continue === "1" || search.view === "choices" ? "self" : "all")
  );
}

export function retainWalletProfileScope(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const explicit = parseWalletProfileScope(next.person) ?? parseWalletProfileScope(next.profile);
  return { ...next, profile: explicit ?? walletProfileScope(current) };
}
