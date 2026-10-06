import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  dataRequestKindSchema,
  walletDataCategorySchema,
  type DataRequest,
  type WalletDataRequestInput,
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
import { api } from "../../api";
import { partnerApi } from "../../partner-api";

function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}
const fileError = (error: unknown) =>
  error instanceof PartnerApiError
    ? error.code === "PARTNER_RATE_LIMITED"
      ? "limit"
      : error.code === "PARTNER_CONFLICT"
        ? "duplicate"
        : error.code === "PARTNER_NOT_FOUND"
          ? "notFound"
          : "failed"
    : "failed";

function RequestForm({
  identity,
  onClose,
  onFiled,
}: {
  identity: IdentityMe;
  onClose: () => void;
  onFiled: () => void;
}) {
  const { t } = useTranslation("data"),
    attemptFor = useAttempt(),
    ids = { subject: useId(), category: useId(), lead: useId(), message: useId() },
    [subject, setSubject] = useState("self");
  const root = ["private", identity.user.id, identity.session.id];
  const profiles = useQuery({
    queryKey: [...root, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    gcTime: 0,
    retry: false,
  });
  const leads = useQuery({
    queryKey: [...root, "data-request-leads"],
    queryFn: ({ signal }) => partnerApi.list({ view: "all", limit: 100 }, signal, true),
    gcTime: 0,
    retry: false,
  });
  const profileId = subject === "self" ? null : subject;
  const file = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: WalletDataRequestInput) =>
      partnerApi.fileWalletDataRequest(input, {
        csrfToken: identity.csrfToken,
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
    const kind = dataRequestKindSchema.safeParse(text("kind"));
    const category = walletDataCategorySchema.safeParse(text("category"));
    if (!kind.success) return;
    file.mutate({
      kind: kind.data,
      profileId,
      category: category.success ? category.data : null,
      leadId: text("lead") || null,
      message: text("message"),
    });
  }
  const choices = (leads.data?.items ?? []).filter(
    (lead) => (lead.clientProfileId ?? null) === profileId,
  );
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
            {dataRequestKindSchema.options.map((kind, index) => (
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
            <Label htmlFor={ids.subject}>{t("requests.form.subject")}</Label>
            <select
              id={ids.subject}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="self">{t("requests.form.self")}</option>
              {(profiles.data?.profiles ?? [])
                .filter((profile) => !profile.isSelf)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.category}>{t("requests.form.category")}</Label>
            <select
              id={ids.category}
              name="category"
              defaultValue=""
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="">{t("requests.form.anyCategory")}</option>
              {walletDataCategorySchema.options.map((category) => (
                <option key={category} value={category}>
                  {t(`register.categories.${category}.name`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.lead}>{t("requests.form.lead")}</Label>
            <select
              id={ids.lead}
              name="lead"
              key={subject}
              defaultValue=""
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="">{t("requests.form.anyLead")}</option>
              {choices.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.title}
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
              {t(`requests.errors.${fileError(file.error)}`)}
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

function Withdraw({
  identity,
  item,
  onDone,
}: {
  identity: IdentityMe;
  item: DataRequest;
  onDone: () => void;
}) {
  const { t } = useTranslation("data"),
    attemptFor = useAttempt(),
    [open, setOpen] = useState(false);
  const withdraw = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: () =>
      partnerApi.withdrawDataRequest(
        item.id,
        item.revision,
        {
          csrfToken: identity.csrfToken,
          idempotencyKey: attemptFor({ id: item.id, revision: item.revision }),
        },
        true,
      ),
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
  identity,
  items,
  onChanged,
}: {
  identity: IdentityMe;
  items: DataRequest[];
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation("data"),
    [filing, setFiling] = useState(false);
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });
  return (
    <section aria-labelledby="account-data-requests" className="space-y-4">
      <h2 id="account-data-requests" className="text-lg font-semibold">
        {t("requests.title")}
      </h2>
      <p className="text-muted-foreground">{t("requests.description")}</p>
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
                <div className="min-w-0">
                  <p className="font-medium">
                    {t("requests.item", {
                      kind: t(`requests.kind.${item.kind}`),
                      date: format.format(new Date(item.createdAt)),
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {item.subject.kind === "profile"
                      ? t("requests.subjectProfile", { name: item.subject.name ?? "" })
                      : t("requests.subjectSelf")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.state === "answered" ? "secondary" : "outline"}>
                    {item.outcome
                      ? t(`requests.outcome.${item.outcome}`)
                      : t(`requests.state.${item.state}`)}
                  </Badge>
                  {(item.state === "received" || item.state === "in_progress") && (
                    <Withdraw identity={identity} item={item} onDone={onChanged} />
                  )}
                </div>
              </div>
              {item.answer && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="font-medium">{t("requests.answerTitle")}</p>
                  <p className="whitespace-pre-wrap break-words">{item.answer}</p>
                </div>
              )}
              {item.accessUntil && Date.parse(item.accessUntil) > Date.now() && (
                <p className="text-muted-foreground">
                  {t("requests.accessUntil", { date: format.format(new Date(item.accessUntil)) })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {filing && (
        <RequestForm
          identity={identity}
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
