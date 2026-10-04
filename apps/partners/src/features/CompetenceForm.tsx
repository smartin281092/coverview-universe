import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  type CompetenceDeclaration,
  type CompetenceDecision,
  type CompetenceDossier,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import { Button, Input, Label } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { zurichInstant } from "./Field";
import { ProfessionalScopeDetails } from "./ProfessionalScopeDetails";

type Props = {
  dossier: CompetenceDossier;
  mode: "declare" | "resume" | "review" | "withdraw";
  onSaved: () => void;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
};
const declarationFormSchema = competenceDeclarationSchema
  .pick({ declaration: true })
  .extend({ confirmed: z.boolean().refine((value) => value) });
const decisionFormSchema = z.object({
  decision: z.enum(["reviewed", "needs_information", "rejected", "withdrawn"]),
  reason: z.string().trim().min(1).max(2000),
  scope: z.string().trim().max(2000),
  coverage: z.enum(["category", "limited"]),
  until: z.string(),
  originalChecked: z.boolean(),
});
function useAttempt(props: Props) {
  const { t } = useTranslation();
  const [frozen, setFrozen] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const [controller] = useState(() => new AbortController());
  useEffect(() => () => controller.abort(), [controller]);
  async function run(action: () => Promise<void>) {
    setFrozen(true);
    setError("");
    props.onBusy(true);
    try {
      await action();
      props.onSaved();
    } catch (cause) {
      const conflict =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(conflict);
      setError(t(`competence.${conflict ? "conflict" : "retryExact"}`));
    } finally {
      props.onBusy(false);
    }
  }
  return { frozen, blocked, error, run, signal: controller.signal };
}
export function CompetenceDeclarationForm(props: Props) {
  const { t } = useTranslation(),
    { identity } = usePartner(),
    { dossier, mode } = props;
  const attempt = useAttempt(props),
    [file, setFile] = useState<File | null>(null),
    [invalid, setInvalid] = useState(false);
  const request = useRef<{ input: CompetenceDeclaration; key: string; id?: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(declarationFormSchema),
    defaultValues: {
      declaration: mode === "resume" ? dossier.current!.declaration : "",
      confirmed: false as boolean,
    },
  });
  const pending = form.formState.isSubmitting;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(async (values) => {
          if (!file || file.size < 1 || file.size > 20 * 1024 * 1024) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          await attempt.run(async () => {
            if (!request.current) {
              const bytes = await file.arrayBuffer();
              const checksum = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
                .map((n) => n.toString(16).padStart(2, "0"))
                .join("");
              request.current = {
                input: competenceDeclarationSchema.parse({
                  revision: dossier.current?.revision ?? 0,
                  professionalRevision: dossier.professionalRevision,
                  ...values,
                  file: { name: file.name, mime: file.type, size: file.size, checksum },
                }),
                key: crypto.randomUUID(),
                ...(mode === "resume" ? { id: dossier.current!.id } : {}),
              };
            }
            const current = request.current,
              options = {
                csrfToken: identity.csrfToken,
                idempotencyKey: current.key,
                signal: attempt.signal,
              };
            if (!current.id) {
              const result = await partnerApi.declareCompetence(
                dossier.userId,
                dossier.category,
                current.input,
                options,
              );
              if (
                !result.current ||
                result.current.revision !== current.input.revision + 1 ||
                result.current.decision !== "submitted"
              )
                throw new PartnerApiError("PARTNER_CONFLICT", 409);
              current.id = result.current.id;
            }
            await partnerApi.uploadCompetence(
              dossier.userId,
              dossier.category,
              current.id,
              file,
              options,
            );
          });
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t(`competence.${mode === "resume" ? "resumeHelp" : "declareHelp"}`)}
      </p>
      <fieldset disabled={attempt.frozen || pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="competence-declaration">{t("competence.declaration")}</Label>
          <textarea
            id="competence-declaration"
            rows={4}
            maxLength={2000}
            readOnly={mode === "resume"}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
            {...form.register("declaration")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="competence-file">{t("competence.file")}</Label>
          <Input
            id="competence-file"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" {...form.register("confirmed")} />
          {t("competence.confirm")}
        </label>
      </fieldset>
      {(invalid || Object.keys(form.formState.errors).length > 0) && (
        <p role="alert" className="text-sm text-destructive">
          {t("competence.invalid")}
        </p>
      )}
      {attempt.error && (
        <p role="alert" className="text-sm text-destructive">
          {attempt.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || attempt.blocked}>
          {t(pending ? "loading" : "competence.send")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={props.onBack}>
          {t("competence.back")}
        </Button>
      </div>
    </form>
  );
}
export function CompetenceDecisionForm(props: Props) {
  const { t } = useTranslation(),
    { identity } = usePartner(),
    { dossier, mode } = props;
  const [captured] = useState(dossier.current!),
    attempt = useAttempt(props);
  const request = useRef<{ input: CompetenceDecision; key: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: {
      decision: mode === "withdraw" ? ("withdrawn" as const) : ("needs_information" as const),
      reason: "",
      scope: "",
      coverage: "limited" as const,
      until: "",
      originalChecked: false,
    },
  });
  const decision = form.watch("decision"),
    pending = form.formState.isSubmitting;
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(async (values) => {
          if (!request.current) {
            try {
              request.current = {
                key: crypto.randomUUID(),
                input: competenceDecisionSchema.parse({
                  revision: captured.revision,
                  decision: values.decision,
                  reason: values.reason,
                  scope: values.decision === "reviewed" ? values.scope : "",
                  coverage: values.decision === "reviewed" ? values.coverage : null,
                  validUntil: values.decision === "reviewed" ? zurichInstant(values.until) : null,
                  documentRevision: captured.documentRevision,
                  originalChecked: values.originalChecked,
                }),
              };
            } catch {
              setInvalid(true);
              return;
            }
          }
          setInvalid(false);
          await attempt.run(async () => {
            await partnerApi.decideCompetence(
              dossier.userId,
              dossier.category,
              request.current!.input,
              {
                csrfToken: identity.csrfToken,
                idempotencyKey: request.current!.key,
                signal: attempt.signal,
              },
            );
          });
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t(`competence.${mode === "withdraw" ? "withdrawHelp" : "reviewHelp"}`)}
      </p>
      <p className="whitespace-pre-wrap text-sm">{captured.declaration}</p>
      <ProfessionalScopeDetails record={captured} />
      {captured.canDownload && (
        <Button variant="outline" asChild>
          <a href={partnerApi.competenceSourceUrl(dossier.userId, dossier.category, captured.id)}>
            {t("competence.original")}
          </a>
        </Button>
      )}
      <fieldset disabled={attempt.frozen || pending} className="space-y-4">
        {mode !== "withdraw" && (
          <div className="space-y-2">
            <Label htmlFor="competence-decision">{t("competence.decision")}</Label>
            <select
              id="competence-decision"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("decision")}
            >
              {["needs_information", "reviewed", "rejected"].map((v) => (
                <option key={v} value={v} disabled={v === "reviewed" && !captured.canDownload}>
                  {t(`competence.decisions.${v}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="competence-reason">{t("field.reason")}</Label>
          <textarea
            id="competence-reason"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
            {...form.register("reason")}
          />
        </div>
        {decision === "reviewed" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="competence-scope">{t("competence.scope")}</Label>
              <textarea
                id="competence-scope"
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
                {...form.register("scope")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competence-coverage">{t("competence.coverage")}</Label>
              <select
                id="competence-coverage"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("coverage")}
              >
                <option value="limited">{t("competence.limited")}</option>
                <option value="category">{t("competence.fullCategory")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competence-until">{t("competence.until")}</Label>
              <Input id="competence-until" type="datetime-local" {...form.register("until")} />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" {...form.register("originalChecked")} />
              {t("competence.checked")}
            </label>
          </>
        )}
      </fieldset>
      {(invalid || Object.keys(form.formState.errors).length > 0) && (
        <p role="alert" className="text-sm text-destructive">
          {t("competence.invalid")}
        </p>
      )}
      {attempt.error && (
        <p role="alert" className="text-sm text-destructive">
          {attempt.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || attempt.blocked}>
          {t(pending ? "loading" : "competence.saveDecision")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={props.onBack}>
          {t("competence.back")}
        </Button>
      </div>
    </form>
  );
}
