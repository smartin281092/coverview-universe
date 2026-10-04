import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  clientInvitationNoticeVersion,
  type ClientInvitationResponse,
} from "@coverview/contracts/partner-invitations";
import { Button, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { LogoutActions } from "../features/identity/LogoutActions";
import { partnerApi } from "../partner-api";

const storageKey = "coverview.activation";
const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" });

// The token arrives in the URL fragment, never sent to a server, and survives the login redirect
// in this tab only. It is removed from the address bar immediately.
function useToken() {
  const [token] = useState(() => {
    const match = /(?:^|&)token=([A-Za-z0-9_-]{43})(?:&|$)/u.exec(window.location.hash.slice(1));
    try {
      if (match) sessionStorage.setItem(storageKey, match[1]!);
      return match?.[1] ?? sessionStorage.getItem(storageKey);
    } catch {
      return match?.[1] ?? null;
    }
  });
  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  return token;
}

function Invitation({ identity, token }: { identity: IdentityMe; token: string }) {
  const { t } = useTranslation("activation"),
    confirmId = useId(),
    [confirmed, setConfirmed] = useState(false),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const preview = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "activation"],
    queryFn: ({ signal }) =>
      partnerApi.previewClientInvitation(token, {
        csrfToken: identity.csrfToken,
        idempotencyKey: crypto.randomUUID(),
        signal,
      }),
    gcTime: 0,
    retry: false,
  });
  const respond = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (decision: "accept" | "decline") => {
      const input: ClientInvitationResponse = {
        token,
        decision,
        noticeVersion: clientInvitationNoticeVersion,
        confirmed: true,
      };
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.respondClientInvitation(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Storage may be unavailable: the token is single-use server side anyway. */
      }
    },
  });
  if (preview.isPending) return <LoadingState label={t("loading")} />;
  if (preview.isError)
    return (
      <p role="alert" className="text-sm">
        {t("error")}
      </p>
    );
  const state = respond.data?.state ?? preview.data.state;
  if (!preview.data.emailMatches && state === "pending")
    return (
      <div className="space-y-4">
        <p role="status">{t("otherEmail")}</p>
        <LogoutActions identity={identity} scope="current" />
      </div>
    );
  if (state !== "pending")
    return (
      <div className="space-y-4">
        <p role="status">{t(`states.${state}`)}</p>
        {state === "accepted" && (
          <Button asChild>
            <Link to="/offers">{t("done")}</Link>
          </Button>
        )}
      </div>
    );
  const data = preview.data;
  return (
    <div className="space-y-6">
      <p>
        {t("summary", {
          requester: data.requester,
          title: data.title,
          category: data.category ? t(`categories.${data.category}`) : "",
          name: data.clientName,
        })}
      </p>
      <p className="text-sm text-muted-foreground">{t("shared")}</p>
      {data.expiresAt && (
        <p className="text-sm text-muted-foreground">
          {t("expires", { date: day.format(new Date(data.expiresAt)) })}
        </p>
      )}
      <section className="space-y-2 rounded-xl border border-border p-4">
        <h2 className="font-medium">{t("noticeTitle")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(t("notice", { returnObjects: true }) as string[]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
        <input
          id={confirmId}
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1"
        />
        {t("confirm")}
      </label>
      {respond.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!confirmed || respond.isPending} onClick={() => respond.mutate("accept")}>
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          disabled={!confirmed || respond.isPending}
          onClick={() => respond.mutate("decline")}
        >
          {t("decline")}
        </Button>
      </div>
    </div>
  );
}

export function ActivationPage() {
  const { t } = useTranslation("activation"),
    token = useToken();
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {!token ? (
        <p role="status">{t("missing")}</p>
      ) : (
        <IdentityBoundary
          continuation="activation"
          signedOut={{ title: t("signedOutTitle"), description: t("signedOutDescription") }}
        >
          {(identity) => <Invitation identity={identity} token={token} />}
        </IdentityBoundary>
      )}
    </section>
  );
}
