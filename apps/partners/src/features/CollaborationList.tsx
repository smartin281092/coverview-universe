import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  type Collaboration,
  type CollaborationResponse,
  collaborationResponseSchema,
} from "@coverview/contracts/partner";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  EmptyState,
  Label,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate } from "./Field";

export function CollaborationList({ items }: { items: Collaboration[] }) {
  const { t } = useTranslation(),
    session = usePartner(),
    cache = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState(0),
    [invalid, setInvalid] = useState(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    item = items.find((value) => value.id === selected);
  const respond = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CollaborationResponse }) => {
      const payload = JSON.stringify({ id, input });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.respondCollaboration(id, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: async () => {
      attempt.current = null;
      setSelected(null);
      await cache.invalidateQueries({ queryKey: session.queryKey });
    },
    retry: false,
  });
  return (
    <>
      {!items.length ? (
        <EmptyState title={t("collaboration.empty")} description={t("collaboration.emptyHelp")} />
      ) : (
        <div className="space-y-3">
          {items.slice(page * 10, (page + 1) * 10).map((c) => (
            <article
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5"
            >
              <div>
                <h3 className="font-medium">
                  {c.proposerName}
                  {" → "}
                  {c.targetName}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`collaboration.mode.${c.terms.mode}`)}
                  {" · "}
                  {t(`category.${c.category}`)}
                  {" · "}
                  {formatDate(c.createdAt)}
                </p>
              </div>
              <Badge variant="outline">{t(`collaboration.state.${c.state}`)}</Badge>
              <Button
                variant="outline"
                onClick={() => {
                  setInvalid(false);
                  respond.reset();
                  setSelected(c.id);
                }}
              >
                {t("collaboration.inspect")}
              </Button>
            </article>
          ))}
        </div>
      )}
      {items.length > 10 && (
        <div className="flex gap-3">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t("collaboration.previous")}
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 10 >= items.length}
            onClick={() => setPage(page + 1)}
          >
            {t("collaboration.next")}
          </Button>
        </div>
      )}
      {item && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !respond.isPending) setSelected(null);
          }}
        >
          <DialogContent
            className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
            showCloseButton={!respond.isPending}
            closeLabel={t("close")}
          >
            <DialogHeader>
              <DialogTitle>{t(`collaboration.mode.${item.terms.mode}`)}</DialogTitle>
              <DialogDescription>
                {item.proposerName}
                {" → "}
                {item.targetName}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t(`collaboration.help.${item.terms.mode}`)}
            </p>
            <dl className="space-y-4 text-sm">
              {(["scope", "responsibilities", "reason", "economicNote"] as const).map((name) => (
                <div key={name}>
                  <dt className="font-medium">{t(`collaboration.${name}`)}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {item.terms[name]}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="font-medium">{t("collaboration.accessLabel")}</dt>
                <dd>{t(`collaboration.access.${item.terms.access}`)}</dd>
              </div>
              <div>
                <dt className="font-medium">{t("collaboration.communicationLabel")}</dt>
                <dd>{t(`collaboration.communication.${item.terms.communication}`)}</dd>
              </div>
              {item.response && (
                <div>
                  <dt className="font-medium">{t("collaboration.response")}</dt>
                  <dd className="whitespace-pre-wrap">{item.response}</dd>
                </div>
              )}
            </dl>
            <p className="text-sm text-muted-foreground">{t("collaboration.economicsNotice")}</p>
            {(item.canRespond || item.canEnd) && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (respond.isPending) return;
                  const data = new FormData(e.currentTarget, e.nativeEvent.submitter);
                  const parsed = collaborationResponseSchema.safeParse({
                    revision: item.revision,
                    decision: data.get("decision"),
                    reason: data.get("reason"),
                  });
                  setInvalid(!parsed.success);
                  if (parsed.success) respond.mutate({ id: item.id, input: parsed.data });
                }}
              >
                <Label htmlFor="collaboration-response">{t("collaboration.response")}</Label>
                <textarea
                  id="collaboration-response"
                  name="reason"
                  required
                  maxLength={4000}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                />
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required className="mt-1" />
                  {t("collaboration.acknowledge")}
                </label>
                <div className="flex flex-wrap gap-3">
                  {item.canRespond && (
                    <>
                      <Button disabled={respond.isPending} name="decision" value="accept">
                        {t("collaboration.accept")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={respond.isPending}
                        name="decision"
                        value="decline"
                      >
                        {t("collaboration.decline")}
                      </Button>
                    </>
                  )}
                  {item.canEnd && (
                    <Button
                      variant="outline"
                      disabled={respond.isPending}
                      name="decision"
                      value={item.state === "proposed" ? "cancel" : "end"}
                    >
                      {t(item.state === "proposed" ? "collaboration.cancel" : "collaboration.end")}
                    </Button>
                  )}
                </div>
              </form>
            )}
            {(invalid || respond.isError) && (
              <p role="alert" className="text-sm text-destructive">
                {t("collaboration.error")}
              </p>
            )}
            {item.canOpenLead && (
              <Button asChild variant="outline">
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: item.leadId }}
                  onClick={() => setSelected(null)}
                >
                  {t("collaboration.openLead")}
                </Link>
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
