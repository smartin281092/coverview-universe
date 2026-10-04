import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { useQuery } from "@tanstack/react-query";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../../api";
import { identityKey } from "../identity/session-state";

export function useActionCount() {
  const { scope, filter } = useWalletProfileScope();
  // Subscribe to the page's identity boundary; the navigation never starts authentication.
  const identity = useQuery<IdentityMe | null>({
    queryKey: identityKey,
    enabled: false,
    gcTime: 0,
  });
  const current = identity.data;
  const visible = !!current && !identity.isFetching && !identity.isError;
  const summary = useQuery({
    queryKey: ["private", current?.user.id, current?.session.id, "action-center", scope, "summary"],
    queryFn: ({ signal }) => api.actionCenterSummary({ signal }, filter),
    enabled: visible,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 30_000),
    refetchIntervalInBackground: false,
  });
  return visible && !summary.isError ? summary.data?.pending : undefined;
}
