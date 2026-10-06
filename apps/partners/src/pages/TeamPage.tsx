import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { TeamMember } from "@coverview/contracts/partner-team";
import {
  AccessDeniedState,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
} from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { formatDate, readText } from "../features/Field";
import { partnerApi } from "../api";

// Team of an organisation's manager (C8b): members, their load, invitations and departures.
function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}
function useFailure(error: unknown) {
  const { t } = useTranslation("partner");
  if (!error) return "";
  return error instanceof PartnerApiError ? t(`errors.${error.code}`) : t("error");
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(["team", "partner"]),
    session = usePartner(),
    client = useQueryClient(),
    attemptFor = useAttempt(),
    emailId = useId();
  const invite = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (email: string) =>
      partnerApi.inviteTeamMember(
        { email },
        { csrfToken: session.identity.csrfToken, idempotencyKey: attemptFor(email) },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...session.queryKey, "team"] });
      onClose();
    },
  });
  const failure = useFailure(invite.error);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite.isPending) invite.mutate(readText(new FormData(event.currentTarget), "email"));
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !invite.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("invite.title")}</DialogTitle>
          <DialogDescription>{t("invite.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5 text-sm" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={emailId}>{t("invite.email")}</Label>
            <Input id={emailId} name="email" type="email" autoComplete="off" required />
          </div>
          {invite.isError && (
            <p role="alert" className="text-destructive">
              {failure}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={invite.isPending}>
              {t("partner:cancel")}
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {t("invite.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemovalDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { t } = useTranslation(["team", "partner"]),
    session = usePartner(),
    client = useQueryClient(),
    attemptFor = useAttempt(),
    reasonId = useId();
  const remove = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (reason: string) => {
      const input = { revision: member.revision, reason };
      return partnerApi.removeTeamMember(member.userId, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor(input),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: session.queryKey });
      onClose();
    },
  });
  const failure = useFailure(remove.error);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!remove.isPending) remove.mutate(readText(new FormData(event.currentTarget), "reason"));
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("removal.title", { name: member.name })}</DialogTitle>
          <DialogDescription>{t("removal.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5 text-sm" onSubmit={submit}>
          <p>
            {member.activeLeads
              ? t("removal.consequences", { count: member.activeLeads })
              : t("removal.none")}
          </p>
          <p className="text-muted-foreground">{t("removal.kept")}</p>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t("removal.reason")}</Label>
            <textarea
              id={reasonId}
              name="reason"
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          {remove.isError && (
            <p role="alert" className="text-destructive">
              {failure}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={remove.isPending}>
              {t("partner:cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={remove.isPending}>
              {t("removal.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamPage() {
  const { t } = useTranslation(["team", "partner"]),
    session = usePartner(),
    client = useQueryClient(),
    attemptFor = useAttempt(),
    [inviting, setInviting] = useState(false),
    [removing, setRemoving] = useState<TeamMember | null>(null);
  const allowed =
    session.context.operational && !!session.context.application?.grantedRoles.includes("manager");
  const query = useQuery({
    queryKey: [...session.queryKey, "team"],
    queryFn: ({ signal }) => partnerApi.team(signal),
    enabled: allowed,
    gcTime: 0,
  });
  const cancel = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (invitationId: string) =>
      partnerApi.cancelTeamInvitation(invitationId, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor({ cancel: invitationId }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...session.queryKey, "team"] }),
  });
  const cancelFailure = useFailure(cancel.error);
  if (!allowed)
    return (
      <AccessDeniedState
        title={t("title")}
        description={t("partner:errors.PARTNER_ACCESS_DENIED")}
      />
    );
  if (query.isPending) return <LoadingState label={t("partner:loading")} />;
  if (query.isError)
    return (
      <ErrorState
        title={t("partner:error")}
        description={t("partner:error")}
        retryLabel={t("partner:retry")}
        pendingLabel={t("partner:loading")}
        onRetry={() => void query.refetch()}
      />
    );
  const team = query.data;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="cv-meta">{team.organization.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="space-y-2">
          <Button onClick={() => setInviting(true)} disabled={!team.canInvite}>
            {t("invite.action")}
          </Button>
          {!team.canInvite && <p className="text-xs text-muted-foreground">{t("invite.limit")}</p>}
        </div>
      </header>
      <section className="space-y-4" aria-labelledby="team-members">
        <h2 id="team-members" className="text-xl font-semibold">
          {t("members")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {team.members.map((member) => {
            const kinds = (["newLeads", "leadCreation", "marketplace"] as const).filter(
              (kind) => member.restrictions[kind],
            );
            return (
              <li key={member.userId} className="rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {member.name}
                    {member.self && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {t("you")}
                      </span>
                    )}
                  </p>
                  <Badge variant="outline">{t(`partner:applicationState.${member.state}`)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.grantedRoles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {t(`partner:role.${role}`)}
                    </Badge>
                  ))}
                </div>
                {member.reviewDueAt && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("reviewDue", { date: formatDate(member.reviewDueAt) })}
                  </p>
                )}
                {(kinds.length > 0 || member.restrictions.categories.length > 0) && (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-amber-800 dark:text-amber-300">{t("restricted")}</p>
                    <ul className="flex flex-wrap gap-2">
                      {kinds.map((kind) => (
                        <li key={kind}>
                          <Badge variant="outline">{t(`restrictions.${kind}`)}</Badge>
                        </li>
                      ))}
                      {member.restrictions.categories.length > 0 && (
                        <li>
                          <Badge variant="outline">
                            {t("restrictions.categories", {
                              list: member.restrictions.categories
                                .map((category) => t(`partner:category.${category}`))
                                .join(", "),
                            })}
                          </Badge>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-sm">
                  {t("load", { active: member.activeLeads, overdue: member.overdueLeads })}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/leads"
                    search={{ view: "team", responsibleId: member.userId }}
                    className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-muted"
                  >
                    {t("leads")}
                  </Link>
                  {member.canRemove && (
                    <Button variant="outline" size="sm" onClick={() => setRemoving(member)}>
                      {t("removal.action")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="space-y-4" aria-labelledby="team-invitations">
        <h2 id="team-invitations" className="text-xl font-semibold">
          {t("invitations.title")}
        </h2>
        {team.invitations.length ? (
          <ul className="space-y-3">
            {team.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm"
              >
                <div className="space-y-1">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-muted-foreground">
                    {t("invitations.meta", {
                      name: invitation.invitedBy,
                      date: formatDate(invitation.createdAt),
                    })}
                  </p>
                  {invitation.state === "pending" && (
                    <p className="text-muted-foreground">
                      {t("invitations.expires", { date: formatDate(invitation.expiresAt) })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{t(`invitations.state.${invitation.state}`)}</Badge>
                  {invitation.state === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(invitation.id)}
                    >
                      {t("invitations.cancel")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("invitations.empty")}</p>
        )}
        {cancel.isError && (
          <p role="alert" className="text-sm text-destructive">
            {cancelFailure}
          </p>
        )}
      </section>
      <section className="space-y-2 rounded-xl border border-border p-5">
        <h2 className="font-semibold">{t("terms")}</h2>
        <p className="text-sm text-muted-foreground">{t("termsDescription")}</p>
        <Link to="/commercial-conditions" className="text-sm font-medium underline">
          {t("partner:nav.commercial")}
        </Link>
      </section>
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {removing && <RemovalDialog member={removing} onClose={() => setRemoving(null)} />}
    </>
  );
}
