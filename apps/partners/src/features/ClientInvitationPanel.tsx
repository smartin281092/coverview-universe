import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Label } from "@coverview/ui";
import {
  clientInvitationCommandSchema,
  type ClientInvitationCommand,
} from "@coverview/contracts/partner-invitations";
import { PartnerApiError } from "@coverview/api-client/partner";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { readText } from "./Field";

const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });

export function ClientInvitationPanel({ leadId }: { leadId: string }) {
  const { t } = useTranslation("invitations"),
    session = usePartner(),
    cache = useQueryClient(),
    confirmId = useId(),
    reasonId = useId(),
    key = [...session.queryKey, "client-invitations", leadId],
    [cancelling, setCancelling] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const invitations = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => partnerApi.clientInvitations(leadId, signal),
    gcTime: 0,
  });
  const command = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: ClientInvitationCommand) => {
      const parsed = clientInvitationCommandSchema.parse(input),
        payload = JSON.stringify(parsed);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.commandClientInvitation(leadId, parsed, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      setCancelling(null);
      setError(null);
      void cache.invalidateQueries({ queryKey: key });
    },
    onError: (cause) =>
      setError(
        cause instanceof PartnerApiError && cause.code === "PARTNER_RATE_LIMITED"
          ? t("rateLimited")
          : t("error"),
      ),
  });
  // Without contact authority, or once the request is linked, there is nothing to act on here.
  if (
    invitations.isPending ||
    invitations.isError ||
    invitations.data.blocker === "linked" ||
    invitations.data.blocker === "access"
  )
    return null;
  const data = invitations.data,
    queued = data.items.some((item) => item.state === "queued");
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.isPending) return;
    command.mutate({ action: "send", confirmed: true });
  }
  function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.isPending || !cancelling) return;
    command.mutate({
      action: "cancel",
      id: cancelling,
      reason: readText(new FormData(event.currentTarget), "reason"),
    });
  }
  return (
    <section className="space-y-4 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {data.blocker && <p className="text-sm">{t(`blocker.${data.blocker}`)}</p>}
      {data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.items.map((item) => (
            <li key={item.id} className="space-y-2 p-3 text-sm">
              <p className="font-medium">{t(`state.${item.state}`)}</p>
              <p className="text-muted-foreground">
                {t("item", { email: item.email, date: day.format(new Date(item.createdAt)) })}
              </p>
              {item.reason && <p className="text-muted-foreground">{t(`reason.${item.reason}`)}</p>}
              {["queued", "sent"].includes(item.state) &&
                !data.blocker &&
                (cancelling === item.id ? (
                  <form className="space-y-2" onSubmit={cancel}>
                    <Label htmlFor={reasonId}>{t("cancelReason")}</Label>
                    <textarea
                      id={reasonId}
                      name="reason"
                      required
                      minLength={5}
                      maxLength={500}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={command.isPending}>
                        {t("cancelConfirm")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelling(null)}
                      >
                        {t("back")}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setCancelling(item.id)}>
                    {t("cancel")}
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {data.delivery === "unconfigured" && (data.canInvite || queued) && (
        <p className="text-sm text-muted-foreground">{t("unconfigured")}</p>
      )}
      {data.canInvite && (
        <form className="space-y-3" onSubmit={send}>
          <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
            <input id={confirmId} type="checkbox" required className="mt-1" />
            {t("confirm")}
          </label>
          <Button type="submit" disabled={command.isPending}>
            {t("send")}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
