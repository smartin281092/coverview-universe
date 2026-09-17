import { useState, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
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
import { DocumentFailure } from "./DocumentFailure";

export function DocumentProfileCreateDialog({
  proposal,
  pending,
  error,
  onCreate,
  onClose,
  returnFocus,
}: {
  proposal: ManagedProfileCreateInput | null | undefined;
  pending: boolean;
  error: unknown;
  onCreate: (input: ManagedProfileCreateInput) => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation("documents");
  const { t: profileText } = useTranslation("profile");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const form = useForm<ManagedProfileCreateInput>({
    resolver: zodResolver(managedProfileCreateInputSchema),
    defaultValues: proposal ?? { kind: "person", displayName: "" },
  });
  const kind = form.watch("kind");
  const submit = form.handleSubmit((input) => {
    if (!pending) onCreate(input);
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        ref={setContainer}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          if (returnFocus.current) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("assignment.create")}</DialogTitle>
          <DialogDescription>{t("assignment.createDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.stopPropagation();
            void submit(event);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="document-profile-kind">{profileText("workspace.kind")}</Label>
            <Select
              value={kind}
              disabled={pending}
              onValueChange={(value) => {
                if (value === "person" || value === "legal_entity") form.setValue("kind", value);
              }}
            >
              <SelectTrigger id="document-profile-kind" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={container}>
                <SelectItem value="person">{profileText("workspace.person")}</SelectItem>
                <SelectItem value="legal_entity">{profileText("workspace.entity")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-profile-name">
              {profileText(kind === "person" ? "workspace.personName" : "workspace.entityName")}
            </Label>
            <Input
              id="document-profile-name"
              maxLength={160}
              disabled={pending}
              className="min-h-11"
              aria-invalid={!!form.formState.errors.displayName}
              aria-describedby={
                form.formState.errors.displayName ? "document-profile-name-error" : undefined
              }
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p id="document-profile-name-error" role="alert" className="text-sm text-destructive">
                {profileText("invalidField")}
              </p>
            )}
          </div>
          {!!error && (
            <DocumentFailure
              error={error}
              onRetry={() => {
                void submit();
              }}
            />
          )}
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {profileText("workspace.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t(pending ? "assignment.creating" : "assignment.createAndAssign")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
