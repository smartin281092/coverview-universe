import { lsa45NoticeVersion } from "@coverview/contracts";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../../api";

export const noticeKey = (identity: IdentityMe) =>
  ["private", identity.user.id, identity.session.id, "lsa45", lsa45NoticeVersion] as const;

export const noticeQuery = (identity: IdentityMe) => ({
  queryKey: noticeKey(identity),
  queryFn: ({ signal }: { signal: AbortSignal }) => api.authorizationNotice({ signal }),
  staleTime: 0,
  gcTime: 0,
  retry: false,
});
