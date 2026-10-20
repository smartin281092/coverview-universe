import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@coverview/api-client";
import { api } from "../../api";
import { identityOptions } from "./session-state";

// What the person may see in Admin (20 October 2026): nothing of Admin before signing in, only
// their own access without the administrative permission, everything once it is verified. The API
// still refuses every route on its own; this only keeps unreachable pages out of sight.
export type AdminAccess =
  "loading" | "error" | "unavailable" | "signed_out" | "denied" | "mfa" | "granted";

// Pages anyone signed in may open: their access, its verification and their Authenticator.
const accountPaths = new Set(["/", "/account", "/mfa", "/authenticator", "/authenticator/cancel"]);

export function useAdminAccess(): AdminAccess {
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["identity", "config"],
    queryFn: ({ signal }) => api.identityConfig({ signal }),
    staleTime: 0,
    retry: false,
  });
  const identity = useQuery({ ...identityOptions(client), enabled: config.data?.enabled === true });
  const me = identity.data;
  // Same key as the pages' own check, so one request serves the menu and the page.
  const admin = useQuery({
    queryKey: ["private", me?.user.id, me?.session.id, "admin"],
    queryFn: ({ signal }) => api.admin({ signal }),
    enabled: Boolean(me),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (config.isPending) return "loading";
  if (config.isError) return "error";
  if (!config.data.enabled) return "unavailable";
  if (identity.isPending) return "loading";
  if (identity.isError) return "error";
  if (!me) return "signed_out";
  if (admin.isPending) return "loading";
  if (admin.isError) {
    const code = admin.error instanceof ApiError ? admin.error.code : null;
    return code === "IDENTITY_MFA_REQUIRED"
      ? "mfa"
      : code === "IDENTITY_ACCESS_DENIED"
        ? "denied"
        : "error";
  }
  return "granted";
}

export const isSignedIn = (access: AdminAccess) =>
  access === "denied" || access === "mfa" || access === "granted";

// A page the access does not open is never shown: the verification when only it is missing,
// otherwise the person's own access page, which explains what applies to them.
export function adminPageDecision(access: AdminAccess, pathname: string) {
  if (accountPaths.has(pathname) || access === "granted") return "show" as const;
  if (access === "loading") return "wait" as const;
  return access === "mfa" ? ("/mfa" as const) : ("/" as const);
}
