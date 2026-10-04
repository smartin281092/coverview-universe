import { useLocation } from "@tanstack/react-router";
import { walletProfileScope } from "./wallet-profile-scope";

export function useWalletProfileScope() {
  const { searchStr } = useLocation();
  const scope = walletProfileScope(Object.fromEntries(new URLSearchParams(searchStr)));
  const profileId = scope === "all" ? undefined : scope;
  return { scope, profileId, filter: profileId ? { profileId } : {} };
}
