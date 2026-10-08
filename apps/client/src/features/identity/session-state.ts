import { QueryClient, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { api } from "../../api";

export const identityKey = ["identity", "me"] as const;

async function clearPrivateState(client: QueryClient) {
  await client.cancelQueries({ queryKey: ["private"] });
  client.removeQueries({ queryKey: ["private"] });
  const mutations = client.getMutationCache();
  for (const mutation of mutations.getAll()) {
    if (mutation.options.mutationKey?.[0] === "private") mutations.remove(mutation);
  }
}

export async function forgetIdentity(client: QueryClient) {
  await client.cancelQueries({ queryKey: identityKey });
  await clearPrivateState(client);
  client.setQueryData(identityKey, null);
}

/** Follows the identity the page's boundary loads; never starts authentication itself. */
export function usePassiveIdentity() {
  const client = useQueryClient();
  return useQuery({ ...identityOptions(client), enabled: false });
}

export function identityOptions(client: QueryClient) {
  return queryOptions({
    queryKey: identityKey,
    queryFn: async ({ signal }): Promise<IdentityMe | null> => {
      try {
        const identity = await api.me({ signal });
        signal.throwIfAborted();
        const previous = client.getQueryData<IdentityMe | null>(identityKey);
        if (previous?.user.id !== identity.user.id || previous.session.id !== identity.session.id) {
          await clearPrivateState(client);
        } else {
          await client.invalidateQueries({ queryKey: ["private"] });
        }
        signal.throwIfAborted();
        return identity;
      } catch (error) {
        signal.throwIfAborted();
        await clearPrivateState(client);
        if (error instanceof ApiError && error.code === "IDENTITY_UNAUTHENTICATED") return null;
        throw error;
      }
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
