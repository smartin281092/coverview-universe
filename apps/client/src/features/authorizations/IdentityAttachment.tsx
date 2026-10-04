import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleCheck, FileText, IdCard, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentSummary } from "@coverview/contracts";
import { Button } from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "../documents/DocumentFailure";
import { DocumentProcessingIndicator } from "../documents/DocumentProcessingIndicator";
import { DocumentProgress } from "../documents/DocumentProgress";
import { IdentityAttachmentPicker } from "./IdentityAttachmentPicker";
import { IdentityDocumentPreview } from "../documents/IdentityDocumentPreview";
import { DocumentThumbnails } from "../documents/DocumentThumbnails";

export function IdentityAttachment({
  identity,
  profileId = "self",
  company = false,
  blocked = false,
  onChanged,
}: {
  identity: IdentityMe;
  profileId?: string;
  company?: boolean;
  blocked?: boolean;
  onChanged?: () => void;
}) {
  const { t } = useTranslation("authorizations");
  const piece = (key: string) => t(`identityPiece.${key}`, company ? { context: "company" } : {});
  const AttachmentIcon = company ? FileText : IdCard;
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ documentId: string; page: number } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const queryKey = [
    "private",
    identity.user.id,
    identity.session.id,
    "identity-attachment",
    profileId,
  ];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.identityAttachment({ signal }, { profileId }),
    enabled: !blocked,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      const value = query.state.data;
      return [value?.combined, value?.front, value?.back].some(
        (document) => document && ["queued", "scanning", "reading"].includes(document.state),
      )
        ? 5000
        : 15_000;
    },
  });
  useEffect(() => {
    if (blocked) {
      setPreview(null);
    }
  }, [blocked]);
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
    if (readyVersion) {
      void client.invalidateQueries({
        queryKey: [
          "private",
          identity.user.id,
          identity.session.id,
          ...(profileId === "self" ? ["profile"] : ["profile-section", profileId]),
        ],
      });
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
      });
    }
  }, [readyVersion, client, identity.user.id, identity.session.id, profileId]);
  const entries = [
    { side: "combined", document: value?.combined },
    { side: "front", document: value?.front },
    { side: "back", document: value?.back },
  ].filter((entry) => entry.document);
  const documents = entries
    .map((entry) => entry.document)
    .filter((document): document is DocumentSummary => Boolean(document));
  return (
    <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
      <div ref={setPortalContainer} className="contents" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <AttachmentIcon
            className="size-5 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {piece("title")}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={blocked || !value || query.isError || !portalContainer}
          onClick={() => setOpen(true)}
        >
          {entries.length ? (
            <Pencil className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {piece(entries.length ? "edit" : "add")}
        </Button>
      </div>
      {query.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <DocumentProcessingIndicator />
          {piece("loading")}
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
            {piece(`status.${query.data.status}`)}
          </p>
          {documents.length > 0 && !blocked && (
            <ul className="flex flex-wrap gap-3">
              {documents.map((document) => (
                <li key={document.id} className="min-w-0 max-w-full">
                  <DocumentThumbnails
                    identity={identity}
                    document={document}
                    onOpen={(page) => setPreview({ documentId: document.id, page })}
                  />
                </li>
              ))}
            </ul>
          )}
          {query.data.status === "processing" && (
            <DocumentProgress label={piece("status.processing")} />
          )}
        </>
      )}
      {preview && !blocked && !query.isError && (
        <IdentityDocumentPreview
          identity={identity}
          documents={documents.filter((document) => document.id === preview.documentId)}
          initialPage={preview.page}
          company={company}
          scopeKey={profileId}
          portalContainer={portalContainer}
          onClose={() => setPreview(null)}
        />
      )}
      {open && value && !query.isError && (
        <IdentityAttachmentPicker
          identity={identity}
          attachment={value}
          company={company}
          portalContainer={portalContainer}
          onClose={() => setOpen(false)}
          onSaved={(result) => {
            client.setQueryData(queryKey, result);
            onChanged?.();
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
