import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

export function InsuranceLeadAction({
  identity,
  requestId,
  personId,
  profileId,
  name,
}: {
  identity: IdentityMe;
  requestId: string;
  personId: string;
  profileId: string | null;
  name: string;
}) {
  const { t } = useTranslation("insuranceRequests");
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [checked, setChecked] = useState(false),
    [error, setError] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  const root = [
    "private",
    identity.user.id,
    identity.session.id,
    "insurance-lead-links",
    requestId,
  ];
  const query = useQuery({
    queryKey: root,
    queryFn: ({ signal }) => partnerApi.insuranceLinks(requestId, signal),
    enabled: !!profileId,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: (q) => (q.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  const person = query.data?.people.find((item) => item.personId === personId);
  if (!profileId) return <p className="text-sm text-muted-foreground">{t("lead.noOwner")}</p>;
  if (query.isPending)
    return (
      <p className="text-sm" role="status">
        {t("loading")}
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{t("lead.loadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  if (!person) return <p className="text-sm text-muted-foreground">{t("lead.unavailable")}</p>;
  if (person.leadId)
    return (
      <Button variant="outline" asChild>
        <Link to="/offers" search={{ lead: person.leadId, profile: person.profileId }}>
          {t("lead.open")}
        </Link>
      </Button>
    );
  if (person.status === "closed")
    return <p className="text-sm text-muted-foreground">{t("lead.closed")}</p>;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setChecked(false);
          setError(false);
        }}
      >
        {t("lead.start")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent
          closeLabel={t("lead.close")}
          showCloseButton={!pending}
          className="max-h-[90svh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{t("lead.title", { name })}</DialogTitle>
            <DialogDescription>{t("lead.description")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!checked || pending) return;
              setPending(true);
              setError(false);
              void partnerApi
                .linkInsurance(requestId, personId, {
                  csrfToken: identity.csrfToken,
                  idempotencyKey: key,
                })
                .then(async () => {
                  await client.invalidateQueries({
                    queryKey: ["private", identity.user.id, identity.session.id],
                  });
                  setOpen(false);
                })
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={checked}
                disabled={pending}
                className="mt-1 size-4 shrink-0"
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>{t("lead.consent", { name })}</span>
            </label>
            <p className="text-sm text-muted-foreground">{t("lead.limit")}</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t("lead.error")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("lead.close")}
              </Button>
              <Button type="submit" disabled={!checked || pending}>
                {t(pending ? "saving" : "lead.confirm")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
