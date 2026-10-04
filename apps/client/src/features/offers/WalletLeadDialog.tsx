import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { leadCreateInputSchema, leadCategorySchema } from "@coverview/contracts/partner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { api } from "../../api";
import { partnerApi } from "../../partner-api";
export function WalletLeadDialog({
  identity,
  open,
  onClose,
  onCreated,
}: {
  identity: IdentityMe;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation("offers"),
    { scope } = useWalletProfileScope(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [chosenProfile, setChosenProfile] = useState("");
  const profiles = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    enabled: open,
    gcTime: 0,
    retry: false,
  });
  const target = scope === "all" ? chosenProfile : scope;
  const selectedProfile = profiles.data?.profiles.find((profile) => profile.id === target);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto"
        showCloseButton={!pending}
        closeLabel={t("close")}
      >
        <DialogHeader>
          <DialogTitle>{t("requestTitle")}</DialogTitle>
          <DialogDescription>{t("requestDescription")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("advice.afterCreate")}</p>
        {profiles.isError && (
          <div role="alert" className="space-y-2 text-sm">
            <p>{t("error")}</p>
            <Button variant="outline" onClick={() => void profiles.refetch()}>
              {t("retry")}
            </Button>
          </div>
        )}
        {scope === "all" && (
          <div className="space-y-2">
            <Label htmlFor="request-profile">{t("chooseProfile")}</Label>
            <select
              id="request-profile"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={chosenProfile}
              onChange={(event) => setChosenProfile(event.target.value)}
              disabled={profiles.isPending || profiles.isError}
            >
              <option value="">{t("chooseProfile")}</option>
              {profiles.data?.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
        {!!target && (
          <form
            key={`${target}:${selectedProfile?.displayName ?? ""}`}
            className="space-y-4"
            onChange={() => setKey(crypto.randomUUID())}
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const data = new FormData(event.currentTarget),
                field = (name: string) => {
                  const value = data.get(name);
                  return typeof value === "string" ? value.trim() : "";
                };
              const parsed = leadCreateInputSchema.safeParse({
                title: field("subject"),
                category: field("category"),
                object: field("object"),
                objectReference: field("objectReference"),
                context: field("context"),
                clientUserId: identity.user.id,
                clientProfileId: target === "self" ? null : target,
                clientName: field("clientName"),
                email: identity.user.email,
                phone: field("phone"),
                language: "fr",
                source: t("sourceWallet"),
                transmissionAuthorized: data.get("consent") === "on",
                priority: "normal",
                draft: false,
                nextAction: "",
                dueAt: null,
              });
              if (!parsed.success || !parsed.data.transmissionAuthorized) {
                setError(t("error"));
                return;
              }
              setPending(true);
              setError("");
              void partnerApi
                .create(parsed.data, { csrfToken: identity.csrfToken, idempotencyKey: key }, true)
                .then((lead) => {
                  onClose();
                  onCreated(lead.id);
                  setKey(crypto.randomUUID());
                })
                .catch(() => setError(t("error")))
                .finally(() => setPending(false));
            }}
          >
            {["clientName", "subject", "object", "objectReference", "phone"].map((name) => (
              <div className="space-y-2" key={name}>
                <Label htmlFor={`request-${name}`}>{t(name)}</Label>
                <Input
                  id={`request-${name}`}
                  name={name}
                  defaultValue={name === "clientName" ? selectedProfile?.displayName : undefined}
                  required={name === "subject" || name === "clientName"}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="request-category">{t("category")}</Label>
              <select
                id="request-category"
                name="category"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {leadCategorySchema.options.map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-context">{t("context")}</Label>
              <textarea
                id="request-context"
                name="context"
                maxLength={4000}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="consent" required className="mt-1" />
              {t("consent")}
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || profiles.isPending || profiles.isError}>
              {t("create")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
