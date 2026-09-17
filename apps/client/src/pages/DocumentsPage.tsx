import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDown,
  ArrowUpRight,
  FileText,
  Layers3,
  LayoutGrid,
  List,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { documentClassificationSchema, type DocumentSummary } from "@coverview/contracts";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentUpload } from "../features/documents/DocumentUpload";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { DocumentProcessingIndicator } from "../features/documents/DocumentProcessingIndicator";
import { AuthorizationNotice } from "../features/documents/AuthorizationNotice";
import { DocumentLabels } from "../features/documents/DocumentLabels";
import { DocumentCover } from "../features/documents/DocumentCover";

function Documents({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("documents");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [display, setDisplay] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<{
    q: string;
    group: "date" | "type";
    sort: "newest" | "oldest" | "title";
    classification?: NonNullable<DocumentSummary["classification"]> | undefined;
  }>({ q: "", group: "date", sort: "newest" });
  const updateFilters = (patch: Partial<typeof filters>) => {
    setFilters((value) => ({ ...value, ...patch }));
    setCursors([]);
  };
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "documents",
      filters,
      cursors.at(-1) ?? null,
    ],
    queryFn: ({ signal }) =>
      api.documents(cursors.at(-1), { signal }, { ...filters, scope: "account" }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.documents.some((item) =>
        ["queued", "scanning", "reading", "deleting"].includes(item.state),
      )
        ? 5000
        : false,
  });
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const monthFormat = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const groups = new Map<string, DocumentSummary[]>();
  for (const document of query.data?.documents ?? []) {
    const group =
      filters.group === "type"
        ? (document.classification ?? document.category)
        : document.createdAt.slice(0, 7);
    groups.set(group, [...(groups.get(group) ?? []), document]);
  }
  return (
    <div className="space-y-8">
      <div ref={setPortalContainer} className="contents" />
      {!noticeDismissed && <AuthorizationNotice onDismiss={() => setNoticeDismissed(true)} />}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="max-w-xl text-muted-foreground">{t("description")}</p>
        </div>
        <Sheet
          open={open && !!portalContainer}
          onOpenChange={(value) => {
            if (!uploadPending) setOpen(value);
          }}
        >
          <SheetTrigger asChild>
            <Button>
              <Plus className="size-4" aria-hidden="true" />
              {t("add")}
            </Button>
          </SheetTrigger>
          <SheetContent
            portalContainer={portalContainer}
            className="overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[side=right]:w-full sm:max-w-lg"
            showCloseButton
            closeLabel={t("close")}
          >
            <SheetHeader className="mb-8 p-0 text-left">
              <SheetTitle>{t("add")}</SheetTitle>
              <SheetDescription>{t("uploadDescription")}</SheetDescription>
            </SheetHeader>
            {open && (
              <DocumentUpload
                identity={identity}
                portalContainer={portalContainer}
                onBusyChange={setUploadPending}
                onDone={(document) => {
                  setUploadPending(false);
                  setOpen(false);
                  void navigate({
                    to: "/documents/$documentId",
                    params: { documentId: document.id },
                  });
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilters({ q: searchText.trim() });
        }}
        role="search"
        aria-label={t("library.search")}
      >
        <div className="space-y-2">
          <Label htmlFor="document-search">
            <Search className="size-4" strokeWidth={1.5} aria-hidden="true" />
            {t("library.search")}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              className="min-h-11 min-w-0 flex-1"
              id="document-search"
              type="search"
              maxLength={120}
              value={searchText}
              placeholder={t("library.searchPlaceholder")}
              onChange={(event) => {
                setSearchText(event.target.value);
                if (!event.target.value) updateFilters({ q: "" });
              }}
            />
            <Button
              type="submit"
              variant="outline"
              className="min-h-11 shrink-0"
              aria-label={t("library.searchAction")}
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("library.searchAction")}</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="document-group">
              <Layers3 className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {t("library.group")}
            </Label>
            <Select
              value={filters.group}
              onValueChange={(value) =>
                updateFilters({ group: value === "type" ? "type" : "date" })
              }
            >
              <SelectTrigger id="document-group" className="min-h-11 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={portalContainer}>
                <SelectItem value="date">{t("library.byDate")}</SelectItem>
                <SelectItem value="type">{t("library.byType")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="document-sort">
              <ArrowUpDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {t("library.sort")}
            </Label>
            <Select
              value={filters.sort}
              onValueChange={(value) =>
                updateFilters({
                  sort: value === "oldest" ? "oldest" : value === "title" ? "title" : "newest",
                })
              }
            >
              <SelectTrigger id="document-sort" className="min-h-11 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={portalContainer}>
                <SelectItem value="newest">{t("library.newest")}</SelectItem>
                <SelectItem value="oldest">{t("library.oldest")}</SelectItem>
                <SelectItem value="title">{t("library.alphabetical")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="document-classification">
              <Tags className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {t("library.type")}
            </Label>
            <Select
              value={filters.classification ?? "all"}
              onValueChange={(value) =>
                updateFilters({
                  classification:
                    value === "all" ? undefined : documentClassificationSchema.parse(value),
                })
              }
            >
              <SelectTrigger id="document-classification" className="min-h-11 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={portalContainer}>
                <SelectItem value="all">{t("library.allTypes")}</SelectItem>
                {documentClassificationSchema.options.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`classification.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 self-end">
            <div
              role="group"
              aria-label={t("library.display")}
              className="flex gap-1 rounded-lg border border-border bg-muted/60 p-1"
            >
              <Button
                type="button"
                variant={display === "grid" ? "outline" : "ghost"}
                aria-pressed={display === "grid"}
                className="min-h-11 flex-1 aria-pressed:bg-background aria-pressed:hover:bg-background"
                onClick={() => setDisplay("grid")}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
                {t("library.icons")}
              </Button>
              <Button
                type="button"
                variant={display === "list" ? "outline" : "ghost"}
                aria-pressed={display === "list"}
                className="min-h-11 flex-1 aria-pressed:bg-background aria-pressed:hover:bg-background"
                onClick={() => setDisplay("list")}
              >
                <List className="size-4" aria-hidden="true" />
                {t("library.list")}
              </Button>
            </div>
          </div>
        </div>
      </form>
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <DocumentFailure
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          {query.data.documents.length === 0 ? (
            <EmptyState
              title={t(filters.q || filters.classification ? "library.noResults" : "empty")}
              description={t(
                filters.q || filters.classification ? "library.noResultsHelp" : "emptyHelp",
              )}
              action={
                filters.q || filters.classification ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchText("");
                      updateFilters({ q: "", classification: undefined });
                    }}
                  >
                    {t("library.reset")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {[...groups].map(([group, documents]) => (
                <section key={group} className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {filters.group === "type"
                      ? t(`classification.${group}`)
                      : monthFormat.format(new Date(`${group}-01T12:00:00Z`))}
                  </h2>
                  <ul
                    className={
                      display === "grid"
                        ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                        : "divide-y divide-border"
                    }
                  >
                    {documents.map((document) => (
                      <li key={document.id} className="min-w-0">
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: document.id }}
                          className={
                            display === "grid"
                              ? "group flex h-full min-w-0 flex-col gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 motion-reduce:transition-none"
                              : "group flex min-w-0 items-start gap-4 rounded-xl p-4 transition-colors duration-200 ease-in-out hover:bg-muted/60 focus-visible:bg-muted/60 motion-reduce:transition-none"
                          }
                        >
                          {display === "grid" ? (
                            <DocumentCover
                              key={`${identity.user.id}:${identity.session.id}:${document.id}:${document.revision}:${document.canDownload}`}
                              identity={identity}
                              document={document}
                            />
                          ) : ["queued", "scanning", "reading"].includes(document.state) ? (
                            <DocumentProcessingIndicator />
                          ) : (
                            <FileText
                              className="mt-1 size-5 shrink-0 text-muted-foreground"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          )}
                          <div className="w-full min-w-0 flex-1 space-y-1">
                            <h3 className="break-words font-medium">
                              {document.title ??
                                t(`classification.${document.classification ?? document.category}`)}
                            </h3>
                            <DocumentLabels document={document} />
                            {display === "list" && (
                              <>
                                <p className="text-sm text-muted-foreground">
                                  {t("listMeta", {
                                    date: format.format(new Date(document.createdAt)),
                                  })}
                                </p>
                                <p className="break-words text-xs text-muted-foreground">
                                  {document.name}
                                </p>
                                {document.state !== "ready" && (
                                  <p className="text-sm">{t(`state.${document.state}`)}</p>
                                )}
                              </>
                            )}
                          </div>
                          {display === "list" && (
                            <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {(cursors.length > 0 || query.data.nextCursor) && (
            <nav aria-label={t("pagination")} className="flex gap-3">
              <Button
                variant="outline"
                disabled={cursors.length === 0 || query.isFetching}
                onClick={() => setCursors((value) => value.slice(0, -1))}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                disabled={!query.data.nextCursor || query.isFetching}
                onClick={() => {
                  if (query.data.nextCursor)
                    setCursors((value) => [...value, query.data.nextCursor as string]);
                }}
              >
                {t("next")}
              </Button>
            </nav>
          )}
        </>
      )}
      <p className="text-sm text-muted-foreground">
        {t("manualHelp")}{" "}
        <Link
          to="/profile"
          search={{}}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t("profile")}
        </Link>
      </p>
    </div>
  );
}
export function DocumentsPage() {
  return <IdentityBoundary>{(identity) => <Documents identity={identity} />}</IdentityBoundary>;
}
