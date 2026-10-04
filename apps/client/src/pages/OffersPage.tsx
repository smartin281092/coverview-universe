import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError, type LeadOffer } from "@coverview/api-client/partner";
import type { LeadCommand } from "@coverview/contracts/partner";
import { PracticeSummaryDialog } from "../features/offers/PracticeSummaryDialog";
import { AdvicePreferencesDialog } from "../features/offers/AdvicePreferencesDialog";
import { SharedAppointmentsDialog } from "../features/offers/SharedAppointmentsDialog";
import { WalletAppointmentsDialog } from "../features/offers/WalletAppointmentsDialog";
import { CoordinatedBookingsDialog } from "../features/offers/CoordinatedBookingsDialog";
import { ReferentAssessmentDialog } from "../features/offers/ReferentAssessmentDialog";
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
import { ChoiceDialog, type WalletChoice } from "../features/offers/ChoiceDialog";
import { WalletLeadDialog } from "../features/offers/WalletLeadDialog";
import { ContractComparison } from "../features/offers/ContractComparison";
import { ContractLinkDialog } from "../features/offers/ContractLinkDialog";
import { OfferHistoryDialog } from "../features/offers/OfferHistoryDialog";
import { FinalPoliciesDialog } from "../features/offers/FinalPoliciesDialog";
import { ReferentsDialog } from "../features/offers/ReferentsDialog";
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
    [choice, setChoice] = useState<WalletChoice | null>(null),
    [retryCommand, setRetryCommand] = useState<LeadCommand | null>(null),
    [detailed, setDetailed] = useState(false),
    [history, setHistory] = useState(false),
    [policies, setPolicies] = useState(false),
    [referents, setReferents] = useState<{ profile: string; category?: string } | null>(null),
    [advice, setAdvice] = useState<string | null>(null),
    [sharedAppointments, setSharedAppointments] = useState<string | null>(null),
    [appointments, setAppointments] = useState<string | null>(null),
    [coordination, setCoordination] = useState(false),
    [referentAssessment, setReferentAssessment] = useState<string | null>(null),
    [linkContract, setLinkContract] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<string | null>(null),
    [interlocutorSent, setInterlocutorSent] = useState(false),
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
    const payload = JSON.stringify({ leadId: lead.id, command });
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
      setSuccess(
        command.action === "client_choice" && command.choice !== "view" ? command.choice : null,
      );
      setInterlocutorSent(command.action === "client_interlocutor");
      attempt.current = null;
      setRetryCommand(null);
      return result;
    } catch (cause) {
      setRetryCommand(!(cause instanceof PartnerApiError) || cause.status >= 500 ? command : null);
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
  async function openChoice(type: WalletChoice["type"], offer?: LeadOffer) {
    if (!lead || pending || detail.isError) return;
    setError("");
    setSuccess(null);
    setInterlocutorSent(false);
    setRetryCommand(null);
    attempt.current = null;
    let presented = lead;
    if (type === "select" && offer?.state === "published") {
      const result = await send({
        action: "client_choice",
        revision: lead.revision,
        choice: "view",
        offerId: offer.id,
        text: "",
      });
      if (!result) return;
      presented = result;
    }
    setChoice({ type, lead: presented, scope, ...(offer ? { offer } : {}) });
  }
  return (
    <>
      {coordination && (
        <CoordinatedBookingsDialog
          key={`${identity.user.id}:${identity.session.id}:${scope}`}
          identity={identity}
          scope={scope}
          onClose={() => setCoordination(false)}
        />
      )}
      {appointments && (
        <WalletAppointmentsDialog
          key={`${identity.user.id}:${identity.session.id}:${appointments}`}
          identity={identity}
          leadId={appointments}
          onClose={() => setAppointments(null)}
        />
      )}
      {sharedAppointments && (
        <SharedAppointmentsDialog
          key={`${identity.user.id}:${identity.session.id}:${sharedAppointments}`}
          identity={identity}
          leadId={sharedAppointments}
          onClose={() => setSharedAppointments(null)}
        />
      )}
      {referentAssessment && (
        <ReferentAssessmentDialog
          key={`${identity.user.id}:${identity.session.id}:${referentAssessment}`}
          identity={identity}
          leadId={referentAssessment}
          onClose={() => setReferentAssessment(null)}
        />
      )}
      {advice && (
        <AdvicePreferencesDialog
          identity={identity}
          leadId={advice}
          onClose={() => setAdvice(null)}
        />
      )}
      {referents && (
        <ReferentsDialog
          identity={identity}
          initialProfile={referents.profile}
          {...(referents.category ? { initialCategory: referents.category } : {})}
          onClose={() => setReferents(null)}
        />
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link
            to="/offers/notifications"
            search={{ status: "all", ...(scope === "all" ? {} : { clientProfileId: scope }) }}
          >
            {t("notifications")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/insurance-requests" search={{ profile: scope }}>
            {t("resumeInsurance")}
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setCreate(true)}>
          <Plus className="mr-2 size-4" />
          {t("newRequest")}
        </Button>
        <Button variant="outline" onClick={() => setReferents({ profile: scope })}>
          {t("referents.title")}
        </Button>
        <Button variant="outline" onClick={() => setCoordination(true)}>
          {t("coordination.title")}
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
                setSuccess(null);
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
        open={!!search.lead && !sharedAppointments && !appointments}
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
                <Button variant="outline" disabled={pending} onClick={() => setAdvice(lead.id)}>
                  {t("advice.title")}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setAppointments(lead.id)}
                >
                  {t("appointments.title")}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setSharedAppointments(lead.id)}
                >
                  {t("appointmentLinks.shared")}
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {t("referent", { name: lead.responsibleName ?? t("coverviewQueue") })}
                    </p>
                    {lead.participants
                      .filter((p) => p.id !== lead.responsibleId)
                      .map((p) => (
                        <p className="mt-1 text-sm text-muted-foreground" key={p.id}>
                          {t("coAdvisor", { name: p.name })}
                        </p>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    disabled={pending || lead.stage === "completed"}
                    onClick={() => {
                      setInterlocutorSent(false);
                      void openChoice("interlocutor");
                    }}
                  >
                    {t("interlocutor")}
                  </Button>
                </div>
                {interlocutorSent && (
                  <p role="status" className="text-sm">
                    {t("interlocutorSent")}
                  </p>
                )}
                {lead.referentContinuity && (
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <p className="text-sm font-medium">
                      {t("referents.categorySelection", {
                        category: t(`categories.${lead.category}`),
                        name:
                          lead.referentContinuity.selection.advisor?.name ??
                          t("referents.noReferent"),
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(`referents.status.${lead.referentContinuity.selection.status}`)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(`referents.continuity.${lead.referentContinuity.status}`)}
                    </p>
                    {lead.referentContinuity.competence && (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          {t("referents.competence", {
                            status: t(
                              `referents.competenceStatus.${lead.referentContinuity.competence.status}`,
                            ),
                          })}
                        </p>
                        {lead.referentContinuity.competence.scope && (
                          <p className="whitespace-pre-wrap">
                            {t("referents.competenceScope", {
                              scope: lead.referentContinuity.competence.scope,
                            })}
                          </p>
                        )}
                        {lead.referentContinuity.competence.validUntil && (
                          <p>
                            {t("referents.competenceUntil", {
                              date: date(lead.referentContinuity.competence.validUntil),
                            })}
                          </p>
                        )}
                        <p>{t("referents.competenceLimits")}</p>
                      </div>
                    )}
                    {lead.referentContinuity.practice && (
                      <PracticeSummaryDialog value={lead.referentContinuity.practice} />
                    )}
                    <Button variant="outline" onClick={() => setReferentAssessment(lead.id)}>
                      {t("referentAssessment.title")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        setReferents({
                          profile: lead.clientProfileId ?? "self",
                          category: lead.category,
                        })
                      }
                    >
                      {t("referents.change")}
                    </Button>
                  </div>
                )}
                {lead.insuranceRequestId && (
                  <Button variant="outline" asChild>
                    <Link
                      to="/insurance-requests/$requestId"
                      params={{ requestId: lead.insuranceRequestId }}
                      search={{ profile: lead.clientProfileId ?? "self" }}
                    >
                      {t("originalInsuranceRequest")}
                    </Link>
                  </Button>
                )}
                <ContractComparison lead={lead} />
                <Button variant="outline" onClick={() => setHistory(true)}>
                  {t("history.title")}
                </Button>
                <Button variant="outline" onClick={() => setPolicies(true)}>
                  {t("policy.title")}
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={pending || lead.stage === "completed"}
                    onClick={() => setLinkContract(true)}
                  >
                    {t("contract.link")}
                  </Button>
                  {lead.currentContract && (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        void send({
                          action: "contract_unlink",
                          referenceId: lead.currentContract!.referenceId,
                          revision: lead.revision,
                        })
                      }
                    >
                      {t("contract.unlink")}
                    </Button>
                  )}
                </div>
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("version", { version: offer.version })}
                          </p>
                          {offer.updatedSinceViewed && (
                            <p className="mt-2 text-sm">{t("updatedSinceViewed")}</p>
                          )}
                          {offer.sourceStatus !== "current" && (
                            <p role="status" className="mt-3 text-sm">
                              {t(`history.sourceStatus.${offer.sourceStatus ?? "unbound"}`)}
                            </p>
                          )}
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
                                !offer.canChoose ||
                                !["published", "viewed", "selected"].includes(offer.state) ||
                                (!!offer.validUntil &&
                                  new Date(offer.validUntil).getTime() < Date.now()) ||
                                lead.stage === "completed"
                              }
                              onClick={() => void openChoice("select", offer)}
                            >
                              {t(offer.state === "selected" ? "selected" : "choose")}
                            </Button>
                            {offer.canDownload && (
                              <Button size="sm" asChild variant="outline">
                                <a href={partnerApi.sourceUrl(lead.id, offer.id, true)}>
                                  <FileText className="mr-1 size-3.5" />
                                  {t("source")}
                                </a>
                              </Button>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs">
                            <button
                              type="button"
                              disabled={pending || !offer.canChoose || lead.stage === "completed"}
                              className="underline underline-offset-4"
                              onClick={() => void openChoice("question", offer)}
                            >
                              {t("question")}
                            </button>
                            <button
                              type="button"
                              disabled={pending || !offer.canChoose || lead.stage === "completed"}
                              className="underline underline-offset-4"
                              onClick={() => void openChoice("modification", offer)}
                            >
                              {t("modification")}
                            </button>
                            <button
                              type="button"
                              disabled={pending || !offer.canChoose || lead.stage === "completed"}
                              className="underline underline-offset-4 disabled:opacity-50"
                              onClick={() => void openChoice("refuse", offer)}
                            >
                              {t("refuse")}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <CompareTable offers={offers.filter((offer) => offer.canCompare)} all={false} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button variant="outline" onClick={() => setDetailed(true)}>
                        {t("detailed")}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending || lead.stage === "completed"}
                        onClick={() => void openChoice("keep_current")}
                      >
                        {t("keep")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState title={t("noOffers")} description={t("noOffersDescription")} />
                )}{" "}
                {success && (
                  <div role="status" className="rounded-lg bg-muted p-4 text-sm">
                    <p className="font-semibold">{t("decision.saved")}</p>
                    <p className="mt-2">{t(`decision.success.${success}`)}</p>
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
      {linkContract && lead && (
        <ContractLinkDialog
          key={lead.id}
          lead={lead}
          identity={identity}
          onClose={() => setLinkContract(false)}
          onSaved={(value) => {
            client.setQueryData([...root, "lead", lead.id], value);
            void client.invalidateQueries({ queryKey: root });
          }}
        />
      )}
      {history && lead && (
        <OfferHistoryDialog
          key={lead.id}
          leadId={lead.id}
          identity={identity}
          onClose={() => setHistory(false)}
        />
      )}
      {policies && lead && !detail.isError && (
        <FinalPoliciesDialog
          key={lead.id}
          lead={lead}
          identity={identity}
          onClose={() => setPolicies(false)}
          onSaved={() => {
            void client.invalidateQueries({ queryKey: root });
          }}
        />
      )}
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
          <CompareTable offers={offers.filter((offer) => offer.canCompare)} all />
        </DialogContent>
      </Dialog>
      <ChoiceDialog
        key={
          choice
            ? `${choice.lead.id}:${choice.lead.revision}:${choice.type}:${choice.offer?.id ?? ""}`
            : "none"
        }
        choice={
          choice?.scope === scope && choice.lead.id === search.lead && !detail.isError
            ? choice
            : null
        }
        lead={lead}
        pending={pending}
        error={error}
        retryCommand={retryCommand}
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
export function OffersPage() {
  return <IdentityBoundary>{(identity) => <Offers identity={identity} />}</IdentityBoundary>;
}
