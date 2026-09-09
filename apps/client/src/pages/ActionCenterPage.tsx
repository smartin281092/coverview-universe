import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import type { CompanyAction } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { ActionFailure } from "../features/actions/ActionFailure";
import {
  CompanyActionDetails,
  CompanyActionStatus,
  CompanyActionValuesView,
} from "../features/actions/CompanyActionDetails";
import { ActionSourceReview } from "../features/actions/ActionSourceReview";
import { ProfileSyncActions } from "../features/actions/ProfileSyncActions";

function ActionCenter({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("actions");
  const { t: companies } = useTranslation("authorizations");
  const client = useQueryClient();
  const search = useSearch({ from: "/actions" });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState(false);
  const [sourceNotice, setSourceNotice] = useState(false);
  const [source, setSource] = useState<{
    documentId: string;
    groupId: string;
    profileId: string;
  } | null>(null);
  const [sourcePending, setSourcePending] = useState(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const root = ["private", identity.user.id, identity.session.id];
  const query = useQuery({
    queryKey: [...root, "company-actions", search.cursor],
    queryFn: ({ signal }) => api.companyActions(search, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (current) =>
      pending || source || sourcePending || current.state.status === "error" ? false : 30_000,
    refetchIntervalInBackground: false,
  });
  const action = query.data?.actions.find((item) => item.id === selected);
  const request = async (item: CompanyAction) => {
    if (busy.current || !item.canRequest) return;
    busy.current = true;
    setPending(item.id);
    setFailure(null);
    setNotice(false);
    const active = new AbortController();
    controller.current = active;
    const input = {
      profileId: item.profileId,
      companyId: item.companyId,
      group: item.group,
      profileRevision: item.profileRevision,
      values: item.currentValues,
    };
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      await api.requestCompanyAction(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      setNotice(true);
      setSelected(null);
      command.current = null;
      await client.invalidateQueries({ queryKey: root });
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(null);
      }
    }
  };
  const reload = () => {
    setFailure(null);
    void query.refetch();
  };
  const accessFailure =
    failure instanceof ApiError && (failure.status === 401 || failure.status === 403);
  if (accessFailure) return <ActionFailure error={failure} onRetry={reload} />;
  return (
    <div ref={setPortalContainer} className="space-y-8">
      <header className="space-y-3">
        <p className="cv-meta text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={query.isFetching || !!pending}
          onClick={reload}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("refresh")}
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          <Link to="/requests">{t("legacyRequests")}</Link>
        </Button>
      </div>
      {notice && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("requested")}
        </p>
      )}
      {sourceNotice && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("sourceSaved")}
        </p>
      )}
      {failure && !action ? <ActionFailure error={failure} onRetry={reload} /> : null}
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ActionFailure error={query.error} onRetry={reload} />
      ) : query.data.actions.length === 0 && query.data.synchronizations.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button asChild variant="outline">
              <Link to="/documents">{t("openDocuments")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          {query.data.synchronizations.length > 0 && (
            <ProfileSyncActions
              synchronizations={query.data.synchronizations}
              pending={!!pending || sourcePending}
              onReview={(item) => {
                setSourceNotice(false);
                setSource({
                  documentId: item.documentId,
                  groupId: item.group.id,
                  profileId: item.profileId,
                });
              }}
            />
          )}
          {query.data.actions.length > 0 && (
            <section className="space-y-4" aria-labelledby="company-actions">
              <h2 id="company-actions" className="cv-app-subheading">
                {t("companyActionsTitle")}
              </h2>
              <ul className="divide-y divide-border">
                {query.data.actions.map((item) => (
                  <li key={item.id} className="grid gap-5 py-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <h3 className="font-medium">
                        {companies(`companies.names.${item.companyId}`)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("profile", { name: item.profileName })}
                      </p>
                      <p className="text-sm">{t(`groups.${item.group}`)}</p>
                    </div>
                    <div className="space-y-3">
                      <CompanyActionStatus action={item} />
                      <CompanyActionValuesView values={item.currentValues} />
                    </div>
                    <div className="flex flex-wrap items-start gap-3 md:justify-end">
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={!!pending}
                        onClick={() => {
                          setSelected(item.id);
                          setFailure(null);
                        }}
                      >
                        {t("details")}
                      </Button>
                      {item.canRequest && (
                        <Button
                          className="min-h-11"
                          disabled={!!pending}
                          onClick={() => void request(item)}
                        >
                          {t(pending === item.id ? "requesting" : "request")}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {query.data?.incomplete && <p className="text-sm text-muted-foreground">{t("incomplete")}</p>}
      {(search.cursor || query.data?.nextCursor) && (
        <nav aria-label={t("pagination")} className="flex gap-3">
          <Button
            variant="outline"
            disabled={!search.cursor || query.isFetching || !!pending}
            onClick={() => void navigate({ to: "/actions", search: {} })}
          >
            {t("firstPage")}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data?.nextCursor || query.isFetching || !!pending}
            onClick={() => {
              if (query.data?.nextCursor)
                void navigate({ to: "/actions", search: { cursor: query.data.nextCursor } });
            }}
          >
            {t("next")}
          </Button>
        </nav>
      )}
      <Sheet
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy.current && !sourcePending) setSelected(null);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          showCloseButton
          closeLabel={t("close")}
          className="gap-6 overflow-y-auto p-6 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          {action && (
            <>
              <SheetHeader className="p-0 pr-8">
                <SheetTitle>{companies(`companies.names.${action.companyId}`)}</SheetTitle>
                <SheetDescription>
                  {t("detailDescription", {
                    name: action.profileName,
                    group: t(`groups.${action.group}`),
                  })}
                </SheetDescription>
              </SheetHeader>
              {failure ? <ActionFailure error={failure} onRetry={reload} /> : null}
              <CompanyActionDetails
                key={action.id}
                action={action}
                pending={!!pending || sourcePending}
                onRequest={() => void request(action)}
                onReview={(observation) => {
                  setSourceNotice(false);
                  setSource({
                    groupId: action.group,
                    profileId: action.profileId,
                    documentId: observation.documentId,
                  });
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open && !sourcePending) setSource(null);
        }}
      >
        <DialogContent
          portalContainer={portalContainer}
          showCloseButton
          closeLabel={t("close")}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-xl"
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{t("sourceTitle")}</DialogTitle>
            <DialogDescription>{t("sourceDescription")}</DialogDescription>
          </DialogHeader>
          {source && (
            <ActionSourceReview
              key={`${source.documentId}:${source.groupId}`}
              identity={identity}
              documentId={source.documentId}
              groupId={source.groupId}
              profileId={source.profileId}
              onDone={() => {
                setSource(null);
                setSelected(null);
                setSourceNotice(true);
              }}
              onPendingChange={setSourcePending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ActionCenterPage() {
  return <IdentityBoundary>{(identity) => <ActionCenter identity={identity} />}</IdentityBoundary>;
}
