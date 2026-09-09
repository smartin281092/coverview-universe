import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, RefreshCw } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { ServiceRequest } from "@coverview/contracts";
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../api";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { ServiceRequestFailure } from "../features/service-requests/ServiceRequestFailure";
import { ServiceRequestDetails } from "../features/service-requests/ServiceRequestDetails";

const states = ["requested", "in_progress", "notified", "confirmed"] as const;

function RequestColumn({
  state,
  identity,
  blocked,
  onOpen,
}: {
  state: ServiceRequest["state"];
  identity: IdentityMe;
  blocked: boolean;
  onOpen: (request: ServiceRequest) => void;
}) {
  const { t, i18n } = useTranslation("serviceRequests");
  const [cursor, setCursor] = useState<string | undefined>();
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "service-requests", state, cursor],
    queryFn: ({ signal }) =>
      api.serviceRequests({ state, ...(cursor ? { cursor } : {}) }, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  return (
    <section className="min-w-0 space-y-4" aria-labelledby={`service-${state}`}>
      <h2
        id={`service-${state}`}
        className="flex min-h-11 items-center gap-2 border-b border-border pb-3 text-sm font-medium"
      >
        {["notified", "confirmed"].includes(state) && (
          <CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" />
        )}
        {t(`states.${state}`)}
      </h2>
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ServiceRequestFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.requests.length === 0 ? (
        <EmptyState title={t("empty")} description="" />
      ) : (
        <ul className="space-y-3">
          {query.data.requests.map((request) => (
            <li key={request.id}>
              <button
                type="button"
                disabled={blocked}
                className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-50 motion-reduce:transition-none"
                onClick={() => onOpen(request)}
              >
                <span className="block break-words font-medium">{request.profileName}</span>
                <span className="block text-sm">{t(`companies.${request.companyId}`)}</span>
                <Badge variant="secondary">{t(`groups.${request.group}`)}</Badge>
                {request.superseded && (
                  <span className="block text-xs text-amber-900">{t("previousValues")}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {t("created", { date: date.format(new Date(request.createdAt)) })}
                </span>
                <span className="block text-sm font-medium text-indigo-600">{t("details")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(cursor || query.data?.nextCursor) && (
        <nav
          aria-label={t("pagination", { state: t(`states.${state}`) })}
          className="flex flex-wrap gap-2"
        >
          <Button
            variant="outline"
            disabled={!cursor || query.isFetching || blocked}
            onClick={() => setCursor(undefined)}
          >
            {t("firstPage")}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data?.nextCursor || query.isFetching || blocked}
            onClick={() => {
              if (query.data?.nextCursor) setCursor(query.data.nextCursor);
            }}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </section>
  );
}

function ServiceRequests({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("serviceRequests");
  const client = useQueryClient();
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(false);
  return (
    <div ref={setPortalContainer} className="space-y-8">
      <header className="space-y-3">
        <p className="cv-meta text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <Button
        variant="outline"
        className="min-h-11"
        disabled={blocked || pending}
        onClick={() =>
          void client.invalidateQueries({
            queryKey: ["private", identity.user.id, identity.session.id, "service-requests"],
          })
        }
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("refresh")}
      </Button>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      )}
      <div className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {states.map((state) => (
          <RequestColumn
            key={state}
            state={state}
            identity={identity}
            blocked={blocked || pending}
            onOpen={(request) => {
              setSelected(request);
              setNotice(false);
            }}
          />
        ))}
      </div>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          showCloseButton
          closeLabel={t("close")}
          className="gap-6 overflow-y-auto p-6 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          {selected && (
            <>
              <SheetHeader className="p-0 pr-8">
                <SheetTitle>{t(`companies.${selected.companyId}`)}</SheetTitle>
                <SheetDescription>
                  {t("detailDescription", {
                    name: selected.profileName,
                    group: t(`groups.${selected.group}`),
                  })}
                </SheetDescription>
              </SheetHeader>
              <ServiceRequestDetails
                key={`${selected.id}:${selected.revision}`}
                request={selected}
                identity={identity}
                blocked={blocked}
                onPending={setPending}
                onRefresh={() => {
                  setSelected(null);
                  void client.invalidateQueries({
                    queryKey: [
                      "private",
                      identity.user.id,
                      identity.session.id,
                      "service-requests",
                    ],
                  });
                }}
                onSaved={() => {
                  setPending(false);
                  setNotice(true);
                  setSelected(null);
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ServiceRequestsPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <ServiceRequests identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
