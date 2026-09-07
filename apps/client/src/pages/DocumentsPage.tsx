import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import {
  Button,
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
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentUpload } from "../features/documents/DocumentUpload";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { DocumentProcessingIndicator } from "../features/documents/DocumentProcessingIndicator";

function Documents({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("documents");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "documents",
      cursors.at(-1) ?? null,
    ],
    queryFn: ({ signal }) => api.documents(cursors.at(-1), { signal }),
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
            <EmptyState title={t("empty")} description={t("emptyHelp")} />
          ) : (
            <ul className="divide-y divide-border">
              {query.data.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: document.id }}
                    className="group flex min-w-0 items-start gap-4 py-6"
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
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="break-words font-medium group-hover:underline">
                        {document.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("listMeta", {
                          category: t(`category.${document.category}`),
                          date: format.format(new Date(document.createdAt)),
                        })}
                      </p>
                      <p className="text-sm">{t(`state.${document.state}`)}</p>
                    </div>
                    <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
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
