import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  entityProfileValuesSchema,
  financialProfileValuesSchema,
  healthProfileValuesSchema,
  profileValuesSchema,
  profileCompletionAverage,
  profileStepCompletion,
  profileStepFields,
  type ManagedProfile,
  type ProfileSection,
  type ProfileSectionName,
  type ProfileSectionSaveInput,
  type ProfileSectionValues,
} from "@coverview/contracts";
import {
  Button,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { forgetIdentity } from "../identity/session-state";
import {
  ProfileSteps,
  profileViewSteps,
  type ProfileEditorBridge,
  type ProfileViewStep,
} from "./ProfileSteps";

type Field = keyof ProfileSectionValues;
type Values = Record<string, string>;
const moneyFields = new Set<Field>([
  "annualIncomeMinor",
  "monthlyExpensesMinor",
  "savingsMinor",
  "debtsMinor",
  "deductibleMinor",
]);
const numberFields = new Set<Field>(["heightCm", "weightKg"]);
const noteFields = new Set<Field>(["allergies", "chronicConditions", "ongoingTreatments"]);
function fieldsFor(
  profile: ManagedProfile,
  section: ProfileSectionName,
): Record<ProfileViewStep, Field[]> {
  const { information, contact, details } = profileStepFields(profile.kind, section);
  return { information: [...information], contact: [...(contact ?? [])], details: [...details] };
}
function visibleStep(step: ProfileSection["step"], section: ProfileSectionName): ProfileViewStep {
  if (step === "review") return "details";
  return step === "contact" && section !== "general" ? "information" : step;
}
function formValues(fields: Field[], record: ProfileSection | null): Values {
  return Object.fromEntries(
    fields.map((field) => {
      const value = record?.values[field];
      return [
        field,
        value === undefined
          ? ""
          : moneyFields.has(field) && typeof value === "number"
            ? `${Math.trunc(value / 100)},${String(value % 100).padStart(2, "0")}`
            : numberFields.has(field) && typeof value === "number"
              ? String(value).replace(".", ",")
              : String(value),
      ];
    }),
  );
}
function normalized(values: Values, fields: Field[], section: ProfileSectionName) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field]?.trim() ?? "";
    if (!value) continue;
    if (moneyFields.has(field)) {
      const match = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(value);
      result[field] = match
        ? Number(BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0")))
        : value;
    } else if (numberFields.has(field))
      result[field] = /^(\d+)(?:[.,]\d+)?$/u.test(value) ? Number(value.replace(",", ".")) : value;
    else result[field] = value;
  }
  if (
    section === "finances" &&
    !result.currency &&
    fields.some((field) => moneyFields.has(field) && result[field] !== undefined)
  )
    result.currency = "CHF";
  return result;
}

export function ProfileSectionEditor({
  identity,
  profile,
  section,
  requestedStep,
  onStepChange,
  onBridge,
  portalContainer,
  blocked,
}: {
  identity: IdentityMe;
  profile: ManagedProfile;
  section: ProfileSectionName;
  requestedStep?: ProfileViewStep | undefined;
  onStepChange: (step: ProfileViewStep) => void;
  onBridge: (bridge: ProfileEditorBridge | null) => void;
  portalContainer: HTMLElement | null;
  blocked: boolean;
}) {
  const { t } = useTranslation("profile");
  const client = useQueryClient();
  const groups = fieldsFor(profile, section);
  const fields = Object.values(groups).flat();
  const steps = profileViewSteps.filter((value) => value !== "contact" || section === "general");
  const authority =
    section === "finances"
      ? financialProfileValuesSchema
      : section === "health"
        ? healthProfileValuesSchema
        : profile.kind === "legal_entity"
          ? entityProfileValuesSchema
          : profileValuesSchema;
  const schema = z.record(z.string(), z.string()).superRefine((values, context) => {
    const result = authority.safeParse(normalized(values, fields, section));
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: "invalid" });
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: formValues(fields, null),
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });
  const { isDirty, dirtyFields } = form.formState;
  const [saved, setSaved] = useState<ProfileSection | null>(null);
  const completion = profileStepCompletion(profile.kind, section, values);
  const [step, setStep] = useState<ProfileViewStep>(() =>
    visibleStep(requestedStep ?? "information", section),
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<"save" | "conflict" | "session" | "denied" | null>(null);
  const [notice, setNotice] = useState(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const sessionScope = `${identity.user.id}:${identity.session.id}`;
  const currentScope = useRef(sessionScope);
  currentScope.current = sessionScope;
  const blockedNow = useRef(blocked);
  blockedNow.current = blocked;
  const lastRequested = useRef(requestedStep);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const queryKey = [
    "private",
    identity.user.id,
    identity.session.id,
    "profile-section",
    profile.id,
    section,
  ];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.profileSection(profile.id, section, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 15_000),
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      command.current = null;
      onBridge(null);
    };
  }, [onBridge]);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setPending(false);
  }, [sessionScope]);
  useEffect(() => {
    if (!query.data) return;
    if (!saved) {
      setSaved(query.data);
      form.reset(formValues(Object.values(fieldsFor(profile, section)).flat(), query.data));
      setStep(visibleStep(requestedStep ?? query.data.step, section));
    } else if (query.data.revision > saved.revision && !pending) {
      if (isDirty || Object.keys(dirtyFields).length) setFailure("conflict");
      else {
        setSaved(query.data);
        form.reset(formValues(Object.values(fieldsFor(profile, section)).flat(), query.data));
        setFailure((current) => (current === "conflict" ? null : current));
      }
    }
  }, [query.data, saved, form, profile, section, requestedStep, pending, isDirty, dirtyFields]);
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.code === "IDENTITY_UNAUTHENTICATED")
      void forgetIdentity(client);
  }, [query.error, client]);
  useEffect(() => {
    if (requestedStep !== lastRequested.current) {
      lastRequested.current = requestedStep;
      if (requestedStep) setStep(visibleStep(requestedStep, section));
    }
  }, [requestedStep, section]);
  const save = async (next = step) => {
    if (!saved || busy.current || blocked) return false;
    const scope = sessionScope;
    let successful = false;
    await form.handleSubmit(async (current) => {
      if (currentScope.current !== scope || blockedNow.current || busy.current) return;
      busy.current = true;
      setPending(true);
      setFailure(null);
      setNotice(false);
      const active = new AbortController();
      controller.current = active;
      const isCurrent = () =>
        mounted.current &&
        currentScope.current === scope &&
        controller.current === active &&
        !active.signal.aborted;
      const parsed = authority.parse(normalized(current, fields, section));
      const patch = Object.fromEntries(
        fields.flatMap((field) => {
          const value = (parsed as ProfileSectionValues)[field];
          return value !== saved.values[field] ? [[field, value ?? null]] : [];
        }),
      ) as ProfileSectionSaveInput["fields"];
      const input = {
        revision: saved.revision,
        step: next,
        fields: patch,
      };
      const signature = JSON.stringify(input);
      if (command.current?.signature !== signature)
        command.current = { signature, key: crypto.randomUUID() };
      try {
        const result = await api.saveProfileSection(profile.id, section, input, {
          csrfToken: identity.csrfToken,
          idempotencyKey: command.current.key,
          signal: active.signal,
        });
        if (!isCurrent()) return;
        setSaved(result);
        setStep(next);
        form.reset(formValues(fields, result));
        client.setQueryData(queryKey, result);
        void client.invalidateQueries({
          queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
        });
        setNotice(true);
        successful = true;
      } catch (error) {
        if (!isCurrent()) return;
        if (
          error instanceof ApiError &&
          (error.code === "IDENTITY_UNAUTHENTICATED" || error.code === "IDENTITY_CSRF_INVALID")
        ) {
          setFailure("session");
          await forgetIdentity(client);
        } else
          setFailure(
            error instanceof ApiError && error.status === 409
              ? "conflict"
              : error instanceof ApiError && error.status === 403
                ? "denied"
                : "save",
          );
      } finally {
        if (controller.current === active) {
          busy.current = false;
          if (mounted.current && currentScope.current === scope) setPending(false);
        }
      }
    })();
    return successful;
  };
  useEffect(() => {
    onBridge({
      dirty: isDirty || Object.keys(dirtyFields).length > 0,
      pending,
      completion: saved ? profileCompletionAverage(completion) : null,
      scopeKey: `${identity.user.id}:${identity.session.id}:${profile.id}:${section}`,
      save: () => save(),
      discard: () => {
        form.reset(formValues(fields, saved));
        setFailure(null);
      },
    });
  });
  const move = async (next: ProfileViewStep) => {
    if ((await save(next)) && currentScope.current === sessionScope) {
      onStepChange(next);
      heading.current?.focus();
    }
  };
  const refresh = async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    setPending(true);
    const scope = sessionScope;
    try {
      const result = await query.refetch();
      if (!mounted.current || currentScope.current !== scope) return;
      if (result.data) {
        setSaved(result.data);
        form.reset(formValues(fields, result.data), { keepDirtyValues: true });
        setFailure(null);
      } else setFailure("save");
    } finally {
      if (currentScope.current === scope) {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    }
  };
  if (!saved)
    return query.isError ? (
      <div role="alert" className="space-y-3">
        <p>{t("errors.save")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    ) : (
      <LoadingState label={t("loading")} />
    );
  const labels = {
    information: t(`workspace.steps.${section}.information`),
    contact: t("steps.contact"),
    details: t(`workspace.steps.${section}.details`),
  };
  const choices: Partial<Record<Field, string[]>> = {
    currency: ["CHF", "EUR", "USD"],
    accidentCoverage: ["yes", "no", "unknown"],
    smokingStatus: ["never", "former", "current"],
  };
  const fieldLabel = (field: Field) => t(`fields.${field}`);
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,640px)] lg:gap-16">
      <aside>
        <ProfileSteps
          step={step}
          completion={completion}
          labels={labels}
          disabled={pending || blocked}
          onChange={(next) => void move(next)}
        />
      </aside>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "details") void save();
          else void move(steps[steps.indexOf(step) + 1] ?? "details");
        }}
        className="min-w-0 space-y-6"
        aria-busy={pending}
      >
        <div className="space-y-1">
          <h2 ref={heading} tabIndex={-1} className="cv-app-subheading outline-none">
            {labels[step]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(section === "general" ? "generalRequired" : "optional")}
          </p>
        </div>
        {failure && (
          <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4 text-sm">
            <p>{t(`errors.${failure}`)}</p>
            {failure === "conflict" && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void refresh()}
              >
                {t("refresh")}
              </Button>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("notice.saved")}
          </p>
        )}
        <fieldset disabled={pending || blocked} className="space-y-6">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {groups[step].map((field) => (
              <div
                key={field}
                className={`space-y-2 ${field === "street" || field === "primaryDoctorName" || noteFields.has(field) ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={`section-${field}`}>{fieldLabel(field)}</Label>
                {choices[field] ? (
                  <Select
                    value={values[field] || (field === "currency" ? "CHF" : "empty")}
                    onValueChange={(value) =>
                      form.setValue(field, value === "empty" ? "" : value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger
                      id={`section-${field}`}
                      className="min-h-11 w-full text-base"
                      aria-invalid={Boolean(form.formState.errors[field])}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent portalContainer={portalContainer}>
                      {field !== "currency" && (
                        <SelectItem value="empty">{t("review.empty")}</SelectItem>
                      )}
                      {choices[field].map((value) => (
                        <SelectItem value={value} key={value}>
                          {field === "currency" ? value : t(`workspace.options.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : noteFields.has(field) ? (
                  <textarea
                    id={`section-${field}`}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-invalid={Boolean(form.formState.errors[field])}
                    {...form.register(field)}
                  />
                ) : (
                  <Input
                    id={`section-${field}`}
                    type={
                      field === "birthDate"
                        ? "date"
                        : field === "contactEmail"
                          ? "email"
                          : field === "phone"
                            ? "tel"
                            : "text"
                    }
                    inputMode={
                      field === "avsNumber"
                        ? "numeric"
                        : moneyFields.has(field) || numberFields.has(field)
                          ? "decimal"
                          : undefined
                    }
                    maxLength={
                      field === "avsNumber"
                        ? 40
                        : field === "street" || field === "contactEmail"
                          ? 240
                          : 160
                    }
                    className="min-h-11 text-base"
                    aria-describedby={
                      field === "primaryDoctorName" ? "section-primaryDoctorName-help" : undefined
                    }
                    aria-invalid={Boolean(form.formState.errors[field])}
                    {...form.register(field)}
                  />
                )}
                {field === "primaryDoctorName" && (
                  <p id="section-primaryDoctorName-help" className="text-sm text-muted-foreground">
                    {t("workspace.primaryDoctorHelp")}
                  </p>
                )}
                {form.formState.errors[field] && (
                  <p role="alert" className="text-sm text-destructive">
                    {t(field === "avsNumber" ? "invalidAvsNumber" : "invalidField")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {section === "health" && (
            <p className="text-xs text-muted-foreground">{t("workspace.healthPrivacy")}</p>
          )}
          <div className="flex flex-wrap gap-3">
            {step !== "information" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void move(steps[steps.indexOf(step) - 1] ?? "information")}
              >
                {t("previous")}
              </Button>
            )}
            <Button type="submit">
              {t(pending ? "pending" : step === "details" ? "save" : "next")}
            </Button>
            {step !== "details" && (
              <Button type="button" variant="ghost" onClick={() => void save()}>
                {t("save")}
              </Button>
            )}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">{t(isDirty ? "unsaved" : "saved")}</p>
      </form>
    </div>
  );
}
