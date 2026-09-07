import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Download, ArrowLeft, ArrowUpRight, RotateCw, ShieldCheck, Trash2 } from "lucide-react";
import {
  Button,
  Label,
  LoadingState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { documentCategorySchema, type DocumentRecord } from "@coverview/contracts";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { DocumentUpload } from "../features/documents/DocumentUpload";
import { DocumentReview } from "../features/documents/DocumentReview";

type Panel =
  "category" | "delete" | "history" | "source" | "resume" | "analysis" | { fieldId: string } | null;
function DocumentDetails({ identity, id }: { identity: IdentityMe; id: string }) {
  const { t, i18n } = useTranslation("documents");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [category, setCategory] = useState<DocumentRecord["category"]>("unknown");
  const [sourcePage, setSourcePage] = useState(0);
  const [notice, setNotice] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const operation = useRef<{ payload: string; key: string } | null>(null);
  const controller = useRef(new AbortController());
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const rootKey = ["private", identity.user.id, identity.session.id];
  const query = useQuery({
    queryKey: [...rootKey, "document", id],
    queryFn: ({ signal }) => api.document(id, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data && ["queued", "scanning", "reading"].includes(query.state.data.state)
        ? 5000
        : false,
  });
  const profile = useQuery({
    queryKey: [...rootKey, "profile"],
    queryFn: ({ signal }) => api.profile({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: [...rootKey, "document-command"],
    gcTime: 0,
    mutationFn: async (input: {
      action: "retry" | "category" | "delete";
      revision: number;
      category?: DocumentRecord["category"];
      analysisRequested?: boolean;
    }) => {
      const payload = JSON.stringify(input);
      if (operation.current?.payload !== payload)
        operation.current = { payload, key: crypto.randomUUID() };
      const options = {
        csrfToken: identity.csrfToken,
        idempotencyKey: operation.current.key,
        signal: controller.current.signal,
      };
      if (input.action === "delete") return api.deleteDocument(id, options);
      if (input.action === "category")
        return api.categorizeDocument(
          id,
          { revision: input.revision, category: input.category ?? "unknown" },
          options,
        );
      return api.retryDocument(
        id,
        { revision: input.revision, analysisRequested: input.analysisRequested ?? false },
        options,
      );
    },
    onSuccess: async (_, variables) => {
      if (controller.current.signal.aborted) return;
      setPanel(null);
      operation.current = null;
      await client.invalidateQueries({ queryKey: rootKey });
      if (variables.action === "delete") void navigate({ to: "/documents" });
      else setNotice(true);
    },
    retry: false,
  });
  const download = useMutation({
    mutationKey: [...rootKey, "document-download"],
    gcTime: 0,
    mutationFn: () => api.downloadDocument(id, { signal: controller.current.signal }),
    onSuccess: (blob) => {
      if (controller.current.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = query.data?.name ?? "document";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    retry: false,
  });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return (
      <DocumentFailure
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const item = query.data;
  const busy = mutation.isPending || reviewPending;
  const field =
    panel && typeof panel === "object"
      ? item.analysis?.fields.find((field) => field.id === panel.fieldId)
      : undefined;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const stable = ["ready", "failed"].includes(item.state);
  const panelTitle = field
    ? t(`field.${field.field}`)
    : t(`panel.${typeof panel === "string" ? panel : "source"}`);
  return (
    <div className="space-y-8">
      <div ref={setPortalContainer} />
      <Link
        to="/documents"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="space-y-4">
        <p className="cv-meta text-muted-foreground">{t(`category.${item.category}`)}</p>
        <h1 className="break-words text-2xl font-medium tracking-tight sm:text-4xl">{item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {t("fileMeta", {
            size: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
              item.size / 1024,
            ),
            date: date.format(new Date(item.createdAt)),
          })}
        </p>
      </header>
      <section
        className="flex flex-wrap items-start justify-between gap-5 border-y border-border py-6"
        aria-label={t("processing")}
      >
        <div className="flex min-w-0 gap-3">
          <ShieldCheck className="mt-1 size-5 shrink-0" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-medium" role="status">
              {t(`state.${item.state}`)}
            </p>
            <p className="max-w-xl text-sm text-muted-foreground">
              {item.failure
                ? t(`failure.${item.failure}`, {
                    defaultValue: t("failure.processing_unavailable"),
                  })
                : t(item.state === "pending" ? "pendingHelp" : "originalSafe")}
            </p>
          </div>
        </div>
        {item.state === "pending" && (
          <Button onClick={() => setPanel("resume")}>{t("resumeUpload")}</Button>
        )}
        {item.canRetry && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              mutation.mutate({
                action: "retry",
                revision: item.revision,
                analysisRequested: item.analysisRequested,
              })
            }
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {t(item.analysisRequested ? "retryAnalysis" : "retryScan")}
          </Button>
        )}
        {stable && (item.state === "ready" || !item.analysisRequested) && (
          <Button variant="outline" disabled={busy} onClick={() => setPanel("analysis")}>
            {t(item.analysisRequested ? "reanalyze" : "startAnalysis")}
          </Button>
        )}
      </section>
      {notice && (
        <p role="status" className="text-sm">
          {t("saved")}
        </p>
      )}
      {mutation.isError && (
        <DocumentFailure
          error={mutation.error}
          onRetry={() => {
            if (mutation.variables) mutation.mutate(mutation.variables);
          }}
        />
      )}
      {download.isError && (
        <DocumentFailure error={download.error} onRetry={() => download.mutate()} />
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={!item.canDownload || download.isPending}
          onClick={() => download.mutate()}
        >
          <Download className="size-4" aria-hidden="true" />
          {t("download")}
        </Button>
        {stable && (
          <Button
            variant="ghost"
            onClick={() => {
              setCategory(item.category);
              setPanel("category");
            }}
          >
            {t("correctCategory")}
          </Button>
        )}
        {!!item.analysis?.pages.length && (
          <Button variant="ghost" onClick={() => setPanel("source")}>
            {t("readSource")}
          </Button>
        )}
        {item.decisions.length > 0 && (
          <Button variant="ghost" onClick={() => setPanel("history")}>
            {t("history")}
          </Button>
        )}
      </div>
      {item.analysis && (
        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">{t("extractedTitle")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{t("extractedHelp")}</p>
          </div>
          {item.analysis.fields.length === 0 ? (
            <p className="rounded-lg bg-muted p-5 text-sm">{t("noFields")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {item.analysis.fields.map((extraction) => {
                const decision = item.decisions
                  .flatMap((item) => item.fields)
                  .find((field) => field.field === extraction.field);
                return (
                  <li
                    key={extraction.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-5"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {t(`field.${extraction.field}`)}
                      </p>
                      <p className="break-words font-medium">
                        {item.reviewedValues.find((value) => value.field === extraction.field)
                          ?.value ?? extraction.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {decision ? t(`decision.${decision.choice}`) : t("awaitingReview")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy || item.state !== "ready"}
                      onClick={() => setPanel({ fieldId: extraction.id })}
                    >
                      {t("review")}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/profile"
            search={{}}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"
          >
            {t("profile")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="max-w-xl text-xs text-muted-foreground">{t("retention")}</p>
        <Button variant="ghost" disabled={busy} onClick={() => setPanel("delete")}>
          <Trash2 className="size-4" aria-hidden="true" />
          {t("delete")}
        </Button>
      </div>
      <Sheet
        open={panel !== null && !!portalContainer}
        onOpenChange={(open) => {
          if (!open && !busy) setPanel(null);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          className="overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[side=right]:w-full sm:max-w-lg"
          showCloseButton
          closeLabel={t("close")}
        >
          <SheetHeader className="mb-8 p-0 text-left">
            <SheetTitle>{panelTitle}</SheetTitle>
            <SheetDescription>
              {t(
                field
                  ? "reviewDescription"
                  : panel === "delete"
                    ? "deleteDescription"
                    : "detailDescription",
              )}
            </SheetDescription>
          </SheetHeader>
          {mutation.isError && (
            <DocumentFailure
              error={mutation.error}
              onRetry={() => {
                if (mutation.variables) mutation.mutate(mutation.variables);
              }}
            />
          )}
          {panel === "analysis" && (
            <div className="space-y-6">
              <p className="text-sm">{t("analysisDisclosure")}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  mutation.mutate({
                    action: "retry",
                    revision: item.revision,
                    analysisRequested: true,
                  })
                }
              >
                {t("startAnalysis")}
              </Button>
            </div>
          )}
          {panel === "resume" && (
            <DocumentUpload
              identity={identity}
              pending={item}
              onDone={() => {
                setPanel(null);
                void query.refetch();
              }}
            />
          )}
          {panel === "delete" && (
            <div className="space-y-6">
              <p className="text-sm leading-relaxed">{t("deleteConsequences")}</p>
              <Button
                className="min-h-11 w-full"
                variant="destructive"
                disabled={busy}
                onClick={() => mutation.mutate({ action: "delete", revision: item.revision })}
              >
                {t(busy ? "saving" : "deleteConfirm")}
              </Button>
            </div>
          )}
          {panel === "category" && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate({ action: "category", revision: item.revision, category });
              }}
            >
              <Label htmlFor="document-category">{t("categoryLabel")}</Label>
              <select
                id="document-category"
                className="min-h-11 w-full rounded-md bg-muted px-3 text-sm"
                value={category}
                onChange={(event) => setCategory(documentCategorySchema.parse(event.target.value))}
              >
                {documentCategorySchema.options.map((category) => (
                  <option key={category} value={category}>
                    {t(`category.${category}`)}
                  </option>
                ))}
              </select>
              {item.analysis?.evidence && (
                <blockquote className="break-words border-l-2 border-border pl-4 text-sm text-muted-foreground">
                  {item.analysis.evidence.text}
                </blockquote>
              )}
              <Button type="submit" disabled={busy}>
                {t("saveCategory")}
              </Button>
            </form>
          )}
          {panel === "source" && item.analysis && (
            <div className="space-y-5">
              <p className="text-xs text-muted-foreground">{t("transcriptHelp")}</p>
              <nav className="flex items-center justify-between gap-3" aria-label={t("pagination")}>
                <Button
                  variant="outline"
                  disabled={sourcePage === 0}
                  onClick={() => setSourcePage((value) => value - 1)}
                >
                  {t("previous")}
                </Button>
                <span className="text-sm">
                  {t("sourcePage", { page: item.analysis.pages[sourcePage]?.page })}
                </span>
                <Button
                  variant="outline"
                  disabled={sourcePage >= item.analysis.pages.length - 1}
                  onClick={() => setSourcePage((value) => value + 1)}
                >
                  {t("next")}
                </Button>
              </nav>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {item.analysis.pages[sourcePage]?.text}
              </p>
            </div>
          )}
          {panel === "history" && (
            <ul className="divide-y divide-border">
              {item.decisions.map((decision) => (
                <li key={decision.id} className="space-y-2 py-4 text-sm">
                  <p className="text-muted-foreground">{date.format(new Date(decision.at))}</p>
                  {decision.category ? (
                    <p>{t("categoryChanged", { category: t(`category.${decision.category}`) })}</p>
                  ) : (
                    decision.fields.map((field) => (
                      <p key={field.field}>
                        {t("fieldDecision", {
                          field: t(`field.${field.field}`),
                          decision: t(`decision.${field.choice}`),
                        })}
                      </p>
                    ))
                  )}
                </li>
              ))}
            </ul>
          )}
          {field &&
            (profile.isPending ? (
              <LoadingState label={t("loading")} />
            ) : profile.isError ? (
              <DocumentFailure
                error={profile.error}
                onRetry={() => {
                  void profile.refetch();
                }}
              />
            ) : (
              <DocumentReview
                key={field.id}
                identity={identity}
                document={item}
                field={field}
                profile={profile.data}
                onPendingChange={setReviewPending}
                onDone={() => {
                  setPanel(null);
                  setNotice(true);
                }}
              />
            ))}
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function DocumentDetailsPage() {
  const { documentId } = useParams({ from: "/documents/$documentId" });
  return (
    <IdentityBoundary>
      {(identity) => <DocumentDetails key={documentId} identity={identity} id={documentId} />}
    </IdentityBoundary>
  );
}
