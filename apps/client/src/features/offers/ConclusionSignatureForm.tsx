import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import { conclusionSignSchema, type Conclusion } from "@coverview/contracts/partner-conclusion";
import { Button, Input, Label } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { SignaturePad } from "../authorizations/SignaturePad";
export function ConclusionSignatureForm({
  identity,
  item,
  enabled,
  onSaved,
}: {
  identity: IdentityMe;
  item: Conclusion;
  enabled: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation("conclusion");
  const abort = useRef(new AbortController()),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const form = useForm<z.input<typeof conclusionSignSchema>>({
    resolver: zodResolver(conclusionSignSchema),
    defaultValues: {
      contentHash: item.contentHash,
      signerName: "",
      place: "",
      representative: false,
      drawing: [],
    },
  });
  const mutation = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "offer-signature", item.id],
    gcTime: 0,
    retry: false,
    mutationFn: (input: z.infer<typeof conclusionSignSchema>) => {
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.signConclusion(item.id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      if (!abort.current.signal.aborted) onSaved();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void form.handleSubmit((input) => mutation.mutate(input))(event)}
    >
      <fieldset className="space-y-4" disabled={!enabled || mutation.isPending}>
        <div className="space-y-2">
          <Label htmlFor="offer-signer">{t("signer")}</Label>
          <Input id="offer-signer" autoComplete="name" {...form.register("signerName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-place">{t("place")}</Label>
          <Input id="offer-place" {...form.register("place")} />
        </div>
        <Controller
          control={form.control}
          name="drawing"
          render={({ field }) => (
            <SignaturePad
              value={field.value}
              onChange={field.onChange}
              disabled={!enabled || mutation.isPending}
            />
          )}
        />
        {item.archive?.subjectKey.startsWith("profile:") && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" required {...form.register("representative")} />
            {t("representative")}
          </label>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" {...form.register("originalRead")} />
          {t("originalRead")}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" {...form.register("accepted")} />
          {t("accept")}
        </label>
        <p className="text-sm text-muted-foreground">{t("traceNotice")}</p>
      </fieldset>
      {!!Object.keys(form.formState.errors).length && <p role="alert">{t("invalid")}</p>}
      {mutation.isError && <p role="alert">{t("error")}</p>}
      <Button type="submit" disabled={!enabled || mutation.isPending}>
        {t(mutation.isPending ? "saving" : "sign")}
      </Button>
    </form>
  );
}
