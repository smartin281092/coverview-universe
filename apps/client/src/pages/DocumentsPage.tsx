import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Plus, Search } from "lucide-react";
import {
  Button,
  Input,
  Label,
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

function Documents({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("documents");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
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
    queryFn: ({ signal }) => api.documents(cursors.at(-1), { signal }, filters),
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
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="max-w-xl text-muted-foreground">{t("description")}</p>
        </div>
        <Sheet open={open && !!portalContainer} onOpenChange={setOpen}>
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
                onDone={(document) => {
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
      <AuthorizationNotice />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilters({ q: searchText.trim() });
        }}
        role="search"
        aria-label={t("library.search")}
      >
        <div className="min-w-0 flex-1 basis-60 space-y-2">
          <Label htmlFor="document-search">{t("library.search")}</Label>
          <Input
            className="min-h-11"
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
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          <Search className="size-4" aria-hidden="true" />
          {t("library.searchAction")}
        </Button>
        <div className="space-y-2">
          <Label htmlFor="document-group">{t("library.group")}</Label>
          <select
            id="document-group"
            className="min-h-11 rounded-md bg-muted px-3 text-sm"
            value={filters.group}
            onChange={(event) =>
              updateFilters({ group: event.target.value === "type" ? "type" : "date" })
            }
          >
            <option value="date">{t("library.byDate")}</option>
            <option value="type">{t("library.byType")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-sort">{t("library.sort")}</Label>
          <select
            id="document-sort"
            className="min-h-11 rounded-md bg-muted px-3 text-sm"
            value={filters.sort}
            onChange={(event) =>
              updateFilters({
                sort:
                  event.target.value === "oldest"
                    ? "oldest"
                    : event.target.value === "title"
                      ? "title"
                      : "newest",
              })
            }
          >
            <option value="newest">{t("library.newest")}</option>
            <option value="oldest">{t("library.oldest")}</option>
            <option value="title">{t("library.alphabetical")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-classification">{t("library.type")}</Label>
          <select
            id="document-classification"
            className="min-h-11 max-w-full rounded-md bg-muted px-3 text-sm"
            value={filters.classification ?? "all"}
            onChange={(event) =>
              updateFilters({
                classification:
                  event.target.value === "all"
                    ? undefined
                    : documentClassificationSchema.parse(event.target.value),
              })
            }
          >
            <option value="all">{t("library.allTypes")}</option>
            {documentClassificationSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`classification.${value}`)}
              </option>
            ))}
          </select>
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
                  <ul className="divide-y divide-border">
                    {documents.map((document) => (
                      <li key={document.id}>
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: document.id }}
                          className="group flex min-w-0 items-start gap-4 py-4"
                        >
                          {["queued", "scanning", "reading"].includes(document.state) ? (
                            <DocumentProcessingIndicator />
                          ) : (
                            <FileText
                              className="mt-1 size-5 shrink-0 text-muted-foreground"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="break-words font-medium group-hover:underline">
                              {document.title ??
                                t(`classification.${document.classification ?? document.category}`)}
                            </h3>
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
                          </div>
                          <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
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
