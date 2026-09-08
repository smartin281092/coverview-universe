import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  managedProfileCreateInputSchema,
  type ManagedProfile,
  type ManagedProfileCreateInput,
} from "@coverview/contracts";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

export function CreateProfileDialog({
  identity,
  userId,
  open,
  blocked,
  onOpenChange,
  onCreated,
  portalContainer,
}: {
  identity: IdentityMe;
  userId: string;
  open: boolean;
  blocked: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (profile: ManagedProfile) => void;
  portalContainer: HTMLDivElement | null;
}) {
  const { t } = useTranslation("users");
  const form = useForm<ManagedProfileCreateInput>({
    resolver: zodResolver(managedProfileCreateInputSchema),
    defaultValues: { kind: "person", displayName: "" },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const create = form.handleSubmit(async (input) => {
    if (busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      const profile = await api.createAdminProfile(userId, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      command.current = null;
      form.reset({ kind: "person", displayName: "" });
      onOpenChange(false);
      onCreated(profile);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("profile.add")}</DialogTitle>
          <DialogDescription>{t("profile.addDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => void create(event)}>
          <div className="space-y-2">
            <Label htmlFor="admin-profile-kind">{t("profile.kind")}</Label>
            <Select
              value={kind}
              disabled={pending}
              onValueChange={(value) => {
                if (value === "person" || value === "legal_entity") form.setValue("kind", value);
              }}
            >
              <SelectTrigger id="admin-profile-kind" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={portalContainer}>
                <SelectItem value="person">{t("profile.person")}</SelectItem>
                <SelectItem value="legal_entity">{t("profile.entity")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-profile-name">
              {t(kind === "person" ? "profile.name" : "fields.companyName")}
            </Label>
            <Input
              id="admin-profile-name"
              maxLength={160}
              className="min-h-11"
              disabled={pending}
              aria-invalid={Boolean(form.formState.errors.displayName)}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p role="alert" className="text-sm text-destructive">
                {t("profile.invalid")}
              </p>
            )}
          </div>
          {failure ? <AdminFailure error={failure} onRetry={() => void create()} /> : null}
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t(pending ? "saving" : "profile.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
