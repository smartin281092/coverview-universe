import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identityMfaVerifyInputSchema } from "@coverview/contracts";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import type { z } from "zod";
import { api } from "../../api";
import { clearPrivateState, identityKey } from "./session-state";

type EnrollmentInput = z.infer<typeof identityMfaVerifyInputSchema>;
type Command = "start" | "challenge" | "confirm" | "cancel";
type PrivateQr = Awaited<ReturnType<typeof api.startMfaEnrollment>>;

export function useAuthenticatorEnrollment(identity: IdentityMe) {
  const client = useQueryClient();
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<Command | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [qr, setQr] = useState<PrivateQr | null>(null);
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  const form = useForm<EnrollmentInput>({
    resolver: zodResolver(identityMfaVerifyInputSchema),
    defaultValues: { code: "" },
  });
  // Only the non-secret status is cached. QR responses and entered codes stay in this hook.
  const enrollment = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "mfa-enrollment"],
    queryFn: ({ signal }) => api.mfaEnrollment({ signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const resetForm = form.reset;
  const clearSensitive = useCallback(() => {
    setQr(null);
    resetForm();
  }, [resetForm]);
  const refetch = enrollment.refetch;
  const refresh = useCallback(async () => {
    if (request.current) return;
    setError(null);
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const clearPage = () => {
      request.current?.abort();
      request.current = null;
      clearSensitive();
      setPending(null);
      setError(null);
    };
    const hidePage = () => {
      // Clear before the browser can freeze this document in its back/forward cache.
      flushSync(clearPage);
    };
    window.addEventListener("pagehide", hidePage);
    return () => {
      window.removeEventListener("pagehide", hidePage);
      clearPage();
    };
  }, [clearSensitive]);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setTimeout(
      () => {
        clearSensitive();
      },
      Math.max(0, Date.parse(qr.expiresAt) - Date.now()),
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [qr, clearSensitive]);

  const expiresAt = enrollment.data?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        clearSensitive();
        setExpiredAt(expiresAt);
        void refetch();
      },
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [expiresAt, clearSensitive, refetch]);

  const state = enrollment.data?.state;
  useEffect(() => {
    if (state !== "pending") clearSensitive();
  }, [state, clearSensitive]);

  const execute = async (command: Command, input?: EnrollmentInput): Promise<boolean> => {
    if (request.current) return false;
    const controller = new AbortController();
    request.current = controller;
    setPending(command);
    setError(null);
    clearSensitive();
    const options = {
      signal: controller.signal,
      csrfToken: identity.csrfToken,
      idempotencyKey: crypto.randomUUID(),
    };
    try {
      if (command === "start") {
        const result = await api.startMfaEnrollment(options);
        controller.signal.throwIfAborted();
        // No mutation cache and no automatic replay: the QR is delivered once.
        setQr(result);
      } else if (command === "challenge") {
        await api.challengeMfaEnrollment(options);
      } else if (command === "confirm" && input) {
        await api.confirmMfaEnrollment(input, options);
        controller.signal.throwIfAborted();
        await clearPrivateState(client);
        await client.invalidateQueries({ queryKey: identityKey });
        return true;
      } else if (command === "cancel") {
        await api.cancelMfaEnrollment(options);
      }
      controller.signal.throwIfAborted();
      await refetch();
      return !controller.signal.aborted;
    } catch (cause) {
      if (controller.signal.aborted) return false;
      clearSensitive();
      if (!(cause instanceof ApiError && cause.code === "IDENTITY_MFA_ENROLLMENT_CONFLICT")) {
        setError(cause);
      }
      // A lost response may hide a completed command. Read its state; never replay creation.
      await refetch();
      if (command === "confirm") await client.invalidateQueries({ queryKey: identityKey });
      return false;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(null);
      }
    }
  };

  return {
    enrollment,
    form,
    qr,
    pending,
    error,
    expired: Boolean(expiresAt && (expiresAt === expiredAt || Date.parse(expiresAt) <= Date.now())),
    refresh,
    start: () => execute("start"),
    challenge: () => execute("challenge"),
    confirm: (input: EnrollmentInput) => execute("confirm", input),
    cancel: () => execute("cancel"),
  };
}
