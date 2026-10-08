import { useState } from "react";
import { useParams, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowUpRight, Phone, Mail, Plus, CalendarDays, Clock3 } from "lucide-react";
import {
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@coverview/ui";
import { PartnerApiError, type LeadOffer } from "@coverview/api-client/partner";
import { usePartner } from "../features/PartnerSession";
import { useLeadCommand } from "../features/use-lead-command";
import { LeadActionDialog, type LeadAction } from "../features/LeadActionDialog";
import { OfferDialog } from "../features/OfferDialog";
import { SolutionEvidenceDialog } from "../features/SolutionEvidenceDialog";
import { OfferImportDialog } from "../features/OfferImportDialog";
import { OfferHistoryDialog } from "../features/OfferHistoryDialog";
import { FinalPoliciesDialog } from "../features/FinalPoliciesDialog";
import { ConclusionsDialog } from "../features/ConclusionsDialog";
import { InsuranceRequestDialog } from "../features/InsuranceRequestDialog";
import { ReferentContinuityDialog } from "../features/ReferentContinuityDialog";
import { AdvisorAssessmentDialog } from "../features/AdvisorAssessmentDialog";
import { AdvicePreferencesDialog } from "../features/AdvicePreferencesDialog";
import { AppointmentAssessmentDialog } from "../features/AppointmentAssessmentDialog";
import { PersonalAppointmentDialog } from "../features/PersonalAppointmentDialog";
import { BookingProposalsDialog } from "../features/BookingProposalsDialog";
import { AppointmentLinksDialog } from "../features/AppointmentLinksDialog";
import { SharedAppointmentsDialog } from "../features/SharedAppointmentsDialog";
import { JointParticipationsPanel } from "../features/JointParticipationsPanel";
import type { LeadDetail } from "@coverview/contracts/partner";
import { OfferWithdrawDialog } from "../features/OfferWithdrawDialog";
import { ContractComparison } from "../features/ContractComparison";
import { OfferMatrix } from "../features/OfferMatrix";
import { OrientationPanel } from "../features/OrientationPanel";
import { RecommendationPanel } from "../features/RecommendationPanel";
import { ComplementPanel } from "../features/ComplementPanel";
import { ContractReviewDialog } from "../features/ContractReviewDialog";
import { CreateLeadDialog } from "../features/CreateLeadDialog";
import { CollaborationDialog } from "../features/CollaborationDialog";
import { MarketPublishDialog } from "../features/MarketPublishDialog";
import { CollaborationList } from "../features/CollaborationList";
import { formatDate, formatMoney } from "../features/Field";
import { adminUrl, partnerApi } from "../api";
import { publicLeadSearch } from "../features/lead-navigation-state";
import { LeadReopeningsDialog } from "../features/LeadReopeningsDialog";
import { LeadRelationshipsDialog } from "../features/LeadRelationshipsDialog";
import { ClientInvitationPanel } from "../features/ClientInvitationPanel";
export function LeadPage() {
  const { leadId } = useParams({ from: "/leads/$leadId" }),
    { tab, section } = useSearch({ from: "/leads/$leadId" }),
    navigate = useNavigate({ from: "/leads/$leadId" }),
    { t } = useTranslation(),
    session = usePartner();
  const leadQuery = useQuery({
    queryKey: [...session.queryKey, "lead", leadId],
    queryFn: ({ signal }) => partnerApi.lead(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  const command = useLeadCommand(leadId),
    [action, setAction] = useState<LeadAction | null>(null),
    [editing, setEditing] = useState(false),
    [reviewContract, setReviewContract] = useState(false),
    [history, setHistory] = useState(false),
    [reopenings, setReopenings] = useState(false),
    [relationships, setRelationships] = useState(false),
    [policies, setPolicies] = useState(false),
    [conclusions, setConclusions] = useState(false),
    [imports, setImports] = useState(false),
    [insuranceSource, setInsuranceSource] = useState(false),
    [referent, setReferent] = useState(false),
    [advice, setAdvice] = useState(false),
    [advisorAssessment, setAdvisorAssessment] = useState(false),
    [solutionOfferId, setSolutionOfferId] = useState<string>(),
    [withdraw, setWithdraw] = useState<LeadOffer | null>(null),
    [collaborating, setCollaborating] = useState(false),
    [publishingMarket, setPublishingMarket] = useState<LeadDetail | null>(null),
    [appointment, setAppointment] = useState<string>(),
    [linkingAppointment, setLinkingAppointment] = useState<string>(),
    [sharedAppointments, setSharedAppointments] = useState(false),
    [bookingProposals, setBookingProposals] = useState<LeadDetail | null>(null),
    [assessedAppointment, setAssessedAppointment] = useState<string>(),
    [rescheduling, setRescheduling] = useState<LeadDetail["appointments"][number]>(),
    [offer, setOffer] = useState<LeadOffer | "new" | null>(null);
  const bookingDialog = bookingProposals && (
    <BookingProposalsDialog
      key={[...session.queryKey, leadId].join(":")}
      lead={leadQuery.data ?? bookingProposals}
      unavailable={leadQuery.isError || leadQuery.isPending}
      onClose={() => setBookingProposals(null)}
    />
  );
  const marketDialog = publishingMarket && (
    <MarketPublishDialog
      lead={publishingMarket}
      enabled={
        !leadQuery.isError &&
        !!leadQuery.data?.canCollaborate &&
        leadQuery.data.revision === publishingMarket.revision
      }
      onClose={() => setPublishingMarket(null)}
    />
  );
  if (leadQuery.isPending)
    return (
      <>
        {bookingDialog}
        {marketDialog}
        <LoadingState label={t("loading")} />
      </>
    );
  if (leadQuery.isError)
    return (
      <>
        {bookingDialog}
        {marketDialog}
        <ErrorState
          title={t("error")}
          description={t("errors.PARTNER_NOT_FOUND")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void leadQuery.refetch()}
        />
      </>
    );
  const lead = leadQuery.data,
    activeTab = lead.availableTabs.includes(tab as (typeof lead.availableTabs)[number])
      ? tab
      : "overview";
  const allowed = (value: string) => lead.allowedActions?.includes(value) ?? lead.canEdit;
  return (
    <>
      {bookingDialog}
      {marketDialog}
      {linkingAppointment && (
        <AppointmentLinksDialog
          key={[...session.queryKey, lead.id, linkingAppointment].join(":")}
          leadId={lead.id}
          appointmentId={linkingAppointment}
          onClose={() => setLinkingAppointment(undefined)}
        />
      )}
      {sharedAppointments && (
        <SharedAppointmentsDialog
          key={[...session.queryKey, lead.id].join(":")}
          leadId={lead.id}
          onClose={() => setSharedAppointments(false)}
        />
      )}
      {rescheduling && (
        <PersonalAppointmentDialog
          key={[...session.queryKey, lead.id, rescheduling.id].join(":")}
          lead={lead}
          appointment={rescheduling}
          onClose={() => setRescheduling(undefined)}
        />
      )}
      {assessedAppointment && (
        <AppointmentAssessmentDialog
          leadId={lead.id}
          appointmentId={assessedAppointment}
          onClose={() => setAssessedAppointment(undefined)}
        />
      )}
      {advice && <AdvicePreferencesDialog leadId={lead.id} onClose={() => setAdvice(false)} />}
      {solutionOfferId && (
        <SolutionEvidenceDialog
          key={[...session.queryKey, lead.id, solutionOfferId].join(":")}
          leadId={lead.id}
          offerId={solutionOfferId}
          onClose={() => setSolutionOfferId(undefined)}
        />
      )}
      {advisorAssessment && (
        <AdvisorAssessmentDialog
          key={[...session.queryKey, lead.id].join(":")}
          leadId={lead.id}
          title={lead.title}
          onClose={() => setAdvisorAssessment(false)}
        />
      )}
      {referent && (
        <ReferentContinuityDialog
          key={[...session.queryKey, lead.id].join(":")}
          lead={lead}
          onClose={() => setReferent(false)}
        />
      )}
      {editing && <CreateLeadDialog open onOpenChange={setEditing} lead={lead} />}
      {collaborating && <CollaborationDialog lead={lead} onClose={() => setCollaborating(false)} />}
      {history && <OfferHistoryDialog leadId={lead.id} onClose={() => setHistory(false)} />}
      {policies && <FinalPoliciesDialog leadId={lead.id} onClose={() => setPolicies(false)} />}
      {(conclusions || section === "conclusion") && (
        <ConclusionsDialog
          key={session.queryKey.join(":")}
          leadId={lead.id}
          onClose={() => {
            setConclusions(false);
            if (section) void navigate({ search: { tab: tab ?? "offers" } });
          }}
        />
      )}
      {imports && <OfferImportDialog lead={lead} onClose={() => setImports(false)} />}
      {insuranceSource && lead.insuranceRequestId && lead.access === "operational" && (
        <InsuranceRequestDialog leadId={lead.id} onClose={() => setInsuranceSource(false)} />
      )}
      {withdraw && (
        <OfferWithdrawDialog lead={lead} offer={withdraw} onClose={() => setWithdraw(null)} />
      )}
      <header className="space-y-5">
        <Link
          to="/leads"
          search={publicLeadSearch(session.leadReturnSearch ?? { view: "all" })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {lead.requestKind !== "new_insurance" && (
                <Badge variant="outline">{t(`requestKind.${lead.requestKind}`)}</Badge>
              )}
              <Badge variant="outline">{t(`category.${lead.category}`)}</Badge>
              <Badge>{t(`stage.${lead.stage}`)}</Badge>
              {lead.priority !== "normal" && (
                <Badge variant="outline">{t(`priority.${lead.priority}`)}</Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{lead.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {lead.clientName}
              {lead.object && ` · ${lead.object}`}
            </p>
          </div>
          <div className="flex gap-2">
            {allowed("edit") && lead.stage !== "completed" && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t("create.edit")}
              </Button>
            )}
            {lead.phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${lead.phone}`}>
                  <Phone className="mr-2 size-4" />
                  {t("detail.call")}
                </a>
              </Button>
            )}
            {lead.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${lead.email}`}>
                  <Mail className="mr-2 size-4" />
                  {t("detail.email")}
                </a>
              </Button>
            )}
            {lead.access === "operational" && (
              <>
                <Button variant="outline" asChild>
                  <Link to="/quality" search={{ leadId: lead.id, state: "all" }}>
                    {t("quality:title")}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/leads/$leadId/communications" params={{ leadId: lead.id }}>
                    {t("communications:title")}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("field.responsible")}</p>
            <p className="mt-2 text-sm font-medium">
              {lead.responsibleName ?? t("detail.noResponsible")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`assignment.${lead.assignment}`)}
            </p>
            {lead.referentContinuity && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setReferent(true)}
              >
                {t("referents.title")}
              </Button>
            )}
            {lead.access === "operational" && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdvice(true)}>
                {t("advice.title")}
              </Button>
            )}
            {allowed("advisor_assessment") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setAdvisorAssessment(true)}
              >
                {t("advisorAssessment.title")}
              </Button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("detail.next")}</p>
            <p className="mt-2 text-sm font-medium">{lead.nextAction || t("detail.noAction")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(lead.dueAt)}</p>
            {lead.events.some((item) => item.responsePending) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void navigate({ search: { tab: "activity" } })}
              >
                {t("decision.pending")}
              </Button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("detail.potential")}</p>
            <p className="mt-2 text-sm font-medium">
              {lead.estimatedCommissionMinor === null
                ? t("detail.notEstimable")
                : formatMoney(lead.estimatedCommissionMinor)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("detail.notAcquired")}</p>
          </div>
        </div>
        {lead.canEdit &&
          lead.stage !== "draft" &&
          (session.context.canAdvise || session.context.canManage) && (
            <div className="flex flex-wrap gap-2">
              {lead.assignment === "proposed" &&
                lead.responsibleId === session.identity.user.id && (
                  <Button
                    disabled={command.isPending}
                    onClick={() => command.mutate({ action: "accept", revision: lead.revision })}
                  >
                    {t("detail.accept")}
                  </Button>
                )}
              {lead.stage !== "completed" && (
                <>
                  <Button
                    disabled={!allowed("contact")}
                    variant="outline"
                    onClick={() => setAction("contact")}
                  >
                    {t("detail.contact")}
                  </Button>
                  <Button
                    disabled={!allowed("transition")}
                    variant="outline"
                    onClick={() => setAction("transition")}
                  >
                    {t("detail.changeStage")}
                  </Button>
                  <Button
                    disabled={!allowed("appointment")}
                    variant="outline"
                    onClick={() => setAction("appointment")}
                  >
                    {t("detail.appointment")}
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setAction("task")}>
                <Plus className="mr-2 size-4" />
                {t("detail.task")}
              </Button>
              <Button variant="outline" onClick={() => setAction("note")}>
                {t("detail.note")}
              </Button>
              {lead.canAssign && lead.stage !== "completed" && (
                <Button variant="outline" onClick={() => setAction("assign")}>
                  {t("detail.assign")}
                </Button>
              )}
            </div>
          )}
        {command.isError && (
          <p role="alert" className="text-sm text-destructive">
            {command.error instanceof PartnerApiError
              ? t(`errors.${command.error.code}`, { defaultValue: t("error") })
              : t("error")}
          </p>
        )}
      </header>
      <Tabs
        value={activeTab ?? "overview"}
        onValueChange={(value) => {
          void navigate({ search: { tab: value }, replace: true });
        }}
      >
        <TabsList className="max-w-full overflow-x-auto">
          {lead.availableTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {activeTab === "collaboration" && (
        <div className="space-y-5">
          {lead.canCollaborate && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setCollaborating(true)}>{t("collaboration.propose")}</Button>
              <Button variant="outline" onClick={() => setPublishingMarket(lead)}>
                {t("economy:publish")}
              </Button>
            </div>
          )}
          <CollaborationList items={lead.collaborations} />
        </div>
      )}
      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="space-y-5 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">{t("field.context")}</h2>
            <p className="whitespace-pre-wrap text-sm leading-7">{lead.context || "—"}</p>
            {lead.insuranceRequestId && lead.access === "operational" && (
              <Button variant="outline" onClick={() => setInsuranceSource(true)}>
                {t("insuranceSource.open")}
              </Button>
            )}
            {lead.access === "progress" && (
              <p className="text-sm text-muted-foreground">{t("detail.progressOnly")}</p>
            )}
            {lead.waiting && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">
                  {t("detail.waiting", { date: formatDate(lead.waiting.until) })}
                </p>
                <p className="mt-2 text-sm">{lead.waiting.reason}</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={command.isPending || !allowed("wait")}
                  onClick={() =>
                    command.mutate({ action: "wait", waiting: null, revision: lead.revision })
                  }
                >
                  {t("detail.resume")}
                </Button>
              </div>
            )}
            {lead.result && (
              <p className="rounded-lg bg-muted p-4 text-sm">
                {t(`result.${lead.result}`)}
                {" · "}
                {t(`reason.${lead.reason}`)}
              </p>
            )}
            {allowed("reopen") && (
              <Button variant="outline" onClick={() => setAction("reopen")}>
                {t("detail.reopen")}
              </Button>
            )}
            {lead.access !== "progress" && (
              <Button variant="outline" onClick={() => setReopenings(true)}>
                {t("lifecycle:title")}
              </Button>
            )}
            {reopenings && (
              <LeadReopeningsDialog leadId={lead.id} onClose={() => setReopenings(false)} />
            )}
            {lead.access !== "progress" && (
              <Button variant="outline" onClick={() => setRelationships(true)}>
                {t("relationships:title")}
              </Button>
            )}
            {relationships && (
              <LeadRelationshipsDialog
                key={[...session.queryKey, lead.id].join(":")}
                leadId={lead.id}
                onClose={() => setRelationships(false)}
              />
            )}
            {lead.canEdit && lead.stage !== "completed" && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={!allowed("next_action")} onClick={() => setAction("next_action")}>
                  {t("detail.nextAction")}
                </Button>
                <Button
                  disabled={!allowed("wait")}
                  variant="outline"
                  onClick={() => setAction("wait")}
                >
                  {t("detail.wait")}
                </Button>
                <Button
                  disabled={!allowed("close")}
                  variant="ghost"
                  onClick={() => setAction("close")}
                >
                  {t("detail.close")}
                </Button>
              </div>
            )}
          </section>
          <aside className="space-y-4 rounded-xl border border-border p-6">
            {lead.alerts.map((alert) => (
              <p key={alert} className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {t(`alerts.${alert}`)}
              </p>
            ))}
            {lead.firstActionDueAt && !lead.firstUsefulAt && (
              <p className="text-sm">
                {t("detail.firstAction", { date: formatDate(lead.firstActionDueAt) })}
              </p>
            )}
            {lead.acceptanceDueAt && (
              <p className="text-sm text-muted-foreground">
                {t("detail.acceptanceDue", { date: formatDate(lead.acceptanceDueAt) })}
              </p>
            )}
            {lead.continuityDueAt && lead.escalationDueAt && (
              <p className="text-sm text-muted-foreground">
                {t("detail.continuity", {
                  review: formatDate(lead.continuityDueAt),
                  escalation: formatDate(lead.escalationDueAt),
                })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("detail.created", { date: formatDate(lead.createdAt) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("detail.since", { date: formatDate(lead.stageChangedAt) })}
            </p>
            {session.context.administrator && lead.clientUserId ? (
              <Button variant="outline" asChild>
                <a
                  href={`${adminUrl}/users/${encodeURIComponent(lead.clientUserId)}?profile=${encodeURIComponent(lead.clientProfileId ?? "self")}`}
                >
                  {t("detail.client")}
                  <ArrowUpRight className="ml-2 size-4" />
                </a>
              </Button>
            ) : (
              !lead.clientUserId && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>{t("detail.pendingClient")}</p>
                  {lead.stage === "completed" && <p>{t("quality:missingOwner")}</p>}
                </div>
              )
            )}
          </aside>
          {!lead.clientUserId && lead.access === "operational" && (
            <ClientInvitationPanel
              key={[...session.queryKey, lead.id].join(":")}
              leadId={lead.id}
            />
          )}
        </div>
      )}
      {(activeTab === "activity" || activeTab === "notes") && (
        <div className="space-y-5">
          {lead.events
            .filter((item) => activeTab !== "notes" || item.kind === "lead.note")
            .map((item) => (
              <article key={item.id} className="relative border-l-2 border-border pb-4 pl-6">
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                  {" · "}
                  {t(`audience.${item.audience}`)}
                </p>
                <h3 className="mt-2 text-sm font-semibold">
                  {t(`event.${item.kind}`, { defaultValue: item.kind })}
                </h3>
                {item.offer && <p className="mt-2 text-sm">{t("decision.offer", item.offer)}</p>}
                {item.responsePending && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Badge variant="outline">{t("decision.pending")}</Badge>
                    {allowed("contact") && lead.stage !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setAction("contact")}>
                        {t("decision.followUp")}
                      </Button>
                    )}
                  </div>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.kind === "lead.stage_changed" ? t(`stage.${item.text}`) : item.text}
                </p>
              </article>
            ))}
          {!lead.events.some((item) => activeTab !== "notes" || item.kind === "lead.note") && (
            <EmptyState title={t("detail.emptyTab")} description={t("tabs.activity")} />
          )}
        </div>
      )}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          {lead.tasks.map((task) => (
            <article
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5"
            >
              <div>
                <h3
                  className={`font-medium ${task.state === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {task.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(task.dueAt)}
                  {" · "}
                  {t(`task.${task.state === "done" ? "completed" : task.state}`)}
                </p>
              </div>
              {lead.canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={command.isPending}
                  onClick={() =>
                    command.mutate({
                      action: "task_state",
                      revision: lead.revision,
                      taskId: task.id,
                      state: task.state === "done" ? "open" : "done",
                    })
                  }
                >
                  {t(task.state === "done" ? "task.reopen" : "task.done")}
                </Button>
              )}
            </article>
          ))}
          {!lead.tasks.length && (
            <EmptyState title={t("detail.emptyTab")} description={t("tabs.tasks")} />
          )}
        </div>
      )}
      {activeTab === "appointments" && (
        <div className="space-y-3">
          {allowed("personal_appointment") && (
            <Button variant="outline" onClick={() => setBookingProposals(lead)}>
              {t("booking.title")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setSharedAppointments(true)}>
            {t("appointmentLinks.shared")}
          </Button>
          {allowed("personal_appointment") && (
            <Button onClick={() => setAction("personal_appointment")}>
              {t("personalAppointment.title")}
            </Button>
          )}
          <JointParticipationsPanel leadId={lead.id} />
          {lead.appointments.map((appt) => (
            <article
              key={appt.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-5"
            >
              <CalendarDays className="size-6 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{formatDate(appt.startsAt)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`appointment.${appt.mode}`)}
                  {" · "}
                  {appt.location}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {new Intl.NumberFormat("fr-CH", { style: "unit", unit: "minute" }).format(
                    appt.durationMinutes,
                  )}
                </p>
                {!!appt.participants?.length && (
                  <div className="mt-2 text-sm">
                    <p>{t("joint.participants")}</p>
                    <ul className="list-disc pl-5">
                      {appt.participants.map((participant) => (
                        <li key={participant.id}>
                          {t("joint.participant", {
                            name: participant.name ?? "",
                            organization: participant.organization ?? "",
                            state:
                              t(`joint.state.${participant.state}`) +
                              (participant.state === "confirmed" && !participant.termsCurrent
                                ? ` · ${t("joint.stale")}`
                                : ""),
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Badge variant="outline">{t(`appointment.${appt.state}`)}</Badge>
              {allowed("personal_appointment") && appt.advisorId === session.identity.user.id && (
                <Button variant="outline" size="sm" onClick={() => setLinkingAppointment(appt.id)}>
                  {t("appointmentLinks.manage")}
                </Button>
              )}
              {allowed("personal_appointment") &&
                appt.advisorId === session.identity.user.id &&
                appt.state === "scheduled" && (
                  <Button variant="outline" size="sm" onClick={() => setRescheduling(appt)}>
                    {t("personalRescheduling.title")}
                  </Button>
                )}
              {appt.advisorId === session.identity.user.id && appt.state === "scheduled" && (
                <Button variant="outline" size="sm" onClick={() => setAssessedAppointment(appt.id)}>
                  {t("appointmentAssessment.open")}
                </Button>
              )}
              {allowed("appointment_state") && appt.state === "scheduled" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAppointment(appt.id);
                    setAction("appointment_state");
                  }}
                >
                  {t("appointment.report")}
                </Button>
              )}
            </article>
          ))}
          {!lead.appointments.length && (
            <EmptyState title={t("detail.emptyTab")} description={t("tabs.appointments")} />
          )}
        </div>
      )}
      {activeTab === "offers" && (
        <div className="space-y-5">
          <ContractComparison lead={lead} />
          {lead.currentContract?.status === "available" &&
            allowed("contract_review") &&
            session.context.canAdvise &&
            lead.stage !== "completed" && (
              <Button variant="outline" onClick={() => setReviewContract(true)}>
                {t("contract.review")}
              </Button>
            )}
          {lead.canEdit && session.context.canAdvise && lead.stage !== "completed" && (
            <Button onClick={() => setOffer("new")}>
              <Plus className="mr-2 size-4" />
              {t("detail.offer")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setHistory(true)}>
            {t("history.title")}
          </Button>
          <Button variant="outline" onClick={() => setPolicies(true)}>
            {t("policy.title")}
          </Button>
          <Button variant="outline" onClick={() => setConclusions(true)}>
            {t("conclusion:title")}
          </Button>
          <Button variant="outline" onClick={() => setImports(true)}>
            {t("imports.title")}
          </Button>
          {lead.offers
            .filter((item) => item.active)
            .map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border border-border p-6 ${item.active ? "" : "opacity-60"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {item.company}
                      {" · "}
                      {t("offer.version", { version: item.version })}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{item.product}</h3>
                    <p className="mt-2 text-xl font-medium">
                      {item.annualPremiumMinor === null
                        ? t("detail.notEstimable")
                        : formatMoney(item.annualPremiumMinor)}
                    </p>
                  </div>
                  <Badge variant="outline">{t(`offer.${item.state}`)}</Badge>
                </div>
                {item.summary && <p className="mt-4 whitespace-pre-wrap text-sm">{item.summary}</p>}
                {item.sourceStatus !== "current" && (
                  <p role="status" className="mt-3 text-sm">
                    {t(`history.sourceStatus.${item.sourceStatus ?? "unbound"}`)}
                  </p>
                )}
                {item.updatedSinceViewed && (
                  <p className="mt-3 text-sm">{t("offer.updatedSinceViewed")}</p>
                )}
                {item.limitations && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.limitations}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {allowed("advisor_assessment") && (
                    <Button size="sm" variant="outline" onClick={() => setSolutionOfferId(item.id)}>
                      {t("solutionEvidence.open")}
                    </Button>
                  )}
                  {item.canDownload && (
                    <Button asChild size="sm" variant="outline">
                      <a href={partnerApi.sourceUrl(lead.id, item.id)}>{t("offer.source")}</a>
                    </Button>
                  )}
                  {item.active && allowed("offer_withdraw") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={command.isPending}
                      onClick={() => setWithdraw(item)}
                    >
                      {t("offer.withdraw")}
                    </Button>
                  )}
                  {lead.canEdit &&
                    session.context.canAdvise &&
                    item.active &&
                    lead.stage !== "completed" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setOffer(item)}>
                          {t("offer.newVersion")}
                        </Button>
                        {item.state === "to_verify" && item.sourceStatus === "current" && (
                          <Button
                            size="sm"
                            disabled={command.isPending}
                            onClick={() =>
                              command.mutate({
                                action: "offer_review",
                                offerId: item.id,
                                revision: lead.revision,
                              })
                            }
                          >
                            {t("offer.review")}
                          </Button>
                        )}
                        {item.state === "ready" &&
                          item.sourceStatus === "current" &&
                          allowed("offer_publish") && (
                            <Button
                              size="sm"
                              disabled={command.isPending || !lead.clientUserId}
                              onClick={() =>
                                command.mutate({
                                  action: "offer_publish",
                                  offerId: item.id,
                                  revision: lead.revision,
                                })
                              }
                            >
                              {t("offer.publish")}
                            </Button>
                          )}
                      </>
                    )}
                </div>
                {item.state === "ready" && (
                  <p className="mt-3 text-xs text-muted-foreground">{t("offer.publishHelp")}</p>
                )}
              </article>
            ))}
          {!lead.offers.some((item) => item.active) && (
            <EmptyState title={t("offer.noOffers")} description={t("offer.sourceHelp")} />
          )}
          {lead.offers.some((item) => item.active) && <RecommendationPanel lead={lead} />}
          {lead.offerOrientation && (
            <OrientationPanel orientation={lead.offerOrientation} offers={lead.offers} />
          )}
          <ComplementPanel lead={lead} />
          {lead.offerComparison && <OfferMatrix comparison={lead.offerComparison} />}
        </div>
      )}
      {action && (
        <LeadActionDialog
          key={action}
          lead={lead}
          action={action}
          onClose={() => setAction(null)}
          {...(appointment ? { appointmentId: appointment } : {})}
        />
      )}{" "}
      {offer && (
        <OfferDialog
          lead={lead}
          {...(offer === "new" ? {} : { previous: offer })}
          onClose={() => setOffer(null)}
        />
      )}
      {reviewContract && lead.currentContract && (
        <ContractReviewDialog lead={lead} onClose={() => setReviewContract(false)} />
      )}
    </>
  );
}
