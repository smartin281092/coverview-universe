import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Input, Label } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import type { DocumentRecord } from "@coverview/contracts";
import { api } from "../../api";
import { DocumentFailure } from "./DocumentFailure";

export function DocumentUpload({
  identity,
  pending,
  onDone,
}: {
  identity: IdentityMe;
  pending?: DocumentRecord;
  onDone: (document: DocumentRecord) => void;
}) {
  const { t } = useTranslation("documents");
  const [file, setFile] = useState<File>();
  const [tooLarge, setTooLarge] = useState(false);
  const [step, setStep] = useState<"preparing" | "uploading">("preparing");
  const operation = useRef({ key: crypto.randomUUID(), id: pending?.id });
  const controller = useRef(new AbortController());
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const form = useForm({ defaultValues: { analysisRequested: true } });
  const mutation = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "document-upload"],
    gcTime: 0,
    mutationFn: async (analysisRequested: boolean) => {
      if (!file) throw new Error("Missing file");
      setStep("preparing");
      const options = {
        csrfToken: identity.csrfToken,
        idempotencyKey: operation.current.key,
        signal: controller.current.signal,
      };
      if (!operation.current.id) {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const checksum = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const document = await api.createDocument(
          { name: file.name, size: file.size, mime: file.type, checksum, analysisRequested },
          options,
        );
        operation.current.id = document.id;
      }
      setStep("uploading");
      return api.uploadDocument(operation.current.id, file, options);
    },
    onSuccess: (result) => {
      if (!controller.current.signal.aborted) onDone(result);
    },
    retry: false,
  });
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        void form.handleSubmit((values) => mutation.mutate(values.analysisRequested))(event);
      }}
    >
      {pending && (
        <p className="text-sm text-muted-foreground">
          {t(pending.analysisRequested ? "resumeWithAi" : "resumeWithoutAi")}
        </p>
      )}
      <div className="space-y-3">
        <Label htmlFor="document-file">{t(pending ? "resumeFile" : "chooseFile")}</Label>
        <Input
          id="document-file"
          type="file"
          disabled={mutation.isPending}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setTooLarge(!!selected && (selected.size > 20 * 1024 * 1024 || selected.size === 0));
            setFile(selected);
            mutation.reset();
            if (!operation.current.id) operation.current.key = crypto.randomUUID();
          }}
        />
        <p className="text-sm text-muted-foreground">{t(pending ? "resumeHelp" : "formats")}</p>
        {tooLarge && (
          <p role="alert" className="text-sm text-destructive">
            {t("sizeError")}
          </p>
        )}
      </div>
      {!pending && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-primary"
            disabled={mutation.isPending || !!operation.current.id}
            {...form.register("analysisRequested")}
          />
          <span>
            <span className="block font-medium">{t("analyzeChoice")}</span>
            <span className="mt-2 block text-muted-foreground">{t("aiDisclosure")}</span>
          </span>
        </label>
      )}
      {mutation.isError && (
        <DocumentFailure
          error={mutation.error}
          onRetry={() => mutation.mutate(form.getValues("analysisRequested"))}
        />
      )}
      <Button
        className="min-h-11 w-full sm:w-auto"
        type="submit"
        disabled={!file || tooLarge || mutation.isPending}
      >
        {mutation.isPending ? t(step) : t(pending ? "resumeUpload" : "saveDocument")}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("retention")}</p>
    </form>
  );
}
