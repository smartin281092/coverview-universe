import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  qualityCreateSchema,
  qualityClientReplySchema,
} from "@coverview/contracts/partner-quality";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { SurveyForm } from "./SurveyForm";
import { WalletConfirmations } from "./WalletConfirmations";
const schema = z.object({
  note: z.string().trim().min(10).max(2000),
  kind: z.enum(["complaint", "callback"]),
  confirmed: z.boolean().refine((v) => v),
});
export function WalletQualityDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("quality"),
    [selected, setSelected] = useState<string>(),
    [writing, setWriting] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [before, setBefore] = useState<number>(),
    [editingRevision, setEditingRevision] = useState<number>();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const attempt = useRef<{
    key: string;
    input: z.infer<typeof qualityCreateSchema> | z.infer<typeof qualityClientReplySchema>;
    caseId?: string;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const prefix = [
    "private",
    identity.user.id,
    identity.session.id,
    "wallet-leads",
    "quality",
    leadId,
  ];
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const survey = useQuery({
    queryKey: [...prefix, "survey"],
    queryFn: ({ signal }) => partnerApi.surveys(leadId, signal),
    ...policy,
  });
  const list = useQuery({
    queryKey: [...prefix, "list", cursor],
    queryFn: ({ signal }) =>
      partnerApi.qualityQueue(
        { state: "all", ...(cursor ? { cursor } : {}) },
        leadId,
        true,
        signal,
      ),
    ...policy,
  });
  const detail = useQuery({
    queryKey: [...prefix, "case", selected, before],
    queryFn: ({ signal }) => partnerApi.qualityCase(selected!, true, before, signal),
    enabled: !!selected,
    ...policy,
  });
  const data = !detail.isError && !blocked ? detail.data : undefined;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { note: "", kind: "complaint", confirmed: false },
  });
  const date = (v: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(v));
  async function send() {
    if (!attempt.current || pending || blocked) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const a = attempt.current,
        o = {
          csrfToken: identity.csrfToken,
          idempotencyKey: a.key,
          signal: controller.current.signal,
        };
      if (a.caseId)
        await partnerApi.replyQualityCase(
          a.caseId,
          qualityClientReplySchema.parse(a.input),
          o,
          true,
        );
      else await partnerApi.createQualityCase(leadId, qualityCreateSchema.parse(a.input), o, true);
      if (controller.current.signal.aborted) return;
      attempt.current = null;
      setWriting(false);
      form.reset();
      await list.refetch();
      if (selected) await detail.refetch();
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definite =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definite);
      setError(t(definite ? "changed" : "uncertain"));
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  const unavailable = blocked || list.isError || survey.isError || (!!selected && detail.isError);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={t("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("walletDescription")}</DialogDescription>
        </DialogHeader>
        {unavailable ? (
          <div role="alert">
            <p>{t("changed")}</p>
            <Button
              onClick={() => {
                attempt.current = null;
                setBlocked(false);
                setWriting(false);
                void list.refetch();
                void survey.refetch();
                if (selected) void detail.refetch();
              }}
            >
              {t("reload")}
            </Button>
          </div>
        ) : writing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void form.handleSubmit((v) => {
                attempt.current ??=
                  selected && data
                    ? {
                        key: crypto.randomUUID(),
                        caseId: selected,
                        input: { expectedRevision: editingRevision!, note: v.note },
                      }
                    : {
                        key: crypto.randomUUID(),
                        input: {
                          kind: v.kind,
                          summary: v.note,
                          priority: "normal",
                          sharedWithClient: true,
                          confirmed: true,
                        },
                      };
                void send();
              })(event);
            }}
          >
            <fieldset
              disabled={
                pending || !!attempt.current || (!!selected && data?.revision !== editingRevision)
              }
              className="space-y-4"
            >
              {!selected && (
                <>
                  <Label htmlFor="quality-kind">{t("kind")}</Label>
                  <select
                    id="quality-kind"
                    {...form.register("kind")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    {["complaint", "callback"].map((v) => (
                      <option key={v} value={v}>
                        {t(`kinds.${v}`)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <Label htmlFor="quality-note">{t("message")}</Label>
              <textarea
                id="quality-note"
                {...form.register("note")}
                rows={5}
                className="w-full rounded-md border border-input bg-background p-3"
              />
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" {...form.register("confirmed")} />
                {t("shareResponse")}
              </label>
              {Object.keys(form.formState.errors).length > 0 && <p role="alert">{t("invalid")}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setWriting(false)}>
                  {t("back")}
                </Button>
                <Button type="submit">{t("send")}</Button>
              </div>
            </fieldset>
          </form>
        ) : selected ? (
          <>
            {!data ? (
              <p>{t("loading")}</p>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(undefined);
                    setBefore(undefined);
                  }}
                >
                  {t("back")}
                </Button>
                <h3 className="font-semibold">{t(`kinds.${data.kind}`)}</h3>
                <p className="whitespace-pre-wrap">{data.summary}</p>
                <p>{t("ownedBy", { name: data.assignedTo ?? t("coverviewQueue") })}</p>
                <p>{t(`states.${data.state}`)}</p>
                {data.nextAction && <p>{data.nextAction}</p>}
                {data.dueAt && <p>{t("due", { date: date(data.dueAt) })}</p>}
                {data.canReply && (
                  <Button
                    onClick={() => {
                      setEditingRevision(data.revision);
                      form.reset();
                      setWriting(true);
                    }}
                  >
                    {t("reply")}
                  </Button>
                )}
                {data.history.map((h) => (
                  <article key={h.revision} className="space-y-2 border-t border-border py-4">
                    <p className="text-sm text-muted-foreground">{date(h.createdAt)}</p>
                    <p className="whitespace-pre-wrap">{h.note}</p>
                  </article>
                ))}
                <div className="flex gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("first")}
                    </Button>
                  )}
                  {data.nextHistoryRevision && (
                    <Button variant="outline" onClick={() => setBefore(data.nextHistoryRevision!)}>
                      {t("older")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {survey.isPending || list.isPending ? (
              <p>{t("loading")}</p>
            ) : (
              <>
                {survey.data?.items.map((item) => (
                  <SurveyForm
                    key={item.id}
                    identity={identity}
                    survey={item}
                    onSaved={() => {
                      void survey.refetch();
                      void list.refetch();
                    }}
                  />
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setWriting(true);
                  }}
                >
                  {t("create")}
                </Button>
                <h3 className="font-semibold">{t("myCases")}</h3>
                {list.data?.items.length === 0 && <p>{t("empty")}</p>}
                {list.data?.items.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setSelected(item.id)}
                  >
                    <span>{t(`kinds.${item.kind}`)}</span>
                    <span>{t(`states.${item.state}`)}</span>
                  </Button>
                ))}
                <div className="flex gap-3">
                  {cursor && (
                    <Button variant="outline" onClick={() => setCursor(undefined)}>
                      {t("first")}
                    </Button>
                  )}
                  {list.data?.nextCursor && (
                    <Button variant="outline" onClick={() => setCursor(list.data.nextCursor!)}>
                      {t("older")}
                    </Button>
                  )}
                </div>
                <WalletConfirmations identity={identity} leadId={leadId} />
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {attempt.current && !blocked && (
          <Button disabled={pending} onClick={() => void send()}>
            {t(pending ? "saving" : "retryExact")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
