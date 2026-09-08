import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  documentIdentityDocumentTypeSchema,
  type DocumentSummary,
  type DocumentIdentityDocumentType,
} from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { DocumentFailure } from "../documents/DocumentFailure";
import { DocumentLoadingMessage } from "../documents/DocumentLoadingMessage";
import { DocumentProgress } from "../documents/DocumentProgress";
import { forgetIdentity } from "../identity/session-state";
import { IdentityAttachmentSource, type IdentityAttachmentSide } from "./IdentityAttachmentSource";

type Attachment = Awaited<ReturnType<typeof api.identityAttachment>>;
type AttachmentInput = Parameters<typeof api.saveIdentityAttachment>[0];
type Selection = { file?: File; document?: DocumentSummary; token?: string };
type Selections = Record<IdentityAttachmentSide, Selection | null>;
type Upload = { key: string; analysisRequested: boolean; id?: string; document?: DocumentSummary };

export function IdentityAttachmentPicker({
  identity,
  attachment,
  portalContainer,
  onClose,
  onSaved,
  onRefresh,
}: {
  identity: IdentityMe;
  attachment: Attachment;
  portalContainer: HTMLDivElement | null;
  onClose: () => void;
  onSaved: (value: Attachment) => void;
  onRefresh: () => Promise<Attachment>;
}) {
  const { t } = useTranslation("authorizations");
  const { t: td } = useTranslation("documents");
  const client = useQueryClient();
  const [base, setBase] = useState(attachment);
  const currentBase = useRef(attachment);
  const profileId = attachment.profileId;
  const [documentType, setDocumentType] = useState<DocumentIdentityDocumentType>(
    attachment.documentTypeSource === "declared" ? attachment.documentType : "unknown",
  );
  const passport =
    documentType === "passport" ||
    (documentType === "unknown" && base.documentTypeSource === "detected" && !base.backRequired);
  const [mode, setMode] = useState<"combined" | "separate">(
    attachment.combined ? "combined" : "separate",
  );
  const [selections, setSelections] = useState<Selections>(() => ({
    combined: attachment.combined ? { document: attachment.combined } : null,
    front: attachment.front ? { document: attachment.front } : null,
    back: attachment.back ? { document: attachment.back } : null,
  }));
  const [errors, setErrors] = useState<Partial<Record<IdentityAttachmentSide, string | undefined>>>(
    {},
  );
  const [cursors, setCursors] = useState<string[]>([]);
  const [phase, setPhase] = useState<"preparing" | "uploading" | "associating">("preparing");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const uploads = useRef(new Map<string, Upload>());
  const association = useRef<{ payload: string; key: string } | null>(null);
  const controller = useRef(new AbortController());
  const form = useForm({ defaultValues: { analysisRequested: true } });
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const candidates = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "identity-document-candidates",
      profileId,
      cursors.at(-1) ?? null,
    ],
    queryFn: ({ signal }) =>
      api.documents(
        cursors.at(-1),
        { signal },
        { profileId, classification: "identity", sort: "newest" },
      ),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const sides: IdentityAttachmentSide[] =
    mode === "combined"
      ? ["combined"]
      : passport && !selections.back
        ? ["front"]
        : ["front", "back"];
  const mutation = useMutation({
    mutationKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "identity-attachment-save",
      profileId,
    ],
    gcTime: 0,
    mutationFn: async (analysisRequested: boolean) => {
      const chosen = selections;
      const activeSides = [...sides];
      const resolveId = (side: IdentityAttachmentSide) => {
        const entry = chosen[side];
        if (entry?.file && entry.token)
          return uploads.current.get(entry.token)?.document?.id ?? null;
        return entry?.document?.id ?? null;
      };
      const associate = async () => {
        const ids = {
          combinedId: mode === "combined" ? resolveId("combined") : null,
          frontId: mode === "separate" ? resolveId("front") : null,
          backId: mode === "separate" ? resolveId("back") : null,
        };
        if (
          currentBase.current.status !== "needs_attention" &&
          documentType ===
            (currentBase.current.documentTypeSource === "declared"
              ? currentBase.current.documentType
              : "unknown") &&
          ids.combinedId === (currentBase.current.combined?.id ?? null) &&
          ids.frontId === (currentBase.current.front?.id ?? null) &&
          ids.backId === (currentBase.current.back?.id ?? null)
        )
          return currentBase.current;
        setPhase("associating");
        const input: AttachmentInput = {
          profileId,
          documentType,
          revision: currentBase.current.revision,
          ...ids,
        };
        const payload = JSON.stringify(input);
        if (association.current?.payload !== payload)
          association.current = { payload, key: crypto.randomUUID() };
        const result = await api.saveIdentityAttachment(input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: association.current.key,
          signal: controller.current.signal,
        });
        controller.current.signal.throwIfAborted();
        currentBase.current = result;
        setBase(result);
        association.current = null;
        client.setQueryData(
          ["private", identity.user.id, identity.session.id, "identity-attachment", profileId],
          result,
        );
        return result;
      };
      for (const side of activeSides) {
        const entry = chosen[side];
        if (!entry?.file || !entry.token) continue;
        let upload = uploads.current.get(entry.token);
        if (!upload) {
          upload = { key: crypto.randomUUID(), analysisRequested };
          uploads.current.set(entry.token, upload);
        }
        if (!upload.document) {
          setPhase("preparing");
          const options = {
            csrfToken: identity.csrfToken,
            idempotencyKey: upload.key,
            signal: controller.current.signal,
          };
          if (!upload.id) {
            const digest = await crypto.subtle.digest("SHA-256", await entry.file.arrayBuffer());
            controller.current.signal.throwIfAborted();
            const checksum = Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, "0"),
            ).join("");
            const created = await api.createDocument(
              {
                profileId,
                name: entry.file.name,
                size: entry.file.size,
                mime: entry.file.type,
                checksum,
                analysisRequested: upload.analysisRequested,
                purpose: "identity_card",
              },
              options,
            );
            upload.id = created.id;
          }
          setPhase("uploading");
          upload.document = await api.uploadDocument(upload.id, entry.file, options);
          controller.current.signal.throwIfAborted();
          const document = upload.document;
          setSelections((current) =>
            current[side]?.token === entry.token
              ? { ...current, [side]: { ...current[side], document } }
              : current,
          );
        }
        // Persist each accepted face before starting the next upload.
        await associate();
      }
      return associate();
    },
    onSuccess: (result) => {
      if (controller.current.signal.aborted) return;
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      onSaved(result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) void forgetIdentity(client);
    },
    retry: false,
  });
  const pending = mutation.isPending || refreshing;
  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409;
  const hasFiles = sides.some((side) => Boolean(selections[side]?.file));
  const analysisLocked = sides.some((side) => {
    const token = selections[side]?.token;
    return token ? uploads.current.has(token) : false;
  });
  const available = (candidates.data?.documents ?? []).filter(
    (document) =>
      document.category === "identity" &&
      !["pending", "quarantined", "deleting", "deleted"].includes(document.state),
  );
  const progressLabel = phase === "associating" ? t("saving") : td(phase);
  const hasSavedOriginal = sides.some((side) => Boolean(selections[side]?.document));
  const emptyUnchanged = !sides.some((side) => selections[side]) && base.status === "missing";
  const invalidAttachment =
    mutation.error instanceof ApiError && mutation.error.code === "DOCUMENT_ATTACHMENT_INVALID";
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        portalContainer={portalContainer}
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-5 text-sm sm:max-w-3xl sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{t("identityPiece.dialogTitle")}</DialogTitle>
          <DialogDescription className="text-sm">{t("identityPiece.help")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-5"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              if (!pending && !conflict && !sides.some((side) => errors[side]))
                mutation.mutate(values.analysisRequested);
            })(event);
          }}
        >
          <div className="min-h-0 space-y-5 overflow-y-auto px-1 pb-1">
            <div className="space-y-2">
              <Label htmlFor="identity-document-type">{t("identityPiece.typeLabel")}</Label>
              <Select
                value={documentType}
                disabled={pending}
                onValueChange={(value) => {
                  const parsed = documentIdentityDocumentTypeSchema.safeParse(value);
                  if (parsed.success) {
                    setDocumentType(parsed.data);
                    mutation.reset();
                  }
                }}
              >
                <SelectTrigger id="identity-document-type" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={portalContainer}>
                  {documentIdentityDocumentTypeSchema.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(
                        type === "unknown"
                          ? "identityPiece.automaticType"
                          : `identityPiece.types.${type}`,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("identityPiece.typeHelp")}</p>
            </div>
            <Tabs
              value={mode}
              onValueChange={(value) => {
                if (pending) return;
                setMode(value === "separate" ? "separate" : "combined");
                mutation.reset();
              }}
            >
              {!passport && (
                <TabsList className="grid min-h-[50px] w-full grid-cols-2">
                  <TabsTrigger value="combined" disabled={pending} className="min-h-11">
                    {t("identityPiece.oneFile")}
                  </TabsTrigger>
                  <TabsTrigger value="separate" disabled={pending} className="min-h-11">
                    {t("identityPiece.twoFaces")}
                  </TabsTrigger>
                </TabsList>
              )}
              <TabsContent value={mode} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    passport
                      ? "identityPiece.passportHelp"
                      : mode === "combined"
                        ? "identityPiece.combinedHelp"
                        : "identityPiece.separateHelp",
                  )}
                </p>
                <div className={sides.length === 1 ? "" : "grid gap-4 sm:grid-cols-2"}>
                  {sides.map((side) => (
                    <IdentityAttachmentSource
                      key={side}
                      side={side}
                      label={
                        passport && side !== "back"
                          ? t("identityPiece.passportPage")
                          : t(`identityPiece.side.${side}`)
                      }
                      file={selections[side]?.file}
                      document={selections[side]?.document}
                      available={available.filter(
                        (document) =>
                          !sides.some(
                            (other) =>
                              other !== side &&
                              (selections[other]?.document?.id === document.id ||
                                selections[other]?.document?.checksum === document.checksum),
                          ),
                      )}
                      disabled={pending}
                      loading={candidates.isPending}
                      error={errors[side]}
                      portalContainer={portalContainer}
                      onFile={(file) => {
                        const invalidSize = file.size === 0 || file.size > 20 * 1024 * 1024;
                        const invalidFormat = ![
                          "application/pdf",
                          "image/jpeg",
                          "image/png",
                          "image/webp",
                        ].includes(file.type);
                        setErrors((current) => ({
                          ...current,
                          [side]: invalidSize
                            ? td("sizeError")
                            : invalidFormat
                              ? t("identityPiece.formatError")
                              : undefined,
                        }));
                        mutation.reset();
                        if (invalidSize || invalidFormat) return;
                        setSelections((current) => ({
                          ...current,
                          [side]: { file, token: crypto.randomUUID() },
                        }));
                      }}
                      onExisting={(document) => {
                        setSelections((current) => ({ ...current, [side]: { document } }));
                        setErrors((current) => ({ ...current, [side]: undefined }));
                        mutation.reset();
                      }}
                      onClear={() => {
                        setSelections((current) => ({ ...current, [side]: null }));
                        setErrors((current) => ({ ...current, [side]: undefined }));
                        mutation.reset();
                      }}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            {candidates.isError && (
              <DocumentFailure error={candidates.error} onRetry={() => void candidates.refetch()} />
            )}
            {!candidates.isPending && !candidates.isError && available.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("identityPiece.noExisting")}</p>
            )}
            {(cursors.length > 0 || candidates.data?.nextCursor) && (
              <nav className="flex flex-wrap gap-3" aria-label={t("identityPiece.pagination")}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || candidates.isFetching || cursors.length === 0}
                  onClick={() => setCursors((current) => current.slice(0, -1))}
                >
                  {td("previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || candidates.isFetching || !candidates.data?.nextCursor}
                  onClick={() => {
                    const cursor = candidates.data?.nextCursor;
                    if (cursor) setCursors((current) => [...current, cursor]);
                  }}
                >
                  {td("next")}
                </Button>
              </nav>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("identityPiece.cameraHelp")}
            </p>
            {hasFiles && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  disabled={pending || analysisLocked}
                  {...form.register("analysisRequested")}
                />
                <span>
                  <span className="block font-medium">{td("analyzeChoice")}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {td("aiDisclosure")}
                  </span>
                </span>
              </label>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("identityPiece.retention")}
            </p>
            {mutation.isPending && (
              <div className="space-y-3" role="status">
                <p className="text-sm">{progressLabel}</p>
                <DocumentProgress label={progressLabel} />
                {phase !== "associating" && (
                  <DocumentLoadingMessage
                    key={phase}
                    phase={phase}
                    connectionPaused={mutation.isPaused}
                  />
                )}
              </div>
            )}
            {mutation.isError &&
              (conflict ? (
                <div role="alert" className="space-y-3">
                  <p className="text-sm text-amber-700">{t("identityPiece.conflict")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setRefreshing(true);
                      setRefreshFailed(false);
                      void onRefresh()
                        .then((latest) => {
                          if (controller.current.signal.aborted) return;
                          currentBase.current = latest;
                          setBase(latest);
                          association.current = null;
                          mutation.reset();
                        })
                        .catch(() => {
                          if (!controller.current.signal.aborted) setRefreshFailed(true);
                        })
                        .finally(() => {
                          if (!controller.current.signal.aborted) setRefreshing(false);
                        });
                    }}
                  >
                    {t("identityPiece.refresh")}
                  </Button>
                  {refreshFailed && (
                    <p className="text-sm text-red-700">{t("identityPiece.refreshFailed")}</p>
                  )}
                </div>
              ) : invalidAttachment ? (
                <p role="alert" className="text-sm text-red-700">
                  {t("identityPiece.invalidAttachment")}
                </p>
              ) : (
                <DocumentFailure
                  error={mutation.error}
                  onRetry={() => mutation.mutate(form.getValues("analysisRequested"))}
                />
              ))}
            {base.revision !== attachment.revision && (
              <p role="status" className="text-xs text-muted-foreground">
                {t("identityPiece.partialSaved")}
              </p>
            )}
          </div>
          <DialogFooter className="gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t(hasSavedOriginal ? "identityPiece.close" : "cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                pending || conflict || emptyUnchanged || sides.some((side) => Boolean(errors[side]))
              }
            >
              {t(pending ? "saving" : "identityPiece.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
