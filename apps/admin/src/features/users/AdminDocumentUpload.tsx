import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentRecord } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

export function AdminDocumentUpload({
  identity,
  userId,
  profileId,
  blocked,
  pendingDocument,
  onDone,
  onPending,
  portalContainer,
}: {
  identity: IdentityMe;
  userId: string;
  profileId: string;
  blocked: boolean;
  pendingDocument?: DocumentRecord;
  onDone: (document: DocumentRecord) => void;
  onPending: (pending: boolean) => void;
  portalContainer: HTMLDivElement | null;
}) {
  const { t } = useTranslation("users");
  const client = useQueryClient();
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [documentId, setDocumentId] = useState(pendingDocument?.id);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const operation = useRef<{ key: string; id: string | undefined; signature?: string }>({
    key: crypto.randomUUID(),
    id: pendingDocument?.id,
  });
  const form = useForm({
    defaultValues: { analysisRequested: pendingDocument?.analysisRequested ?? true },
  });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    onPending(pending);
    return () => onPending(false);
  }, [pending, onPending]);
  const blocker = useBlocker({
    shouldBlockFn: () => busy.current,
    enableBeforeUnload: () => busy.current,
    withResolver: true,
  });
  const invalidFile = !!file && (file.size === 0 || file.size > 20 * 1024 * 1024);
  const upload = form.handleSubmit(async ({ analysisRequested }) => {
    if (!file || invalidFile || busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    setUploading(false);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const options = () => ({
      csrfToken: identity.csrfToken,
      idempotencyKey: operation.current.key,
      signal: active.signal,
    });
    try {
      if (!operation.current.id) {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        active.signal.throwIfAborted();
        const checksum = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const input = {
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          checksum,
          analysisRequested,
        };
        const signature = JSON.stringify(input);
        if (operation.current.signature !== signature) {
          operation.current.signature = signature;
          operation.current.key = crypto.randomUUID();
        }
        const created = await api.createAdminDocument(userId, profileId, input, options());
        active.signal.throwIfAborted();
        operation.current.id = created.id;
        setDocumentId(created.id);
        void client.invalidateQueries({
          queryKey: [
            "private",
            identity.user.id,
            identity.session.id,
            "admin-user",
            userId,
            "documents",
            profileId,
          ],
        });
      }
      setUploading(true);
      const result = await api.uploadAdminDocument(
        userId,
        profileId,
        operation.current.id,
        file,
        options(),
      );
      if (!active.signal.aborted) onDone(result);
    } catch (error) {
      if (!active.signal.aborted) {
        setFailure(error);
        void client.invalidateQueries({
          queryKey: [
            "private",
            identity.user.id,
            identity.session.id,
            "admin-user",
            userId,
            "documents",
            profileId,
          ],
        });
      }
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  });
  return (
    <>
      <form className="space-y-6" onSubmit={(event) => void upload(event)}>
        <div className="space-y-3">
          <Label htmlFor="admin-document-file">{t("documents.file")}</Label>
          <Input
            id="admin-document-file"
            type="file"
            disabled={pending || blocked}
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setFailure(null);
            }}
          />
          <p className="text-sm text-muted-foreground">
            {t(documentId ? "documents.resumeDescription" : "documents.formats")}
          </p>
          {invalidFile && (
            <p role="alert" className="text-sm text-destructive">
              {t("documents.invalidFile")}
            </p>
          )}
        </div>
        {!pendingDocument && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-primary"
              disabled={pending || blocked || !!documentId}
              {...form.register("analysisRequested")}
            />
            <span className="space-y-2">
              <span className="block font-medium">{t("documents.analyze")}</span>
              <span className="block text-muted-foreground">{t("documents.disclosure")}</span>
            </span>
          </label>
        )}
        {failure ? <AdminFailure error={failure} onRetry={() => void upload()} /> : null}
        <Button
          type="submit"
          disabled={!file || invalidFile || pending || blocked}
          className="min-h-11 w-full sm:w-auto"
        >
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {t(
            pending
              ? uploading
                ? "documents.uploading"
                : "documents.preparing"
              : documentId
                ? "documents.resumeTitle"
                : "documents.upload",
          )}
        </Button>
        <p className="text-xs text-muted-foreground">{t("documents.retention")}</p>
      </form>
      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("documents.busyTitle")}</DialogTitle>
            <DialogDescription>{t("documents.busyDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => blocker.reset?.()}>{t("guard.stay")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
