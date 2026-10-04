import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  managedProfileCreateInputSchema,
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
import { DocumentFailure } from "../documents/DocumentFailure";

export function ProfileCreateDialog({
  identity,
  open,
  onOpenChange,
  onCreated,
  portalContainer,
  returnFocus,
}: {
  identity: IdentityMe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  portalContainer?: HTMLDivElement | null;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation("profile");
  const client = useQueryClient();
  const controller = useRef(new AbortController());
  const command = useRef<{ input: string; key: string } | null>(null);
  const busy = useRef(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const form = useForm<ManagedProfileCreateInput>({
    resolver: zodResolver(managedProfileCreateInputSchema),
    defaultValues: { kind: "person", displayName: "" },
  });
  const kind = form.watch("kind");
  const create = useMutation({
    mutationKey: ["private", identity.user.id, identity.session.id, "create-profile"],
    gcTime: 0,
    retry: false,
    mutationFn: (input: ManagedProfileCreateInput) => {
      const serialized = JSON.stringify(input);
      if (command.current?.input !== serialized)
        command.current = { input: serialized, key: crypto.randomUUID() };
      return api.createManagedProfile(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: controller.current.signal,
      });
    },
    onSuccess: async (profile) => {
      if (controller.current.signal.aborted) return;
      await client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      if (controller.current.signal.aborted) return;
      onOpenChange(false);
      form.reset({ kind: "person", displayName: "" });
      command.current = null;
      onCreated(profile.id);
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!create.isPending) onOpenChange(value);
      }}
    >
      <DialogContent
        ref={setContainer}
        onCloseAutoFocus={(event) => {
          if (returnFocus?.current) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
        portalContainer={portalContainer}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("workspace.addTitle")}</DialogTitle>
          <DialogDescription>{t("workspace.addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) =>
            void form.handleSubmit((input) => {
              if (busy.current) return;
              busy.current = true;
              create.mutate(input);
            })(event)
          }
        >
          <div className="space-y-2">
            <Label htmlFor="new-profile-kind">{t("workspace.kind")}</Label>
            <Select
              value={kind}
              disabled={create.isPending}
              onValueChange={(value) => {
                if (value === "person" || value === "legal_entity") form.setValue("kind", value);
              }}
            >
              <SelectTrigger id="new-profile-kind" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={container}>
                <SelectItem value="person">{t("workspace.person")}</SelectItem>
                <SelectItem value="legal_entity">{t("workspace.entity")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-profile-name">
              {t(kind === "person" ? "workspace.personName" : "workspace.entityName")}
            </Label>
            <Input
              id="new-profile-name"
              maxLength={160}
              className="min-h-11"
              disabled={create.isPending}
              aria-invalid={!!form.formState.errors.displayName}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p role="alert" className="text-sm text-destructive">
                {t("invalidField")}
              </p>
            )}
          </div>
          {create.isError && (
            <DocumentFailure
              error={create.error}
              onRetry={() => {
                if (create.variables) create.mutate(create.variables);
              }}
            />
          )}
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("workspace.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t(create.isPending ? "pending" : "workspace.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
