import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
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
  type ManagedProfile,
  type Profile,
  type ProfileSection,
  type ProfileSectionName,
  type ProfileSectionValues,
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
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

type Values = Record<string, string>;
type Field = keyof ProfileSectionValues;
type Snapshot = { revision: number; values: ProfileSectionValues };
const money = new Set<Field>([
  "annualIncomeMinor",
  "monthlyExpensesMinor",
  "savingsMinor",
  "debtsMinor",
  "deductibleMinor",
]);
const numeric = new Set<Field>(["heightCm", "weightKg"]);
const notes = new Set<Field>(["allergies", "chronicConditions", "ongoingTreatments"]);
const choices: Partial<Record<Field, string[]>> = {
  currency: ["CHF", "EUR", "USD"],
  accidentCoverage: ["yes", "no", "unknown"],
  smokingStatus: ["never", "former", "current"],
};
function normalized(values: Values, fields: Field[]) {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[field]?.trim() ?? "";
      if (!value) return [];
      if (money.has(field)) {
        const match = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(value);
        return [
          [
            field,
            match
              ? Number(BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0")))
              : value,
          ],
        ];
      }
      return [
        [
          field,
          numeric.has(field) && /^(\d+)(?:[.,]\d+)?$/u.test(value)
            ? Number(value.replace(",", "."))
            : value,
        ],
      ];
    }),
  );
}
function controls(fields: Field[], values: ProfileSectionValues): Values {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field];
      return [
        field,
        value === undefined
          ? ""
          : money.has(field) && typeof value === "number"
            ? `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, "0")}`
            : String(value),
      ];
    }),
  );
}
function snapshot(record: Profile | ProfileSection): Snapshot {
  return {
    revision: record.revision,
    values:
      "values" in record
        ? record.values
        : Object.fromEntries(
            Object.entries(record.fields).map(([key, field]) => [key, field.value]),
          ),
  };
}

export function AdminProfileEditor({
  identity,
  userId,
  profile,
  section,
  blocked,
  portalContainer,
}: {
  identity: IdentityMe;
  userId: string;
  profile: ManagedProfile;
  section: ProfileSectionName;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
}) {
  const { t } = useTranslation("users");
  const client = useQueryClient();
  const canonical = profile.isSelf && section === "general";
  const authority =
    section === "finances"
      ? financialProfileValuesSchema
      : section === "health"
        ? healthProfileValuesSchema
        : profile.kind === "legal_entity"
          ? entityProfileValuesSchema
          : profileValuesSchema;
  const fields = useMemo(() => Object.keys(authority.shape) as Field[], [authority]);
  const schema = useMemo(
    () =>
      z.record(z.string(), z.string()).superRefine((values, context) => {
        const result = authority.safeParse(normalized(values, fields));
        if (!result.success)
          for (const issue of result.error.issues)
            context.addIssue({ code: "custom", path: issue.path, message: "invalid" });
      }),
    [authority, fields],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: controls(fields, {}),
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });
  const { isDirty, dirtyFields } = form.formState;
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  const blockedNow = useRef(blocked);
  blockedNow.current = blocked;
  const queryKey = [
    "private",
    identity.user.id,
    identity.session.id,
    "admin-user",
    userId,
    "section",
    profile.id,
    section,
  ];
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      snapshot(
        canonical
          ? await api.adminProfile(userId, { signal })
          : await api.adminProfileSection(userId, profile.id, section, { signal }),
      ),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (query.data && !saved) {
      setSaved(query.data);
      form.reset(controls(fields, query.data.values));
    }
  }, [query.data, saved, form, fields]);
  const conflict =
    (failure instanceof ApiError && failure.status === 409) ||
    Boolean(saved && query.data && query.data.revision > saved.revision);
  const hasChanges = isDirty || Object.keys(dirtyFields).length > 0;
  const accessLost = [failure, query.error].some(
    (error) => error instanceof ApiError && (error.status === 401 || error.status === 403),
  );
  const blocker = useBlocker({
    shouldBlockFn: () => !accessLost && (hasChanges || busy.current),
    enableBeforeUnload: () => !accessLost && (hasChanges || busy.current),
    withResolver: true,
  });
  const save = async () => {
    if (!saved || busy.current || blockedNow.current || conflict) return false;
    let successful = false;
    await form.handleSubmit(async (input) => {
      if (busy.current || blockedNow.current) return;
      busy.current = true;
      setPending(true);
      setFailure(null);
      setNotice(false);
      const active = new AbortController();
      controller.current = active;
      const parsed = authority.parse(normalized(input, fields)) as ProfileSectionValues;
      const patch = Object.fromEntries(
        fields.flatMap((field) =>
          parsed[field] !== saved.values[field] ? [[field, parsed[field] ?? null]] : [],
        ),
      );
      const payload = { revision: saved.revision, step: "information" as const, fields: patch };
      const signature = JSON.stringify(payload);
      if (command.current?.signature !== signature)
        command.current = { signature, key: crypto.randomUUID() };
      const options = {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      };
      try {
        const result = snapshot(
          canonical
            ? await api.saveAdminProfile(userId, payload, options)
            : await api.saveAdminProfileSection(userId, profile.id, section, payload, options),
        );
        if (active.signal.aborted) return;
        setSaved(result);
        form.reset(controls(fields, result.values));
        client.setQueryData(queryKey, result);
        void client.invalidateQueries({
          queryKey: [
            "private",
            identity.user.id,
            identity.session.id,
            "admin-user",
            userId,
            "summary",
          ],
        });
        void client.invalidateQueries({
          queryKey: [
            "private",
            identity.user.id,
            identity.session.id,
            "admin-user",
            userId,
            "profiles",
          ],
        });
        void client.invalidateQueries({
          queryKey: ["private", identity.user.id, identity.session.id, "admin-users"],
        });
        setNotice(true);
        command.current = null;
        successful = true;
      } catch (error) {
        if (!active.signal.aborted) setFailure(error);
      } finally {
        if (!active.signal.aborted) {
          busy.current = false;
          setPending(false);
        }
      }
    })();
    return successful;
  };
  const refresh = async () => {
    if (busy.current || blockedNow.current) return;
    const result = await query.refetch();
    if (result.data) {
      setSaved(result.data);
      form.reset(controls(fields, result.data.values), { keepDirtyValues: true });
      setFailure(null);
      setNotice(false);
      command.current = null;
    }
  };
  if (query.isError)
    return <AdminFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!saved) return <LoadingState label={t("profile.loading")} />;
  if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403))
    return <AdminFailure error={failure} onRetry={() => setFailure(null)} />;
  return (
    <>
      <form
        className="max-w-3xl space-y-6"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="space-y-2">
          <h2 className="cv-app-subheading">{t(`tabs.${section}`)}</h2>
          <p className="text-sm text-muted-foreground">
            {t(section === "health" ? "profile.healthDescription" : "profile.optional")}
          </p>
        </div>
        {conflict ? (
          <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4 text-sm">
            <p>{t("profile.conflict")}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending || blocked || query.isFetching}
              onClick={() => void refresh()}
            >
              {t("profile.refresh")}
            </Button>
          </div>
        ) : failure ? (
          <p role="alert" className="text-sm text-destructive">
            {t("profile.failed")}
          </p>
        ) : null}
        <fieldset disabled={pending || blocked} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field}
              className={`space-y-2 ${notes.has(field) || field === "street" || field === "primaryDoctorName" ? "sm:col-span-2" : ""}`}
            >
              <Label htmlFor={`admin-${field}`}>{t(`fields.${field}`)}</Label>
              {choices[field] ? (
                <Select
                  value={values[field] || "empty"}
                  disabled={pending || blocked}
                  onValueChange={(value) =>
                    form.setValue(field, value === "empty" ? "" : value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    id={`admin-${field}`}
                    className="min-h-11 w-full"
                    aria-invalid={Boolean(form.formState.errors[field])}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent portalContainer={portalContainer}>
                    <SelectItem value="empty">{t("profile.notProvided")}</SelectItem>
                    {choices[field].map((choice) => (
                      <SelectItem key={choice} value={choice}>
                        {field === "currency" ? choice : t(`options.${choice}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : notes.has(field) ? (
                <textarea
                  id={`admin-${field}`}
                  rows={3}
                  maxLength={1000}
                  aria-invalid={Boolean(form.formState.errors[field])}
                  {...form.register(field)}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : (
                <Input
                  id={`admin-${field}`}
                  className="min-h-11 text-base"
                  autoComplete="off"
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
                      : money.has(field) || numeric.has(field)
                        ? "decimal"
                        : undefined
                  }
                  maxLength={field === "avsNumber" ? 40 : undefined}
                  aria-invalid={Boolean(form.formState.errors[field])}
                  {...form.register(field)}
                />
              )}
              {form.formState.errors[field] && (
                <p role="alert" className="text-sm text-destructive">
                  {t(field === "avsNumber" ? "profile.invalidAvsNumber" : "profile.invalid")}
                </p>
              )}
            </div>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || blocked || conflict}>
            {t(pending ? "saving" : "save")}
          </Button>
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("profile.saved")}
            </p>
          )}
          {hasChanges && <p className="text-sm text-muted-foreground">{t("profile.unsaved")}</p>}
        </div>
      </form>
      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && !pending) blocker.reset?.();
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("guard.title")}</DialogTitle>
            <DialogDescription>{t("guard.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-3">
            <Button variant="ghost" disabled={pending} onClick={() => blocker.reset?.()}>
              {t("guard.stay")}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => blocker.proceed?.()}>
              {t("guard.discard")}
            </Button>
            <Button
              disabled={pending || conflict}
              onClick={() => {
                void save().then((ok) => {
                  if (ok) blocker.proceed?.();
                  else blocker.reset?.();
                });
              }}
            >
              {t(pending ? "saving" : "guard.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
