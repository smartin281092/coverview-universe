import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError, type LeadOffer, type LeadDetail } from "@coverview/api-client/partner";
import type { LeadCommand } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@coverview/ui";
import { partnerApi } from "../partner-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { WalletLeadDialog } from "../features/offers/WalletLeadDialog";
const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
function CompareTable({ offers, all }: { offers: LeadOffer[]; all: boolean }) {
  const { t } = useTranslation("offers");
  const keys = [
    ...new Set(
      offers.flatMap((offer) =>
        offer.features.map((feature) =>
          feature.key === "other" ? `other:${feature.label}` : feature.key,
        ),
      ),
    ),
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-4">{t("compare")}</th>
            {offers.map((offer) => (
              <th key={offer.id} className="max-w-72 p-4">
                <p>{offer.company}</p>
                <p className="mt-1 font-normal text-muted-foreground">{offer.product}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <th className="p-4">{t("premium")}</th>
            {offers.map((offer) => (
              <td key={offer.id} className="p-4 font-semibold">
                {offer.annualPremiumMinor === null ? t("missing") : money(offer.annualPremiumMinor)}
              </td>
            ))}
          </tr>
          {(all ? keys : keys.slice(0, 6)).map((key) => {
            const matches = (offer: LeadOffer) =>
              offer.features.filter(
                (feature) =>
                  (feature.key === "other" ? `other:${feature.label}` : feature.key) === key,
              );
            const label = offers.flatMap(matches)[0]?.label;
            return (
              <tr key={key} className="border-t border-border">
                <th className="max-w-52 p-4 align-top font-medium">{label}</th>
                {offers.map((offer) => {
                  const features = matches(offer);
                  return (
                    <td key={offer.id} className="max-w-80 p-4 align-top">
                      {features.length
                        ? features.map((feature, index) => (
                            <div key={index} className="space-y-2">
                              <p>
                                {feature.verification === "missing" || feature.origin === "missing"
                                  ? t("missing")
                                  : feature.value || t("missing")}
                              </p>
                              {feature.verification === "to_verify" && (
                                <Badge variant="outline">{t("uncertain")}</Badge>
                              )}
                              {feature.conditions && (
                                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                  {feature.conditions}
                                </p>
                              )}
                              {all && feature.source && (
                                <p className="text-xs text-muted-foreground">{feature.source}</p>
                              )}
                            </div>
                          ))
                        : t("missing")}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Offers({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("offers"),
    { scope } = useWalletProfileScope(),
    search = useSearch({ from: "/offers" }),
    navigate = useNavigate({ from: "/offers" }),
    client = useQueryClient();
  const [cursor, setCursor] = useState<string>(),
    [choice, setChoice] = useState<{
      type: "select" | "question" | "modification" | "keep_current";
      offer?: LeadOffer;
    } | null>(null),
    [detailed, setDetailed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [create, setCreate] = useState(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    root = ["private", identity.user.id, identity.session.id, "wallet-leads", scope];
  const list = useQuery({
    queryKey: [...root, cursor],
    queryFn: ({ signal }) =>
      partnerApi.list(
        {
          view: "all",
          ...(scope === "all" ? {} : { clientProfileId: scope }),
          ...(cursor ? { cursor } : {}),
        },
        signal,
        true,
      ),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  const detail = useQuery({
    queryKey: [...root, "lead", search.lead],
    queryFn: ({ signal }) => partnerApi.lead(search.lead!, signal, true),
    enabled: !!search.lead,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: pending ? false : 10000,
    retry: false,
  });
  const lead = detail.data,
    offers =
      lead?.offers.filter(
        (offer) => offer.active && !["cancelled", "replaced"].includes(offer.state),
      ) ?? [];
  async function send(command: LeadCommand) {
    if (!lead || pending) return;
    setError("");
    setPending(true);
    const payload = JSON.stringify(command);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await partnerApi.command(
        lead.id,
        command,
        { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
        true,
      );
      client.setQueryData([...root, "lead", lead.id], result);
      await client.invalidateQueries({ queryKey: root });
      if (command.action !== "client_choice" || command.choice !== "view") setChoice(null);
      setSuccess(command.action === "client_choice" && command.choice === "select");
      attempt.current = null;
    } catch (cause) {
      setError(
        cause instanceof PartnerApiError && cause.status === 409
          ? t("conflict")
          : cause instanceof PartnerApiError && cause.code === "PARTNER_OFFER_EXPIRED"
            ? t("expired")
            : t("error"),
      );
    } finally {
      setPending(false);
    }
  }
  function inspect(offer: LeadOffer) {
    setChoice({ type: "select", offer });
    setSuccess(false);
    if (lead && offer.state === "published")
      void send({
        action: "client_choice",
        revision: lead.revision,
        choice: "view",
        offerId: offer.id,
        text: "",
      });
  }
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => setCreate(true)}>
          <Plus className="mr-2 size-4" />
          {t("newRequest")}
        </Button>
      </header>
      {list.isPending ? (
        <LoadingState label={t("loading")} />
      ) : list.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void list.refetch()}
        />
      ) : !list.data.items.length ? (
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-xl border p-6 text-left ${search.lead === item.id ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => {
                setSuccess(false);
                setError("");
                void navigate({ search: (previous) => ({ ...previous, lead: item.id }) });
              }}
            >
              <p className="text-xs text-muted-foreground">{item.clientName}</p>
              <h2 className="mt-2 font-semibold">{item.title}</h2>
              {item.object && <p className="mt-2 text-sm text-muted-foreground">{item.object}</p>}
              <span className="mt-5 inline-flex items-center gap-2 text-sm">
                {t("open")}
                <ArrowUpRight className="size-4" />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor(undefined)}>
            {t("back")}
          </Button>
        )}
        {list.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(list.data.nextCursor!)}>
            {t("next")}
          </Button>
        )}
      </div>
      <Dialog
        open={!!search.lead}
        onOpenChange={(open) => {
          if (!open && !pending)
            void navigate({
              search: (previous) => {
                const rest = { ...previous };
                delete rest.lead;
                return rest;
              },
            });
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-6xl"
          showCloseButton={!pending}
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{lead?.title ?? t("title")}</DialogTitle>
            <DialogDescription>
              {lead ? `${lead.clientName} · ${lead.object}` : t("subtitle")}
            </DialogDescription>
          </DialogHeader>
          {detail.isPending ? (
            <LoadingState label={t("loading")} />
          ) : detail.isError ? (
            <ErrorState
              title={t("error")}
              description={t("error")}
              retryLabel={t("retry")}
              pendingLabel={t("loading")}
              onRetry={() => void detail.refetch()}
            />
          ) : (
            lead && (
              <>
                {offers.length ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {offers.map((offer) => (
                        <article key={offer.id} className="rounded-xl border border-border p-5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">{offer.company}</p>
                            <Badge variant="outline">{t(`state.${offer.state}`)}</Badge>
                          </div>
                          <h3 className="mt-2 font-semibold">{offer.product}</h3>
                          <p className="mt-4 text-2xl font-medium">
                            {offer.annualPremiumMinor === null
                              ? t("missing")
                              : money(offer.annualPremiumMinor)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{t("premium")}</p>
                          {offer.validUntil && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {t("validity", { date: date(offer.validUntil) })}
                            </p>
                          )}
                          {offer.summary && (
                            <p className="mt-4 whitespace-pre-wrap text-sm">{offer.summary}</p>
                          )}
                          {offer.limitations && (
                            <div className="mt-4 rounded-md bg-muted p-3">
                              <h4 className="text-xs font-semibold">{t("limitations")}</h4>
                              <p className="mt-2 whitespace-pre-wrap text-xs">
                                {offer.limitations}
                              </p>
                            </div>
                          )}
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={
                                pending ||
                                !["published", "viewed", "selected"].includes(offer.state) ||
                                (!!offer.validUntil &&
                                  new Date(offer.validUntil).getTime() < Date.now()) ||
                                lead.stage === "completed"
                              }
                              onClick={() => inspect(offer)}
                            >
                              {t(offer.state === "selected" ? "selected" : "choose")}
                            </Button>
                            <Button size="sm" asChild variant="outline">
                              <a href={partnerApi.sourceUrl(lead.id, offer.id, true)}>
                                <FileText className="mr-1 size-3.5" />
                                {t("source")}
                              </a>
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs">
                            <button
                              type="button"
                              disabled={pending || lead.stage === "completed"}
                              className="underline underline-offset-4"
                              onClick={() => setChoice({ type: "question", offer })}
                            >
                              {t("question")}
                            </button>
                            <button
                              type="button"
                              disabled={pending || lead.stage === "completed"}
                              className="underline underline-offset-4"
                              onClick={() => setChoice({ type: "modification", offer })}
                            >
                              {t("modification")}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <CompareTable offers={offers} all={false} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button variant="outline" onClick={() => setDetailed(true)}>
                        {t("detailed")}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending || lead.stage === "completed"}
                        onClick={() => setChoice({ type: "keep_current" })}
                      >
                        {t("keep")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("noReference")}</p>
                  </>
                ) : (
                  <EmptyState title={t("noOffers")} description={t("noOffersDescription")} />
                )}{" "}
                {success && (
                  <div role="status" className="rounded-lg bg-muted p-4 text-sm">
                    <p className="font-semibold">{t("selected")}</p>
                    <p className="mt-2">{t("selectedDescription")}</p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={detailed} onOpenChange={setDetailed}>
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-6xl"
          showCloseButton
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{t("detailed")}</DialogTitle>
            <DialogDescription>{lead?.title}</DialogDescription>
          </DialogHeader>
          <CompareTable offers={offers} all />
        </DialogContent>
      </Dialog>
      <ChoiceDialog
        choice={choice}
        lead={lead}
        pending={pending}
        error={error}
        onClose={() => setChoice(null)}
        onSend={send}
      />
      <WalletLeadDialog
        identity={identity}
        open={create}
        onClose={() => setCreate(false)}
        onCreated={(id) => {
          void client.invalidateQueries({ queryKey: root });
          void navigate({ search: (previous) => ({ ...previous, lead: id }) });
        }}
      />
    </>
  );
}
function ChoiceDialog({
  choice,
  lead,
  pending,
  error,
  onClose,
  onSend,
}: {
  choice: {
    type: "select" | "question" | "modification" | "keep_current";
    offer?: LeadOffer;
  } | null;
  lead: LeadDetail | undefined;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSend: (command: LeadCommand) => Promise<void>;
}) {
  const { t } = useTranslation("offers");
  return (
    <Dialog
      open={!!choice}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={!pending} closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>
            {t(
              choice?.type === "select"
                ? "confirmTitle"
                : choice?.type === "keep_current"
                  ? "keep"
                  : (choice?.type ?? "question"),
            )}
          </DialogTitle>
          <DialogDescription>
            {t(choice?.type === "select" ? "confirmDescription" : "subtitle")}
          </DialogDescription>
        </DialogHeader>
        {choice && lead && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void onSend({
                action: "client_choice",
                revision: lead.revision,
                choice: choice.type,
                ...(choice.offer ? { offerId: choice.offer.id } : {}),
                text:
                  typeof data.get("message") === "string" ? (data.get("message") as string) : "",
              });
            }}
          >
            {choice.offer && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-semibold">
                  {choice.offer.company}
                  {" · "}
                  {choice.offer.product}
                </p>
                <p className="mt-2">
                  {choice.offer.annualPremiumMinor === null
                    ? t("missing")
                    : money(choice.offer.annualPremiumMinor)}
                </p>
                {choice.offer.effectiveDate && (
                  <p className="mt-2 text-sm">
                    {t("effect", { date: date(choice.offer.effectiveDate) })}
                  </p>
                )}
                <a
                  className="mt-3 inline-flex text-sm underline"
                  href={partnerApi.sourceUrl(lead.id, choice.offer.id, true)}
                >
                  {t("source")}
                </a>
              </div>
            )}
            {choice.type !== "select" && (
              <label className="block space-y-2 text-sm">
                <span>{t("message")}</span>
                <textarea
                  name="message"
                  required={choice.type !== "keep_current"}
                  maxLength={2000}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-3"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t(choice.type === "select" ? "confirm" : "send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function OffersPage() {
  return <IdentityBoundary>{(identity) => <Offers identity={identity} />}</IdentityBoundary>;
}
