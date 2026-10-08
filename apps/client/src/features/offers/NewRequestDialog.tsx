import { useId, useRef, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BriefcaseBusiness,
  Car,
  Ellipsis,
  FileX2,
  HeartPulse,
  House,
  MessageCircleQuestionMark,
  PencilLine,
  PiggyBank,
  Scale,
  ShieldPlus,
  TriangleAlert,
} from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import {
  leadCategorySchema,
  leadCreateInputSchema,
  leadRequestKindSchema,
} from "@coverview/contracts/partner";
import type { z } from "zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  SelectField,
  SuccessCheck,
} from "@coverview/ui";
import { api } from "../../api";
import { partnerApi } from "../../partner-api";
import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";

type Kind = z.infer<typeof leadRequestKindSchema>;
type Category = z.infer<typeof leadCategorySchema>;
type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
const kindIcons: Record<Kind, Icon> = {
  new_insurance: ShieldPlus,
  modification: PencilLine,
  question: MessageCircleQuestionMark,
  cancellation: FileX2,
  claim: TriangleAlert,
};
const categoryIcons: Record<Category, Icon> = {
  health: HeartPulse,
  vehicle: Car,
  pension: PiggyBank,
  household: House,
  legal: Scale,
  business: BriefcaseBusiness,
  other: Ellipsis,
};
const card =
  "flex min-h-24 flex-col items-start gap-2 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366f1]";

/**
 * A new request in three steps (8 October 2026): its subject, the category of a new insurance,
 * then an optional message. Sending it is the transmission to CoverView; no extra consent box.
 * Once sent, the window only confirms the transmission, then closes.
 */
export function NewRequestDialog({
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
    ids = { message: useId(), profile: useId() },
    [kind, setKind] = useState<Kind | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [step, setStep] = useState<1 | 2 | 3>(1),
    [message, setMessage] = useState(""),
    [profile, setProfile] = useState(scope === "all" ? "" : scope),
    [pending, setPending] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  const profiles = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    enabled: open,
    gcTime: 0,
    retry: false,
  });
  const choices = profiles.data?.profiles ?? [];
  // Only ask for whom when the request could concern several people.
  const target = profile || (choices.length === 1 ? choices[0]!.id : "");
  const chosen = choices.find((item) => item.id === target);
  const total = kind === "new_insurance" ? 3 : 2;
  const current = step === 3 ? total : step;
  function reset() {
    setKind(null);
    setCategory(null);
    setStep(1);
    setMessage("");
    setError("");
    setSent(false);
    attempt.current = null;
  }
  function close() {
    reset();
    onClose();
  }
  async function send() {
    if (!kind || !chosen || pending) return;
    const label = t(`requestKinds.${kind}`);
    const parsed = leadCreateInputSchema.safeParse({
      title:
        kind === "new_insurance" && category ? `${label} · ${t(`categories.${category}`)}` : label,
      requestKind: kind,
      category: kind === "new_insurance" && category ? category : "other",
      object: "",
      context: message.trim(),
      clientUserId: identity.user.id,
      clientProfileId: chosen.isSelf ? null : chosen.id,
      clientName: chosen.displayName,
      email: identity.user.email,
      phone: "",
      language: "fr",
      source: t("sourceWallet"),
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "",
      dueAt: null,
    });
    if (!parsed.success) {
      setError(t("newRequestFlow.error"));
      return;
    }
    const payload = JSON.stringify(parsed.data);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    try {
      const lead = await partnerApi.create(
        parsed.data,
        { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
        true,
      );
      attempt.current = null;
      setSent(true);
      onCreated(lead.id);
    } catch {
      setError(t("newRequestFlow.error"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) close();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!pending && !sent}
        closeLabel={t("close")}
        {...(sent ? { "aria-describedby": undefined } : {})}
      >
        <p role="status" className="sr-only">
          {sent ? t("newRequestFlow.sent") : ""}
        </p>
        {sent ? (
          <div className="flex flex-col items-center gap-6 pb-2 text-center">
            <SuccessCheck />
            <DialogTitle className="cv-success-rise max-w-lg text-2xl leading-tight text-balance sm:text-3xl">
              {t("newRequestFlow.sent")}
            </DialogTitle>
            <Button autoFocus className="cv-success-rise min-w-40" onClick={close}>
              {t("close")}
            </Button>
          </div>
        ) : (
          <DialogHeader>
            <DialogTitle>{t("newRequestFlow.title")}</DialogTitle>
            <DialogDescription>
              {t("newRequestFlow.step", { current, total: kind ? total : 3 })}
            </DialogDescription>
          </DialogHeader>
        )}
        {!sent && step === 1 && (
          <fieldset className="space-y-4">
            <legend className="mb-4 text-lg font-medium">{t("newRequestFlow.subject")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {leadRequestKindSchema.options.map((value) => {
                const KindIcon = kindIcons[value];
                return (
                  <button
                    key={value}
                    type="button"
                    className={card}
                    onClick={() => {
                      setKind(value);
                      setCategory(null);
                      setStep(value === "new_insurance" ? 2 : 3);
                    }}
                  >
                    <KindIcon className="size-6 text-[#3567b2]" aria-hidden />
                    <span className="font-medium">{t(`requestKinds.${value}`)}</span>
                    <span className="text-sm text-muted-foreground">
                      {t(`newRequestFlow.help.${value}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {!sent && step === 2 && (
          <fieldset className="space-y-4">
            <legend className="mb-4 text-lg font-medium">{t("newRequestFlow.category")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {leadCategorySchema.options.map((value) => {
                const CategoryIcon = categoryIcons[value];
                return (
                  <button
                    key={value}
                    type="button"
                    className={card}
                    onClick={() => {
                      setCategory(value);
                      setStep(3);
                    }}
                  >
                    <CategoryIcon className="size-6 text-[#3567b2]" aria-hidden />
                    <span className="font-medium">{t(`categories.${value}`)}</span>
                  </button>
                );
              })}
            </div>
            <Button variant="outline" onClick={() => setStep(1)}>
              {t("newRequestFlow.back")}
            </Button>
          </fieldset>
        )}
        {!sent && step === 3 && kind && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <div>
              <p className="text-lg font-medium">{t("newRequestFlow.details")}</p>
              <p className="text-sm text-muted-foreground">
                {kind === "new_insurance" && category
                  ? `${t(`requestKinds.${kind}`)} · ${t(`categories.${category}`)}`
                  : t(`requestKinds.${kind}`)}
              </p>
            </div>
            {choices.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor={ids.profile}>{t("newRequestFlow.profile")}</Label>
                <SelectField
                  id={ids.profile}
                  value={profile}
                  placeholder={t("chooseProfile")}
                  onValueChange={setProfile}
                  options={choices.map((item) => ({ value: item.id, label: item.displayName }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={ids.message}>{t("newRequestFlow.message")}</Label>
              <textarea
                id={ids.message}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                rows={5}
                className="w-full rounded-[10px] border border-transparent bg-[#f3f3f3] p-3 text-sm focus-visible:border-[#b5bef1] focus-visible:outline-none"
              />
              <p className="text-xs text-muted-foreground">{t("newRequestFlow.detailsHelp")}</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setStep(kind === "new_insurance" ? 2 : 1)}
              >
                {t("newRequestFlow.back")}
              </Button>
              <Button type="submit" disabled={pending || !chosen || profiles.isPending}>
                {t(pending ? "newRequestFlow.sending" : "newRequestFlow.send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
