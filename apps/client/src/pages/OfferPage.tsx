import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCanGoBack, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, FileText, Info, MessageSquare } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  NotFoundState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@coverview/ui";
import { partnerApi } from "../partner-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { LeadWorkspace, walletLeadsKey } from "../features/offers/LeadWorkspace";
import type { OfferAction } from "../features/offers/OfferCard";
import { OfferDocuments } from "../features/offers/OfferDocuments";
import { OfferHero } from "../features/offers/OfferHero";
import { offerGroups } from "../features/offers/offer-groups";
import { useWalletLiveUpdates } from "../features/offers/use-live-updates";

// Each tab's icon colour; the moving underline takes the colour of the open tab.
const tabs = [
  { id: "details", icon: Info, tone: "text-blue-600", color: "#2563eb" },
  { id: "comments", icon: MessageSquare, tone: "text-orange-400", color: "#fb923c" },
  { id: "documents", icon: FileText, tone: "text-teal-500", color: "#14b8a6" },
] as const;
type Tab = (typeof tabs)[number]["id"];
// The client's own messages about an offer, shown as its comments.
const commentKinds = [
  "client.question",
  "client.modification",
  "client.refuse",
  "client.select",
  "client.keep_current",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

// One offer (8 October 2026): its figures over the company's gradient, then its details, the
// client's messages and its documents.
function OfferView({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("offers");
  const { leadId, offerId } = useParams({ from: "/offers/$leadId/$offerId" });
  const { scope } = useWalletProfileScope();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [tab, setTab] = useState<Tab>("details");
  const [intent, setIntent] = useState<{ offerId: string; type: OfferAction } | null>(null);
  const [workspace, setWorkspace] = useState(false);
  const tabList = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  useWalletLiveUpdates(identity);
  const root = walletLeadsKey(identity, scope);
  const list = useQuery({
    queryKey: [...root, "offers"],
    queryFn: ({ signal }) =>
      partnerApi.walletOffers(scope === "all" ? {} : { clientProfileId: scope }, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  const detail = useQuery({
    queryKey: [...root, "lead", leadId],
    queryFn: ({ signal }) => partnerApi.lead(leadId, signal, true),
    enabled: tab === "comments",
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  // The underline follows the open tab: measured here, it then glides to its place.
  const shown = !!list.data;
  useLayoutEffect(() => {
    const node = tabList.current;
    if (!node) return;
    const measure = () => {
      const open = node.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (open) setUnderline({ left: open.offsetLeft, width: open.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [tab, shown, offerId]);
  const money = (minor: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(
      minor / 100,
    );
  const day = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const back = (
    <button
      type="button"
      className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium"
      onClick={() => {
        if (canGoBack) router.history.back();
        else void navigate({ to: "/offers" });
      }}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t("offerPage.back")}
    </button>
  );
  if (list.isPending)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {back}
        <LoadingState label={t("offerPage.loading")} />
      </div>
    );
  const data = list.data;
  if (!data)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {back}
        <ErrorState
          title={t("offerPage.error")}
          description=""
          retryLabel={t("retry")}
          pendingLabel={t("offerPage.loading")}
          onRetry={() => void list.refetch()}
        />
      </div>
    );
  const group = offerGroups(data.items).find((items) =>
    items.some((item) => item.offers.some((offer) => offer.id === offerId)),
  );
  // The offers of the same request block, in the order of the offers page.
  const siblings = (group ?? []).flatMap((item) =>
    item.offers.map((offer) => ({ lead: item.lead, offer })),
  );
  const index = siblings.findIndex((item) => item.offer.id === offerId);
  const current = siblings[index];
  if (!current)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {back}
        <NotFoundState
          title={t("offerPage.notFound")}
          description={t("offerPage.notFoundDescription")}
        />
      </div>
    );
  const { offer, lead } = current;
  const selected = offer.state === "selected";
  const move = (position: number) => {
    const next = siblings[position];
    if (next)
      void navigate({
        to: "/offers/$leadId/$offerId",
        params: { leadId: next.lead.id, offerId: next.offer.id },
        replace: true,
      });
  };
  // Choosing or asking goes through the request window, as from the offers list.
  const act = (type: OfferAction) => {
    setIntent({ offerId: offer.id, type });
    setWorkspace(true);
  };
  const comments =
    detail.data?.events.filter(
      (event) => event.offer?.id === offer.id && commentKinds.includes(event.kind),
    ) ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <OfferHero
        offer={offer}
        category={lead.category}
        siblings={siblings.map((item) => item.offer)}
        index={index}
        onMove={move}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="-mt-3 gap-6">
        <TabsList
          ref={tabList}
          variant="line"
          aria-label={t("offerPage.tabsLabel")}
          className="relative w-full justify-start gap-0.5 overflow-x-auto border-b border-border p-0 [scrollbar-width:none] group-data-horizontal/tabs:h-12 sm:gap-6 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(({ id, icon: Icon, tone }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-full flex-none gap-1.5 px-1 text-[13px] font-normal text-muted-foreground after:hidden data-active:text-foreground sm:px-1.5 sm:text-sm"
            >
              <Icon className={`size-4 ${tone}`} aria-hidden="true" />
              {t(`offerPage.tabs.${id}`)}
            </TabsTrigger>
          ))}
          {underline && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full transition-[transform,width,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                width: underline.width,
                transform: `translateX(${underline.left}px)`,
                backgroundColor: tabs.find((item) => item.id === tab)?.color,
              }}
            />
          )}
        </TabsList>
        <TabsContent value="details" className="space-y-6 text-sm">
          <Section title={t("offerPage.details.offer")}>
            <dl>
              <Row label={t("offerPage.details.company")}>{offer.company}</Row>
              <Row label={t("offerPage.details.product")}>{offer.product}</Row>
              <Row label={t("offerPage.details.premium")}>
                {offer.annualPremiumMinor === null
                  ? t("missing")
                  : `${money(offer.annualPremiumMinor)} ${t("workspace.perYear")}`}
              </Row>
              <Row label={t("offerPage.details.validUntil")}>
                {offer.validUntil ? day(offer.validUntil) : t("missing")}
              </Row>
              <Row label={t("offerPage.details.effectiveDate")}>
                {offer.effectiveDate ? day(offer.effectiveDate) : t("missing")}
              </Row>
              {offer.reference && (
                <Row label={t("offerPage.details.reference")}>{offer.reference}</Row>
              )}
              <Row label={t("offerPage.details.status")}>
                {selected ? (
                  <Badge className="cv-offer-tag h-6 px-2.5 text-xs [&>svg]:size-3.5!">
                    <Check aria-hidden="true" />
                    {t("state.selected")}
                  </Badge>
                ) : ["published", "viewed"].includes(offer.state) ? (
                  t("offerPage.details.available")
                ) : (
                  t(`state.${offer.state}`)
                )}
              </Row>
            </dl>
          </Section>
          <Section title={t("offerPage.details.benefits")}>
            {offer.features.length ? (
              <dl>
                {offer.features.map((feature) => (
                  <Row key={feature.key} label={feature.label}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {feature.value || t("missing")}
                      {feature.coverage === "included" && (
                        <Badge variant="outline">{t("offerPage.details.included")}</Badge>
                      )}
                      {feature.coverage === "excluded" && (
                        <Badge variant="outline">{t("offerPage.details.excluded")}</Badge>
                      )}
                    </span>
                    {feature.conditions && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {feature.conditions}
                      </span>
                    )}
                  </Row>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">{t("offerPage.details.noBenefits")}</p>
            )}
          </Section>
          {offer.summary && (
            <Section title={t("offerPage.details.summary")}>
              <p className="whitespace-pre-wrap">{offer.summary}</p>
            </Section>
          )}
          {offer.limitations && (
            <Section title={t("offerPage.details.limitations")}>
              <p className="whitespace-pre-wrap">{offer.limitations}</p>
            </Section>
          )}
          <Button
            disabled={
              !offer.canChoose ||
              !["published", "viewed", "selected"].includes(offer.state) ||
              (!!offer.validUntil && new Date(offer.validUntil).getTime() < Date.now())
            }
            onClick={() => act("select")}
          >
            {selected && <Check className="size-4" aria-hidden="true" />}
            {t(selected ? "selected" : "choose")}
          </Button>
        </TabsContent>
        <TabsContent value="comments" className="space-y-5 text-sm">
          {detail.isPending ? (
            <LoadingState label={t("offerPage.loading")} />
          ) : detail.isError ? (
            <ErrorState
              title={t("offerPage.error")}
              description=""
              retryLabel={t("retry")}
              pendingLabel={t("offerPage.loading")}
              onRetry={() => void detail.refetch()}
            />
          ) : comments.length ? (
            <ul className="space-y-3">
              {comments.map((event) => (
                <li key={event.id} className="space-y-1 rounded-xl border border-border p-4">
                  <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {`${t("offerPage.comments.you")} · ${t(
                        `offerPage.comments.kinds.${event.kind.replace("client.", "")}`,
                      )}`}
                    </span>
                    <time dateTime={event.createdAt}>{day(event.createdAt)}</time>
                  </p>
                  {event.text && <p className="whitespace-pre-wrap">{event.text}</p>}
                  {event.responsePending && (
                    <p className="text-xs text-muted-foreground">
                      {t("offerPage.comments.pending")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("offerPage.comments.emptyTitle")}
              description={t("offerPage.comments.emptyDescription")}
            />
          )}
          <Button variant="outline" disabled={!offer.canChoose} onClick={() => act("question")}>
            <MessageSquare className="size-4" aria-hidden="true" />
            {t("offerPage.comments.ask")}
          </Button>
        </TabsContent>
        <TabsContent value="documents" className="text-sm">
          <OfferDocuments
            key={`${identity.session.id}:${offer.id}:${offer.version}`}
            identity={identity}
            leadId={lead.id}
            offer={offer}
          />
        </TabsContent>
      </Tabs>
      <LeadWorkspace
        identity={identity}
        leadId={workspace ? lead.id : null}
        intent={intent}
        onIntentDone={() => setIntent(null)}
        onClose={() => {
          setWorkspace(false);
          setIntent(null);
        }}
        onSectionDone={() => undefined}
      />
    </div>
  );
}
export function OfferPage() {
  return <IdentityBoundary>{(identity) => <OfferView identity={identity} />}</IdentityBoundary>;
}
