import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CircleCheck, IdCard, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button } from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "../documents/DocumentFailure";
import { DocumentProcessingIndicator } from "../documents/DocumentProcessingIndicator";
import { DocumentProgress } from "../documents/DocumentProgress";
import { IdentityAttachmentPicker } from "./IdentityAttachmentPicker";

export function IdentityAttachment({
  identity,
  onChanged,
}: {
  identity: IdentityMe;
  onChanged: () => void;
}) {
  const { t } = useTranslation("authorizations");
  const { t: td } = useTranslation("documents");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "identity-attachment"],
    queryFn: ({ signal }) => api.identityAttachment({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const value = query.state.data;
      return [value?.combined, value?.front, value?.back].some(
        (document) => document && ["queued", "scanning", "reading"].includes(document.state),
      )
        ? 5000
        : false;
    },
  });
  const value = query.data;
  const readyVersion =
    value?.status === "ready"
      ? [
          value.revision,
          value.combined?.revision,
          value.front?.revision,
          value.back?.revision,
        ].join("/")
      : null;
  useEffect(() => {
    if (readyVersion)
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "profile"],
      });
  }, [readyVersion, client, identity.user.id, identity.session.id]);
  const entries = [
    { side: "combined", document: value?.combined },
    { side: "front", document: value?.front },
    { side: "back", document: value?.back },
  ].filter((entry) => entry.document);
  return (
    <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
      <div ref={setPortalContainer} className="contents" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <IdCard className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          {t("identityPiece.title")}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!value || query.isError || !portalContainer}
          onClick={() => setOpen(true)}
        >
          {entries.length ? (
            <Pencil className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {t(entries.length ? "identityPiece.edit" : "identityPiece.add")}
        </Button>
      </div>
      {query.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <DocumentProcessingIndicator />
          {t("identityPiece.loading")}
        </p>
      ) : query.isError ? (
        <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <p
            role="status"
            className={`flex items-center gap-2 text-sm ${
              query.data.status === "ready"
                ? "text-green-700"
                : query.data.status === "processing"
                  ? "text-muted-foreground"
                  : query.data.status === "needs_attention"
                    ? "text-amber-700"
                    : "text-red-600"
            }`}
          >
            {query.data.status === "ready" ? (
              <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            ) : query.data.status === "processing" ? (
              <DocumentProcessingIndicator />
            ) : (
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            )}
            {t(`identityPiece.status.${query.data.status}`)}
          </p>
          {entries.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {entries.map(({ side, document }) =>
                document ? (
                  <li key={side} className="min-w-0 space-y-1 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(`identityPiece.side.${side}`)}
                    </p>
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: document.id }}
                      className="inline-flex min-h-11 items-center break-words rounded-lg text-sm font-medium text-indigo-600 underline-offset-4 hover:underline"
                    >
                      {document.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{td(`state.${document.state}`)}</p>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          {query.data.status === "processing" && (
            <DocumentProgress label={t("identityPiece.status.processing")} />
          )}
        </>
      )}
      {open && value && (
        <IdentityAttachmentPicker
          identity={identity}
          attachment={value}
          portalContainer={portalContainer}
          onClose={() => setOpen(false)}
          onSaved={(result) => {
            client.setQueryData(
              ["private", identity.user.id, identity.session.id, "identity-attachment"],
              result,
            );
            onChanged();
            setOpen(false);
          }}
          onRefresh={async () => {
            const result = await query.refetch({ throwOnError: true });
            if (!result.data) throw new Error("Identity attachment unavailable");
            return result.data;
          }}
        />
      )}
    </section>
  );
}
