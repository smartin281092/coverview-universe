import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, FileText } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError, type LeadOffer } from "@coverview/api-client/partner";
import type { LeadCommand } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ErrorState,
  LoadingState,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { AdvicePreferencesDialog } from "./AdvicePreferencesDialog";
import { AdvisorProfileDialog } from "./AdvisorProfileDialog";
import { ChoiceDialog, type WalletChoice } from "./ChoiceDialog";
import { ConclusionsDialog } from "./ConclusionsDialog";
import { ContractLinkDialog } from "./ContractLinkDialog";
import { FinalPoliciesDialog } from "./FinalPoliciesDialog";
import { LeadRelationshipsDialog } from "./LeadRelationshipsDialog";
import { LeadReopeningsDialog } from "./LeadReopeningsDialog";
import { MarketMandatesDialog } from "./MarketMandatesDialog";
import { OfferHistoryDialog } from "./OfferHistoryDialog";
import { OfferMatrix } from "./OfferMatrix";
import { OrientationPanel } from "./OrientationPanel";
import { RecommendationCard } from "./RecommendationCard";
import { ReferentAssessmentDialog } from "./ReferentAssessmentDialog";
import { ReferentsDialog } from "./ReferentsDialog";
import { SharedAppointmentsDialog } from "./SharedAppointmentsDialog";
import { WalletAppointmentsDialog } from "./WalletAppointmentsDialog";
import { WalletCommunicationsDialog } from "./WalletCommunicationsDialog";
import { ComplementBanner, WalletComplementsDialog } from "./WalletComplements";
import { WalletQualityDialog } from "./WalletQualityDialog";

export type LeadSection = "quality" | "communications" | "conclusion" | "complement";
const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const day = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
/** The address of a page with a request (and one of its sections) open, or none. */
export function requestSearch<T extends { lead?: string; section?: LeadSection }>(
  previous: T,
  lead?: string,
  section?: LeadSection,
): T {
  const next = { ...previous };
  delete next.lead;
  delete next.section;
  return { ...next, ...(lead ? { lead } : {}), ...(lead && section ? { section } : {}) };
}
/** The query key shared by the request lists, so that a change refreshes them. */
export const walletLeadsKey = (identity: IdentityMe, scope: string) => [
  "private",
  identity.user.id,
  identity.session.id,
  "wallet-leads",
  scope,
];

/**
 * A request as the client follows it (8 October 2026): the advisor, the offers with their
 * documents and the current contract. Everything else sits in one "other actions" menu.
 */
export function LeadWorkspace({
  identity,
  leadId,
  section,
  onClose,
  onSectionDone,
}: {
  identity: IdentityMe;
  leadId: string | null;
  section?: LeadSection | undefined;
  onClose: () => void;
  onSectionDone: () => void;
}) {
  const { t } = useTranslation("offers"),
    { scope } = useWalletProfileScope(),
    client = useQueryClient(),
    root = walletLeadsKey(identity, scope);
  const [choice, setChoice] = useState<WalletChoice | null>(null),
    [retryCommand, setRetryCommand] = useState<LeadCommand | null>(null),
    [history, setHistory] = useState(false),
    [reopenings, setReopenings] = useState(false),
    [relationships, setRelationships] = useState(false),
    [policies, setPolicies] = useState(false),
    [conclusionSelection, setConclusionLead] = useState<string | null>(null),
    [referents, setReferents] = useState<{ profile: string; category?: string } | null>(null),
    [advice, setAdvice] = useState<string | null>(null),
    [sharedAppointments, setSharedAppointments] = useState<string | null>(null),
    [advisorProfile, setAdvisorProfile] = useState<string | null>(null),
    [appointments, setAppointments] = useState<string | null>(null),
    [marketMandates, setMarketMandates] = useState<string | null>(null),
    [qualitySelection, setQualityLead] = useState<string | null>(null),
    [communicationsSelection, setCommunicationsLead] = useState<string | null>(null),
    [complementSelection, setComplementLead] = useState<string | null>(null),
    [referentAssessment, setReferentAssessment] = useState<string | null>(null),
    [linkContract, setLinkContract] = useState(false),
    [compare, setCompare] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<string | null>(null),
    [interlocutorSent, setInterlocutorSent] = useState(false);
  const fromSection = (name: LeadSection) => (section === name ? leadId : null);
  const qualityLead = qualitySelection ?? fromSection("quality");
  const communicationsLead = communicationsSelection ?? fromSection("communications");
  const conclusionLead = conclusionSelection ?? fromSection("conclusion");
  const complementLead = complementSelection ?? fromSection("complement");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const detail = useQuery({
    queryKey: [...root, "lead", leadId],
    queryFn: ({ signal }) => partnerApi.lead(leadId!, signal, true),
    enabled: !!leadId,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: pending ? false : 10000,
    retry: false,
  });
  const lead = detail.data,
    offers =
      lead?.offers.filter(
        (offer) => offer.active && !["cancelled", "replaced"].includes(offer.state),
      ) ?? [],
    closed = lead?.stage === "completed";
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
  const sectionClosed = (close: (value: null) => void) => () => {
    close(null);
    onSectionDone();
  };
  const source = lead?.currentContract?.source;
  return (
    <>
      {appointments && (
        <WalletAppointmentsDialog
          key={`${identity.user.id}:${identity.session.id}:${appointments}`}
          identity={identity}
          leadId={appointments}
          onClose={() => setAppointments(null)}
        />
      )}
      {marketMandates && (
        <MarketMandatesDialog
          key={`${identity.user.id}:${identity.session.id}:${marketMandates}`}
          identity={identity}
          leadId={marketMandates}
          onClose={() => setMarketMandates(null)}
        />
      )}
      {complementLead && (
        <WalletComplementsDialog
          key={`${identity.user.id}:${identity.session.id}:${complementLead}`}
          identity={identity}
          leadId={complementLead}
          onClose={sectionClosed(setComplementLead)}
          // The reference contract is confirmed through the usual path, from the request.
          onLinkContract={() => {
            sectionClosed(setComplementLead)();
            setLinkContract(true);
          }}
        />
      )}
      {qualityLead && (
        <WalletQualityDialog
          key={`${identity.user.id}:${identity.session.id}:${qualityLead}`}
          identity={identity}
          leadId={qualityLead}
          onClose={sectionClosed(setQualityLead)}
        />
      )}
      {conclusionLead && (
        <ConclusionsDialog
          key={`${identity.user.id}:${identity.session.id}:${conclusionLead}`}
          identity={identity}
          leadId={conclusionLead}
          onClose={sectionClosed(setConclusionLead)}
        />
      )}
      {communicationsLead && (
        <WalletCommunicationsDialog
          key={`${identity.user.id}:${identity.session.id}:${communicationsLead}`}
          identity={identity}
          leadId={communicationsLead}
          onClose={sectionClosed(setCommunicationsLead)}
        />
      )}
      {advisorProfile && (
        <AdvisorProfileDialog
          userId={advisorProfile}
          queryKey={root}
          onClose={() => setAdvisorProfile(null)}
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
      <Dialog
        open={
          !!leadId &&
          !sharedAppointments &&
          !appointments &&
          !qualityLead &&
          !communicationsLead &&
          !complementLead
        }
        onOpenChange={(open) => {
          if (!open && !pending) onClose();
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-4xl"
          showCloseButton={!pending}
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{lead?.title ?? t("title")}</DialogTitle>
            <DialogDescription>
              {lead
                ? [t(`requestKinds.${lead.requestKind}`), lead.object].filter(Boolean).join(" · ")
                : t("loading")}
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
              <div className="space-y-6">
                <ComplementBanner
                  identity={identity}
                  leadId={lead.id}
                  onOpen={() => setComplementLead(lead.id)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {lead.responsibleName
                        ? t("workspace.advisor", { name: lead.responsibleName })
                        : t("workspace.coverview")}
                    </p>
                    {lead.responsibleId && (
                      <button
                        type="button"
                        className="mt-1 underline underline-offset-4"
                        onClick={() => setAdvisorProfile(lead.responsibleId)}
                      >
                        {t("advisorProfile.open")}
                      </button>
                    )}
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={pending}>
                        {t("workspace.more")}
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>{t("workspace.follow")}</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => setQualityLead(lead.id)}>
                        {t("quality:title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setCommunicationsLead(lead.id)}>
                        {t("communications:title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAppointments(lead.id)}>
                        {t("appointments.title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setSharedAppointments(lead.id)}>
                        {t("appointmentLinks.shared")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAdvice(lead.id)}>
                        {t("advice.title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setMarketMandates(lead.id)}>
                        {t("marketMandates.title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={closed}
                        onSelect={() => void openChoice("interlocutor")}
                      >
                        {t("interlocutor")}
                      </DropdownMenuItem>
                      {lead.referentContinuity && (
                        <>
                          <DropdownMenuItem
                            onSelect={() =>
                              setReferents({
                                profile: lead.clientProfileId ?? "self",
                                category: lead.category,
                              })
                            }
                          >
                            {t("workspace.referentChange")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setReferentAssessment(lead.id)}>
                            {t("referentAssessment.title")}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t("workspace.records")}</DropdownMenuLabel>
                      {lead.insuranceRequestId && (
                        <DropdownMenuItem asChild>
                          <Link
                            to="/insurance-requests/$requestId"
                            params={{ requestId: lead.insuranceRequestId }}
                            search={{ profile: lead.clientProfileId ?? "self" }}
                          >
                            {t("originalInsuranceRequest")}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => setHistory(true)}>
                        {t("history.title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setPolicies(true)}>
                        {t("policy.title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setConclusionLead(lead.id)}>
                        {t("conclusion:title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setReopenings(true)}>
                        {t("lifecycle:title")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRelationships(true)}>
                        {t("relationships:title")}
                      </DropdownMenuItem>
                      {lead.currentContract && (
                        <DropdownMenuItem
                          onSelect={() =>
                            void send({
                              action: "contract_unlink",
                              referenceId: lead.currentContract!.referenceId,
                              revision: lead.revision,
                            })
                          }
                        >
                          {t("contract.unlink")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {interlocutorSent && (
                  <p role="status" className="text-sm">
                    {t("interlocutorSent")}
                  </p>
                )}
                <section className="space-y-4" aria-labelledby="workspace-offers">
                  <h3 id="workspace-offers" className="font-medium">
                    {t("workspace.offers")}
                  </h3>
                  {offers.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {offers.map((offer) => (
                        <article
                          key={offer.id}
                          className="flex flex-col gap-3 rounded-xl border border-border p-5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm text-muted-foreground">{offer.company}</p>
                              <h4 className="font-semibold">{offer.product}</h4>
                            </div>
                            {offer.state === "selected" && (
                              <Badge variant="outline">{t("state.selected")}</Badge>
                            )}
                          </div>
                          <div>
                            <p className="text-2xl font-medium">
                              {offer.annualPremiumMinor === null
                                ? t("missing")
                                : money(offer.annualPremiumMinor)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {offer.annualPremiumMinor === null ? "" : t("workspace.perYear")}
                              {offer.validUntil &&
                                ` · ${t("workspace.validUntil", { date: day(offer.validUntil) })}`}
                            </p>
                          </div>
                          {offer.updatedSinceViewed && (
                            <p className="text-sm">{t("updatedSinceViewed")}</p>
                          )}
                          {offer.sourceStatus && offer.sourceStatus !== "current" && (
                            <p role="status" className="text-sm">
                              {t(`history.sourceStatus.${offer.sourceStatus}`)}
                            </p>
                          )}
                          {offer.summary && (
                            <p className="whitespace-pre-wrap text-sm">{offer.summary}</p>
                          )}
                          {offer.limitations && (
                            <details className="text-sm">
                              <summary className="cursor-pointer">{t("limitations")}</summary>
                              <p className="mt-2 whitespace-pre-wrap text-xs">
                                {offer.limitations}
                              </p>
                            </details>
                          )}
                          <div className="mt-auto flex flex-wrap gap-2">
                            <Button
                              disabled={
                                pending ||
                                !offer.canChoose ||
                                !["published", "viewed", "selected"].includes(offer.state) ||
                                (!!offer.validUntil &&
                                  new Date(offer.validUntil).getTime() < Date.now()) ||
                                closed
                              }
                              onClick={() => void openChoice("select", offer)}
                            >
                              {t(offer.state === "selected" ? "selected" : "choose")}
                            </Button>
                            {offer.canDownload && (
                              <Button variant="outline" asChild>
                                <a href={partnerApi.sourceUrl(lead.id, offer.id, true)}>
                                  <FileText className="size-4" aria-hidden="true" />
                                  {t("source")}
                                </a>
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs">
                            {(["question", "modification", "refuse"] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                disabled={pending || !offer.canChoose || closed}
                                className="underline underline-offset-4 disabled:opacity-50"
                                onClick={() => void openChoice(type, offer)}
                              >
                                {t(type)}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("workspace.noOffers")}</p>
                  )}
                  {offers.length > 0 && lead.recommendation && (
                    <RecommendationCard recommendation={lead.recommendation} />
                  )}
                  {offers.length > 0 && (lead.offerOrientation || lead.offerComparison) && (
                    <Button variant="ghost" onClick={() => setCompare((value) => !value)}>
                      {t(compare ? "workspace.hideComparison" : "workspace.compare")}
                    </Button>
                  )}
                  {compare && lead.offerOrientation && (
                    <OrientationPanel orientation={lead.offerOrientation} offers={offers} />
                  )}
                  {compare && lead.offerComparison && (
                    <OfferMatrix comparison={lead.offerComparison} />
                  )}
                </section>
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <p className="text-sm">
                    {source
                      ? t("workspace.contract", {
                          name: `${source.contract.title} · ${source.facts.companyId}`,
                        })
                      : t("workspace.noContract")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {source && (
                      <Button variant="outline" asChild>
                        <a href={partnerApi.contractSourceUrl(lead.id, true)}>
                          {t("workspace.contractDocument")}
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={pending || closed}
                      onClick={() => setLinkContract(true)}
                    >
                      {t(source ? "workspace.changeContract" : "workspace.chooseContract")}
                    </Button>
                    {offers.length > 0 && (
                      <Button
                        variant="ghost"
                        disabled={pending || closed}
                        onClick={() => void openChoice("keep_current")}
                      >
                        {t("keep")}
                      </Button>
                    )}
                  </div>
                </section>
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
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
      {reopenings && lead && (
        <LeadReopeningsDialog
          identity={identity}
          leadId={lead.id}
          onClose={() => setReopenings(false)}
        />
      )}
      {relationships && lead && (
        <LeadRelationshipsDialog
          key={`${identity.user.id}:${identity.session.id}:${lead.id}`}
          identity={identity}
          leadId={lead.id}
          onClose={() => setRelationships(false)}
        />
      )}
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
      <ChoiceDialog
        key={
          choice
            ? `${choice.lead.id}:${choice.lead.revision}:${choice.type}:${choice.offer?.id ?? ""}`
            : "none"
        }
        choice={
          choice?.scope === scope && choice.lead.id === leadId && !detail.isError ? choice : null
        }
        lead={lead}
        pending={pending}
        error={error}
        retryCommand={retryCommand}
        onClose={() => setChoice(null)}
        onSend={send}
      />
    </>
  );
}
