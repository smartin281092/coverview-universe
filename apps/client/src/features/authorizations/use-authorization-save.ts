import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import type { ProfileSaveInput } from "@coverview/contracts";
import { api } from "../../api";
import { forgetIdentity } from "../identity/session-state";

export function useAuthorizationSave(identity: IdentityMe, onSaved: () => void) {
  const client = useQueryClient();
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: ProfileSaveInput) => {
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return api.saveProfile(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: (profile) => {
      client.setQueryData(["private", identity.user.id, identity.session.id, "profile"], profile);
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) void forgetIdentity(client);
    },
    retry: false,
  });
}
