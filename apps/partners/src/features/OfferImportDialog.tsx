import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import type { LeadDetail, OfferImport, offerImportInputSchema } from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { OfferDialog } from "./OfferDialog";

type Upload = {
  id: string;
  file: File;
  status: "selected" | "hashing" | "uploading" | "done" | "error";
  error?: string;
};
type Attempt = { key: string; input?: z.infer<typeof offerImportInputSchema>; item?: OfferImport };

export function OfferImportDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [uploads, setUploads] = useState<Upload[]>([]),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [cursor, setCursor] = useState<string>();
  const [pages, setPages] = useState<(string | undefined)[]>([]);
  const [selected, setSelected] = useState<OfferImport | null>(null);
  const attempts = useRef(new Map<string, Attempt>()),
    revision = useRef(lead.revision);
  const controller = useRef<AbortController | null>(null);
  const retryAttempts = useRef(new Map<string, { key: string; revision: number }>());
  const lock = useRef(false);
  const writable =
    session.context.canAdvise &&
    !!lead.allowedActions?.includes("offer") &&
    !["draft", "completed"].includes(lead.stage);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const query = useQuery({
    queryKey: [...session.queryKey, "offer-imports", lead.id, cursor],
    queryFn: ({ signal }) => partnerApi.offerImports(lead.id, cursor, signal),
    gcTime: 0,
    retry: false,
    refetchInterval: 5000,
  });
  const message = (cause: unknown) =>
    cause instanceof PartnerApiError
      ? t(`errors.${cause.code}`, { defaultValue: t("error") })
      : t("error");
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: session.queryKey });
  };
  const update = (id: string, patch: Partial<Upload>) =>
    setUploads((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  async function send(rows: Upload[]) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      for (const row of rows) {
        if (abort.signal.aborted) break;
        let attempt = attempts.current.get(row.id);
        if (!attempt) {
          attempt = { key: crypto.randomUUID() };
          attempts.current.set(row.id, attempt);
        }
        const options = {
          csrfToken: session.identity.csrfToken,
          idempotencyKey: attempt.key,
          signal: abort.signal,
        };
        try {
          if (!row.file.size || row.file.size > 20 * 1024 * 1024)
            throw new PartnerApiError("PARTNER_INVALID_DOCUMENT", 422);
          if (!attempt.input) {
            update(row.id, { status: "hashing" });
            const bytes = await row.file.arrayBuffer();
            const hash = await crypto.subtle.digest("SHA-256", bytes);
            const checksum = Array.from(new Uint8Array(hash), (b) =>
              b.toString(16).padStart(2, "0"),
            ).join("");
            attempt.input = {
              revision: revision.current,
              analysisRequested: true,
              source: {
                name: row.file.name,
                mime: row.file.type || "application/octet-stream",
                size: row.file.size,
                checksum,
              },
            };
          }
          if (!attempt.item) {
            const result = await partnerApi.prepareOfferImport(lead.id, attempt.input, options);
            attempt.item = result.item;
            revision.current = result.leadRevision;
          }
          if (attempt.item.canUpload) {
            update(row.id, { status: "uploading" });
            const result = await partnerApi.uploadOfferImport(
              lead.id,
              attempt.item.id,
              row.file,
              options,
            );
            attempt.item = result.item;
            revision.current = result.leadRevision;
          }
          update(row.id, { status: "done" });
        } catch (cause) {
          if (abort.signal.aborted) break;
          update(row.id, { status: "error", error: message(cause) });
        }
      }
      if (!abort.signal.aborted) await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function retryUpload(row: Upload) {
    // Explicit refresh after a conflicting Lead change; never silently rebase the form.
    if (lock.current) return;
    const attempt = attempts.current.get(row.id);
    try {
      if (!attempt?.item) {
        const current = await partnerApi.lead(lead.id);
        revision.current = current.revision;
        if (attempt?.input && attempt.input.revision !== current.revision) {
          // First replay the original key: a lost response may already have created the receipt.
          try {
            const result = await partnerApi.prepareOfferImport(lead.id, attempt.input, {
              csrfToken: session.identity.csrfToken,
              idempotencyKey: attempt.key,
            });
            attempt.item = result.item;
            revision.current = result.leadRevision;
          } catch (cause) {
            if (!(cause instanceof PartnerApiError) || cause.code !== "PARTNER_CONFLICT")
              throw cause;
            attempt.input = { ...attempt.input, revision: current.revision };
            attempt.key = crypto.randomUUID();
          }
        }
      }
      await send([row]);
    } catch (cause) {
      update(row.id, { status: "error", error: message(cause) });
    }
  }

  async function retryAnalysis(item: OfferImport) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let attempt = retryAttempts.current.get(item.id);
    if (!attempt) {
      attempt = { key: crypto.randomUUID(), revision: item.revision };
      retryAttempts.current.set(item.id, attempt);
    }
    try {
      await partnerApi.retryOfferImport(
        lead.id,
        item.id,
        { revision: attempt.revision, analysisRequested: true },
        { csrfToken: session.identity.csrfToken, idempotencyKey: attempt.key },
      );
      retryAttempts.current.delete(item.id);
      await refresh();
    } catch (cause) {
      if (cause instanceof PartnerApiError && cause.code === "DOCUMENT_CONFLICT")
        retryAttempts.current.delete(item.id);
      setError(message(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (selected)
    return (
      <OfferDialog
        lead={lead}
        imported={selected}
        onClose={() => {
          setSelected(null);
          void refresh();
        }}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("imports.title")}</DialogTitle>
          <DialogDescription>
            {t("imports.description", { object: lead.object, client: lead.clientName })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t(writable ? "offer.extractionNotice" : "imports.readOnly")}
        </p>
        {writable && (
          <div className="space-y-3 rounded-xl border border-dashed border-input p-4">
            <Label htmlFor="offer-import-files">{t("imports.select")}</Label>
            <Input
              id="offer-import-files"
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              disabled={busy || !!uploads.length}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 10) {
                  setError(t("imports.limit"));
                  return;
                }
                setError("");
                setUploads(
                  files.map((file) => ({ id: crypto.randomUUID(), file, status: "selected" })),
                );
              }}
            />
            <p className="text-xs text-muted-foreground">{t("imports.resumeHelp")}</p>
            {!!uploads.length && (
              <>
                <p role="status" className="text-sm">
                  {t("imports.progress", {
                    done: uploads.filter((u) => u.status === "done").length,
                    total: uploads.length,
                  })}
                </p>
                <ul className="space-y-3">
                  {uploads
                    .filter((row) => row.status !== "done")
                    .map((row) => (
                      <li key={row.id} className="space-y-2 text-sm">
                        <p className="break-words font-medium">{row.file.name}</p>
                        <p role={row.status === "error" ? "alert" : "status"}>
                          {row.status === "error" ? row.error : t(`imports.local.${row.status}`)}
                        </p>
                        {row.status === "error" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void retryUpload(row)}
                          >
                            {t("imports.retryUpload")}
                          </Button>
                        )}
                      </li>
                    ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {uploads.some((u) => u.status === "selected") && (
                    <Button
                      disabled={busy || query.isError}
                      onClick={() => void send(uploads.filter((u) => u.status === "selected"))}
                    >
                      {t("imports.start")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setUploads([]);
                      attempts.current.clear();
                    }}
                  >
                    {t("imports.clearSelection")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {query.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t("error")}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <>
            <h3 className="font-medium">{t("imports.saved")}</h3>
            {!query.data.items.length && (
              <p className="text-sm text-muted-foreground">{t("imports.empty")}</p>
            )}
            <ul className="space-y-3">
              {query.data.items.map((item) => (
                <li key={item.id} className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium">{item.name}</p>
                    <Badge variant="outline">
                      {t(item.offerId ? "imports.prepared" : `imports.state.${item.state}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`imports.analysis.${item.analysis}`)}
                  </p>
                  {item.failure && (
                    <p className="text-sm">
                      {t(`imports.failure.${item.failure}`, {
                        defaultValue: t("imports.failure.other"),
                      })}
                    </p>
                  )}
                  {item.canUpload && <p className="text-sm">{t("imports.reselect")}</p>}
                  <div className="flex flex-wrap gap-2">
                    {item.canDownload && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={partnerApi.importSourceUrl(lead.id, item.id)}>
                          {t("offer.source")}
                        </a>
                      </Button>
                    )}
                    {item.canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void retryAnalysis(item)}
                      >
                        {t("imports.retryAnalysis")}
                      </Button>
                    )}
                    {item.canPrepare && (
                      <Button size="sm" disabled={busy} onClick={() => setSelected(item)}>
                        {t("imports.prepare")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                disabled={busy || !pages.length}
                onClick={() => {
                  setCursor(pages.at(-1));
                  setPages((p) => p.slice(0, -1));
                }}
              >
                {t("imports.previous")}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !query.data.nextCursor}
                onClick={() => {
                  setPages((p) => [...p, cursor]);
                  setCursor(query.data.nextCursor ?? undefined);
                }}
              >
                {t("imports.next")}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("imports.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
