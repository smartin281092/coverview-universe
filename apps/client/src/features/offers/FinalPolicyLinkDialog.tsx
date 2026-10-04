import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import { leadCommandSchema, type LeadCommand, type LeadDetail } from "@coverview/contracts/partner";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

const schema = z.object({
  documentId: z.string().min(1),
  offerId: z.string().min(1),
  sameObjectConfirmed: z.boolean().refine(Boolean),
  sharingConfirmed: z.boolean().refine(Boolean),
  receivedPolicyConfirmed: z.boolean().refine(Boolean),
});
export function FinalPolicyLinkDialog({
  lead,
  identity,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  identity: IdentityMe;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("offers");
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`policy.${key}`, values);
  const [revision] = useState(lead.revision),
    [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const [error, setError] = useState(""),
    [frozen, setFrozen] = useState(false),
    [conflict, setConflict] = useState(false);
  const attempt = useRef<{ input: LeadCommand; key: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      documentId: "",
      offerId: "",
      sameObjectConfirmed: false,
      sharingConfirmed: false,
      receivedPolicyConfirmed: false,
    },
  });
  const root = ["private", identity.user.id, identity.session.id, "final-policy-link", lead.id];
  const documents = useQuery({
    queryKey: [...root, "documents"],
    queryFn: ({ signal }) => partnerApi.contractCandidates(lead.id, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const cursor = pages.at(-1);
  const offers = useQuery({
    queryKey: [...root, "offers", cursor],
    queryFn: ({ signal }) => partnerApi.offerHistory(lead.id, cursor, signal, true),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const selected = documents.data?.items.find(
    (item) => item.documentId === form.watch("documentId"),
  );
  const offer = offers.data?.items.find((item) => item.id === form.watch("offerId"));
  const pending = form.formState.isSubmitting;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={tr("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{tr("link")}</DialogTitle>
          <DialogDescription>
            {tr("linkHelp", { client: lead.clientName, object: lead.object })}
          </DialogDescription>
        </DialogHeader>
        {documents.isPending || offers.isPending ? (
          <LoadingState label={tr("loading")} />
        ) : documents.isError || offers.isError ? (
          <ErrorState
            title={tr("error")}
            description={tr("error")}
            retryLabel={tr("retry")}
            pendingLabel={tr("loading")}
            onRetry={() => {
              void documents.refetch();
              void offers.refetch();
            }}
          />
        ) : !documents.data.items.length ? (
          <>
            <EmptyState title={tr("emptyDocuments")} description={tr("addHelp")} />
            <Button asChild variant="outline">
              <Link to="/documents" search={{ profile: lead.clientProfileId ?? "self" }}>
                {tr("documents")}
              </Link>
            </Button>
          </>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(async (values) => {
                if (!attempt.current) {
                  if (!selected) return;
                  attempt.current = {
                    key: crypto.randomUUID(),
                    input: leadCommandSchema.parse({
                      action: "final_policy_link",
                      revision,
                      ...values,
                      fingerprint: selected.fingerprint,
                    }),
                  };
                }
                setFrozen(true);
                setError("");
                try {
                  await partnerApi.command(
                    lead.id,
                    attempt.current.input,
                    { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
                    true,
                  );
                  onSaved();
                  onClose();
                } catch (cause) {
                  const blocked =
                    cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
                  setConflict(blocked);
                  setError(tr(blocked ? "conflict" : "retryExact"));
                }
              })(event);
            }}
          >
            <fieldset disabled={pending || frozen} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy-offer">{tr("chooseOffer")}</Label>
                <select
                  id="policy-offer"
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                  {...form.register("offerId")}
                >
                  <option value="">{tr("chooseOffer")}</option>
                  {offers.data.items.map((item) => (
                    <option
                      value={item.id}
                      key={item.id}
                      disabled={item.sourceStatus !== "current"}
                    >
                      {tr("offer", {
                        company: item.company,
                        product: item.product,
                        version: item.version,
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pages.length < 2}
                  onClick={() => {
                    form.setValue("offerId", "");
                    setPages(pages.slice(0, -1));
                  }}
                >
                  {tr("previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!offers.data.nextCursor}
                  onClick={() => {
                    if (offers.data.nextCursor) {
                      form.setValue("offerId", "");
                      setPages([...pages, offers.data.nextCursor]);
                    }
                  }}
                >
                  {tr("next")}
                </Button>
              </div>
              {offer && (
                <div className="space-y-2 text-sm">
                  <p>{tr(offer.active ? "currentOffer" : "historicalOffer")}</p>
                  <Button variant="outline" asChild>
                    <a href={partnerApi.sourceUrl(lead.id, offer.id, true)}>{tr("offerSource")}</a>
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="policy-document">{tr("chooseDocument")}</Label>
                <select
                  id="policy-document"
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                  {...form.register("documentId")}
                >
                  <option value="">{tr("chooseDocument")}</option>
                  {documents.data.items.map((item) => (
                    <option value={item.documentId} key={item.documentId}>
                      {tr("document", {
                        company: item.facts.companyId,
                        number: item.contract.policyNumber ?? tr("missing"),
                        object: item.contract.insuredSubject ?? item.contract.title,
                      })}
                    </option>
                  ))}
                </select>
              </div>
              {selected && (
                <Button asChild variant="outline">
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: selected.documentId }}
                    search={{ profile: lead.clientProfileId ?? "self" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("inspect")}
                  </Link>
                </Button>
              )}
              {(
                ["receivedPolicyConfirmed", "sameObjectConfirmed", "sharingConfirmed"] as const
              ).map((name) => (
                <label key={name} className="flex items-start gap-3 text-sm">
                  <input type="checkbox" {...form.register(name)} className="mt-1" />
                  {tr(name)}
                </label>
              ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">{tr("replaceHelp")}</p>
            {documents.data.truncated && <p className="text-sm">{tr("truncated")}</p>}
            {(error || Object.keys(form.formState.errors).length > 0) && (
              <p role="alert" className="text-sm text-destructive">
                {error || tr("required")}
              </p>
            )}
            <Button type="submit" disabled={pending || conflict || !offer || !selected}>
              {tr(pending ? "saving" : frozen ? "retry" : "confirm")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
