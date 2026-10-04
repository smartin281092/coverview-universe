import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  offerWithdrawInputSchema,
  type LeadDetail,
  type LeadOffer,
} from "@coverview/contracts/partner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
} from "@coverview/ui";
import { useLeadCommand } from "./use-lead-command";
export function OfferWithdrawDialog({
  lead,
  offer,
  onClose,
}: {
  lead: LeadDetail;
  offer: LeadOffer;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    command = useLeadCommand(lead.id);
  const [revision] = useState(lead.revision);
  const form = useForm<z.infer<typeof offerWithdrawInputSchema>>({
    resolver: zodResolver(offerWithdrawInputSchema),
    defaultValues: { offerId: offer.id, reason: "" },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) onClose();
      }}
    >
      <DialogContent showCloseButton={!command.isPending} closeLabel={t("cancel")}>
        <DialogHeader>
          <DialogTitle>{t("offer.withdraw")}</DialogTitle>
          <DialogDescription>
            {t("offer.withdrawHelp", { company: offer.company, version: offer.version })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (value) => {
              if (command.isPending) return;
              try {
                await command.mutateAsync({ ...value, action: "offer_withdraw", revision });
                onClose();
              } catch {
                /* Mutation error is displayed below. */
              }
            })(event);
          }}
        >
          <Label htmlFor="withdraw-reason">{t("field.reason")}</Label>
          <textarea
            id="withdraw-reason"
            {...form.register("reason")}
            maxLength={2000}
            rows={3}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
            aria-invalid={!!form.formState.errors.reason}
          />
          {(command.isError || form.formState.errors.reason) && (
            <p role="alert" className="text-sm text-destructive">
              {t("error")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={command.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={command.isPending}>
              {t("offer.withdraw")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
