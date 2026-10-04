import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Download, FileText, LoaderCircle, Plus, Search } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentRecord, ManagedProfile } from "@coverview/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";
import { AdminDocumentUpload } from "./AdminDocumentUpload";

const processing = new Set(["queued", "scanning", "reading"]);
type Context = {
  identity: IdentityMe;
  userId: string;
  profile: ManagedProfile;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
};

function DocumentDetails({
  identity,
  userId,
  profile,
  blocked,
  portalContainer,
  id,
  onPending,
}: Context & { id: string; onPending: (pending: boolean) => void }) {
  const { t, i18n } = useTranslation("users");
  const client = useQueryClient();
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const key = ["private", identity.user.id, identity.session.id, "admin-user", userId];
  const queryKey = [...key, "document", profile.id, id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.adminDocument(userId, profile.id, id, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (current) =>
      current.state.data && processing.has(current.state.data.state) && !current.state.error
        ? 5000
        : current.state.error
          ? false
          : 15_000,
  });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    onPending(pending);
    return () => onPending(false);
  }, [pending, onPending]);
  const previousState = useRef<string | undefined>(undefined);
  useEffect(() => {
    const state = query.data?.state;
    if (state === "ready" && previousState.current !== "ready") {
      void client.invalidateQueries({ queryKey: [...key, "profiles"] });
      void client.invalidateQueries({ queryKey: [...key, "section", profile.id] });
    }
    previousState.current = state;
  }, [query.data?.state, client, identity.user.id, identity.session.id, userId, profile.id]);
  const updated = (document: DocumentRecord) => {
    client.setQueryData(queryKey, document);
    void client.invalidateQueries({ queryKey: [...key, "documents", profile.id] });
  };
  const retry = async (analysisRequested: boolean) => {
    if (!query.data || blocked || busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const input = { revision: query.data.revision, analysisRequested };
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      const document = await api.retryAdminDocument(userId, profile.id, id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      command.current = null;
      updated(document);
      setAnalysisOpen(false);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const download = async () => {
    if (!query.data || blocked || busy.current) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    try {
      const blob = await api.downloadAdminDocument(userId, profile.id, id, {
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = query.data.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  if (query.isError)
    return <AdminFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <LoadingState label={t("documents.loading")} />;
  const document = query.data;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="break-words font-medium">{document.title || document.name}</p>
        <Badge variant="secondary">{t(`documents.state.${document.state}`)}</Badge>
        {processing.has(document.state) && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t(`documents.state.${document.state}`)}
          </p>
        )}
        {document.failure && (
          <p role="status" className="text-sm text-destructive">
            {t(`documents.failure.${document.failure}`, {
              defaultValue: t("documents.failure.default"),
            })}
          </p>
        )}
      </div>
      {document.state === "pending" ? (
        <AdminDocumentUpload
          identity={identity}
          userId={userId}
          profileId={profile.id}
          blocked={blocked}
          pendingDocument={document}
          onDone={updated}
          onPending={onPending}
          portalContainer={portalContainer}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {document.canDownload && (
              <Button
                variant="outline"
                disabled={pending || blocked}
                onClick={() => void download()}
              >
                <Download className="size-4" aria-hidden="true" />
                {t("documents.download")}
              </Button>
            )}
            {document.canRetry && (
              <Button
                variant="outline"
                disabled={pending || blocked}
                onClick={() =>
                  document.analysisRequested ? setAnalysisOpen(true) : void retry(false)
                }
              >
                {t(document.analysisRequested ? "documents.retryAnalysis" : "documents.retryScan")}
              </Button>
            )}
            {document.state === "ready" && !document.analysis && !document.analysisRequested && (
              <Button disabled={pending || blocked} onClick={() => setAnalysisOpen(true)}>
                {t("documents.startAnalysis")}
              </Button>
            )}
          </div>
          {failure ? (
            <AdminFailure
              error={failure}
              onRetry={() => {
                setFailure(null);
                void query.refetch();
              }}
            />
          ) : null}
          {document.analysis && (
            <section className="space-y-4">
              <h3 className="font-medium">{t("documents.information")}</h3>
              <p className="text-sm text-muted-foreground">{t("documents.extractedDescription")}</p>
              {document.analysis.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("documents.noFields")}</p>
              ) : (
                <dl className="divide-y divide-border">
                  {document.analysis.fields.map((field) => (
                    <div key={field.id} className="space-y-2 py-4">
                      <dt className="text-sm text-muted-foreground">
                        {t(`fields.${field.field}`)}
                      </dt>
                      <dd className="space-y-2">
                        <p className="break-words font-medium">{field.value}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("documents.source", {
                            page: new Intl.NumberFormat(i18n.language).format(field.source.page),
                          })}
                        </p>
                        <blockquote className="break-words border-l-2 border-border pl-3 text-sm text-muted-foreground">
                          {field.source.text}
                        </blockquote>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}
          <p className="break-words text-xs text-muted-foreground">{document.name}</p>
          <p className="text-xs text-muted-foreground">{t("documents.retention")}</p>
        </>
      )}
      <Dialog
        open={analysisOpen}
        onOpenChange={(open) => {
          if (!pending) setAnalysisOpen(open);
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("documents.analysisTitle")}</DialogTitle>
            <DialogDescription>{t("documents.disclosure")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {t("documents.target", {
              name: profile.isSelf ? t("profile.self") : profile.displayName,
            })}
          </p>
          {failure ? <AdminFailure error={failure} onRetry={() => void retry(true)} /> : null}
          <DialogFooter className="gap-3">
            <Button variant="outline" disabled={pending} onClick={() => setAnalysisOpen(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={pending} onClick={() => void retry(true)}>
              {t(pending ? "pending" : "documents.confirmAnalysis")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDocuments({ identity, userId, profile, blocked, portalContainer }: Context) {
  const { t, i18n } = useTranslation("users");
  const client = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const key = [
    "private",
    identity.user.id,
    identity.session.id,
    "admin-user",
    userId,
    "documents",
    profile.id,
  ];
  const query = useQuery({
    queryKey: [...key, cursor, q],
    queryFn: ({ signal }) =>
      api.adminDocuments(
        userId,
        profile.id,
        { ...(cursor ? { cursor } : {}), ...(q ? { q } : {}) },
        { signal },
      ),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (current) =>
      current.state.data?.documents.some((document) => processing.has(document.state)) &&
      !current.state.error
        ? 5000
        : current.state.error
          ? false
          : 15_000,
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
  const name = profile.isSelf ? t("profile.self") : profile.displayName;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="cv-app-subheading">{t("documents.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("documents.description")}</p>
        </div>
        <Button disabled={blocked} onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t("documents.add")}
        </Button>
      </div>
      <form
        role="search"
        className="max-w-2xl space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(search.trim());
          setCursor(undefined);
        }}
      >
        <Label htmlFor="admin-document-search">{t("documents.search")}</Label>
        <div className="flex gap-3">
          <Input
            id="admin-document-search"
            type="search"
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("documents.searchPlaceholder")}
            className="min-h-11"
          />
          <Button type="submit" variant="outline" aria-label={t("search.action")}>
            <Search className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
      {query.isError ? (
        <AdminFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingState label={t("documents.loading")} />
      ) : query.data.documents.length === 0 ? (
        <EmptyState title={t("documents.empty")} description={t("documents.emptyDescription")} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.documents.map((document) => (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => setSelected(document.id)}
                className="flex min-h-20 w-full items-center gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted/50 motion-reduce:transition-none"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-medium">
                    {document.title || document.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("documents.meta", {
                      date: date.format(new Date(document.createdAt)),
                      size: number.format(document.size / 1024),
                    })}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`documents.state.${document.state}`)}
                  </span>
                </span>
                {processing.has(document.state) ? (
                  <LoaderCircle
                    className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(cursor || query.data?.nextCursor) && (
        <nav className="flex gap-3" aria-label={t("pagination")}>
          {cursor && (
            <Button variant="outline" onClick={() => setCursor(undefined)}>
              {t("firstPage")}
            </Button>
          )}
          {query.data?.nextCursor && (
            <Button
              variant="outline"
              onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
            >
              {t("nextPage")}
            </Button>
          )}
        </nav>
      )}
      <Sheet
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!pending) setUploadOpen(open);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          className="overflow-y-auto p-6 data-[side=right]:w-full sm:max-w-xl"
          closeLabel={t("close")}
        >
          <SheetHeader className="mb-6 p-0">
            <SheetTitle>{t("documents.add")}</SheetTitle>
            <SheetDescription>{t("documents.uploadDescription", { name })}</SheetDescription>
          </SheetHeader>
          {uploadOpen && (
            <AdminDocumentUpload
              identity={identity}
              userId={userId}
              profileId={profile.id}
              blocked={blocked}
              portalContainer={portalContainer}
              onPending={setPending}
              onDone={(document) => {
                setUploadOpen(false);
                setSelected(document.id);
                void client.invalidateQueries({ queryKey: key });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          className="overflow-y-auto p-6 data-[side=right]:w-full sm:max-w-xl"
          closeLabel={t("close")}
        >
          <SheetHeader className="mb-6 p-0">
            <SheetTitle>{t("documents.details")}</SheetTitle>
            <SheetDescription>{t("documents.target", { name })}</SheetDescription>
          </SheetHeader>
          {selected && (
            <DocumentDetails
              key={selected}
              identity={identity}
              userId={userId}
              profile={profile}
              blocked={blocked}
              portalContainer={portalContainer}
              id={selected}
              onPending={setPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
