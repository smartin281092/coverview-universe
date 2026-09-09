import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import {
  authorizationSignInputSchema,
  type AuthorizationDocument,
  type AuthorizationReceipt,
} from "@coverview/contracts";
import { Button, Input, Label } from "@coverview/ui";
import { api } from "../../api";
import { SignaturePad } from "./SignaturePad";

export function AuthorizationSignatureForm({
  identity,
  document,
  onSigned,
}: {
  identity: IdentityMe;
  document: AuthorizationDocument;
  onSigned: (receipt: AuthorizationReceipt) => Promise<void>;
}) {
  const { t } = useTranslation("authorizations");
  const abort = useRef(new AbortController());
  const command = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    const active = new AbortController();
    abort.current = active;
    return () => active.abort();
  }, []);
  const form = useForm<z.input<typeof authorizationSignInputSchema>>({
    resolver: zodResolver(authorizationSignInputSchema),
    defaultValues: {
      profileId: document.profileId,
      profileRevision: document.profileRevision,
      contentHash: document.contentHash,
      signerName: document.profileId === "self" ? document.profileName : "",
      place: document.values.city ?? "",
      representative: false,
      drawing: [],
    },
  });
  const mutation = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "authorization-sign"],
    gcTime: 0,
    retry: false,
    mutationFn: (input: z.infer<typeof authorizationSignInputSchema>) => {
      const payload = JSON.stringify(input);
      if (command.current?.payload !== payload)
        command.current = { payload, key: crypto.randomUUID() };
      return api.signAuthorization(document.kind, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: async (receipt) => {
      if (!abort.current.signal.aborted) await onSigned(receipt);
    },
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => void form.handleSubmit((input) => mutation.mutate(input))(event)}
    >
      <fieldset disabled={mutation.isPending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="authorization-signer">{t("signing.signer")}</Label>
            <Input
              id="authorization-signer"
              autoComplete="name"
              readOnly={document.profileId === "self"}
              {...form.register("signerName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorization-place">{t("place")}</Label>
            <Input id="authorization-place" autoComplete="off" {...form.register("place")} />
          </div>
        </div>
        <Controller
          control={form.control}
          name="drawing"
          render={({ field }) => (
            <SignaturePad
              value={field.value}
              onChange={field.onChange}
              disabled={mutation.isPending}
            />
          )}
        />
        {document.profileId !== "self" && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              className="size-4 shrink-0 accent-primary"
              type="checkbox"
              {...form.register("representative")}
            />
            {document.profileName
              ? t("signing.representative", { name: document.profileName })
              : t("signing.representativeUnnamed")}
          </label>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-4 shrink-0 accent-primary"
            type="checkbox"
            {...form.register("accepted")}
          />
          {t("signing.accept")}
        </label>
        <p className="text-sm text-muted-foreground">{t("signing.evidenceHelp")}</p>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("signing.invalid")}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("signing.failed")}
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending || !document.canSign}>
        {t(mutation.isPending ? "signing.saving" : "signing.sign")}
      </Button>
    </form>
  );
}
