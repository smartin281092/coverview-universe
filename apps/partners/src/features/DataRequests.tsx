import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  professionalDataCategorySchema,
  professionalDataRequestKindSchema,
  type DataRequest,
  type ProfessionalDataRequestInput,
} from "@coverview/contracts/partner-data";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";

function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}

function RequestForm({ onClose, onFiled }: { onClose: () => void; onFiled: () => void }) {
  const { t } = useTranslation("data"),
    session = usePartner(),
    attemptFor = useAttempt(),
    ids = { category: useId(), message: useId() };
  const file = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: ProfessionalDataRequestInput) =>
      partnerApi.fileProfessionalDataRequest(input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor(input),
      }),
    onSuccess: onFiled,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file.isPending) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value.trim() : "";
    };
    const kind = professionalDataRequestKindSchema.safeParse(text("kind"));
    const category = professionalDataCategorySchema.safeParse(text("category"));
    if (!kind.success) return;
    file.mutate({
      kind: kind.data,
      category: category.success ? category.data : null,
      message: text("message"),
    });
  }
  const error =
    file.error instanceof PartnerApiError
      ? file.error.code === "PARTNER_RATE_LIMITED"
        ? "limit"
        : file.error.code === "PARTNER_CONFLICT"
          ? "duplicate"
          : "failed"
      : "failed";
  return (
    <Dialog open onOpenChange={(open) => !open && !file.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("requests.form.title")}</DialogTitle>
          <DialogDescription>{t("requests.form.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5 text-sm" onSubmit={submit}>
          <fieldset className="space-y-3">
            <legend className="font-medium">{t("requests.form.kind")}</legend>
            {professionalDataRequestKindSchema.options.map((kind, index) => (
              <label key={kind} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="kind"
                  value={kind}
                  defaultChecked={index === 0}
                  required
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t(`requests.kind.${kind}`)}</span>
                  <span className="block text-muted-foreground">
                    {t(`requests.kindHelp.${kind}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={ids.category}>{t("requests.form.category")}</Label>
            <select
              id={ids.category}
              name="category"
              defaultValue=""
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="">{t("requests.form.anyCategory")}</option>
              {professionalDataCategorySchema.options.map((category) => (
                <option key={category} value={category}>
                  {t(`register.categories.${category}.name`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.message}>{t("requests.form.message")}</Label>
            <textarea
              id={ids.message}
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              aria-describedby={`${ids.message}-hint`}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
            <p id={`${ids.message}-hint`} className="text-xs text-muted-foreground">
              {t("requests.form.messageHint")}
            </p>
          </div>
          {file.isError && (
            <p role="alert" className="text-destructive">
              {t(`requests.errors.${error}`)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" disabled={file.isPending} onClick={onClose}>
              {t("requests.cancel")}
            </Button>
            <Button type="submit" disabled={file.isPending}>
              {file.isPending ? t("requests.form.sending") : t("requests.form.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Withdraw({ item, onDone }: { item: DataRequest; onDone: () => void }) {
  const { t } = useTranslation("data"),
    session = usePartner(),
    attemptFor = useAttempt(),
    [open, setOpen] = useState(false);
  const withdraw = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: () =>
      partnerApi.withdrawDataRequest(item.id, item.revision, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attemptFor({ id: item.id, revision: item.revision }),
      }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("requests.withdraw")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !withdraw.isPending && setOpen(value)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("requests.withdrawTitle")}</DialogTitle>
            <DialogDescription>{t("requests.withdrawDescription")}</DialogDescription>
          </DialogHeader>
          {withdraw.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t(
                withdraw.error instanceof PartnerApiError &&
                  withdraw.error.code === "PARTNER_CONFLICT"
                  ? "requests.errors.conflict"
                  : "requests.errors.failed",
              )}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" disabled={withdraw.isPending} onClick={() => setOpen(false)}>
              {t("requests.cancel")}
            </Button>
            <Button disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
              {t("requests.withdrawConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Requests about one's data (C7b): filed here, answered by CoverView, read here.
export function DataRequests({
  items,
  onChanged,
}: {
  items: DataRequest[];
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation("data"),
    [filing, setFiling] = useState(false);
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });
  return (
    <section aria-labelledby="data-requests" className="space-y-4">
      <h2 id="data-requests" className="text-lg font-semibold">
        {t("requests.title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("requests.description")}</p>
      <Button variant="outline" onClick={() => setFiling(true)}>
        {t("requests.file")}
      </Button>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("requests.empty")}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">
                  {t("requests.item", {
                    kind: t(`requests.kind.${item.kind}`),
                    date: format.format(new Date(item.createdAt)),
                  })}
                </p>
                <div className="flex items-center gap-3">
                  <Badge variant={item.state === "answered" ? "secondary" : "outline"}>
                    {item.outcome
                      ? t(`requests.outcome.${item.outcome}`)
                      : t(`requests.state.${item.state}`)}
                  </Badge>
                  {(item.state === "received" || item.state === "in_progress") && (
                    <Withdraw item={item} onDone={onChanged} />
                  )}
                </div>
              </div>
              {item.answer && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="font-medium">{t("requests.answerTitle")}</p>
                  <p className="whitespace-pre-wrap break-words">{item.answer}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {filing && (
        <RequestForm
          onClose={() => setFiling(false)}
          onFiled={() => {
            setFiling(false);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
