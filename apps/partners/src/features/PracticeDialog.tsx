import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  professionalPracticeInputSchema,
  professionalLanguageSchema,
  swissCantonSchema,
  type ProfessionalPracticeDossier,
  type ProfessionalPracticeInput,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  swissCantonNamesFr,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate } from "./Field";

const formSchema = professionalPracticeInputSchema
  .omit({ revision: true, professionalRevision: true, confirmed: true })
  .extend({ confirmed: z.boolean().refine(Boolean) });
function PracticeValues({
  value,
}: {
  value: { languageCodes: string[]; cantons: (keyof typeof swissCantonNamesFr)[] };
}) {
  const { t, i18n } = useTranslation();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const list = new Intl.ListFormat(i18n.language);
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="text-muted-foreground">{t("practice.languages")}</dt>
        <dd>
          {value.languageCodes.length
            ? list.format(value.languageCodes.map((code) => names.of(code) ?? code))
            : t("practice.unspecified")}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("practice.cantons")}</dt>
        <dd>
          {value.cantons.length
            ? list.format(value.cantons.map((code) => swissCantonNamesFr[code]))
            : t("practice.unspecified")}
        </dd>
      </div>
    </dl>
  );
}
function PracticeForm({
  initial,
  current,
  onSaved,
  onBack,
  onBusy,
}: {
  initial: ProfessionalPracticeDossier;
  current: ProfessionalPracticeDossier;
  onSaved: (result: ProfessionalPracticeDossier) => void;
  onBack: () => void;
  onBusy: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation(),
    { identity } = usePartner();
  const [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [frozen, setFrozen] = useState(false);
  const attempt = useRef<{ input: ProfessionalPracticeInput; key: string } | null>(null);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      languageCodes: initial.current?.languageCodes ?? [],
      cantons: initial.current?.cantons ?? [],
      confirmed: false,
    },
  });
  const selectedLanguages = form.watch("languageCodes"),
    selectedCantons = form.watch("cantons");
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const options = professionalLanguageSchema.options
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  const normalizeSearch = (value: string) =>
    value.toLocaleLowerCase(i18n.language).normalize("NFD").replace(/\p{M}/gu, "").trim();
  const filteredOptions = options.filter((option) =>
    normalizeSearch(`${option.name} ${option.code}`).includes(normalizeSearch(search)),
  );
  const changed =
    current.professionalRevision !== initial.professionalRevision ||
    (current.current?.revision ?? 0) !== (initial.current?.revision ?? 0) ||
    !current.canDeclare;
  const pending = form.formState.isSubmitting;
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked || (changed && !attempt.current)) return;
        void form.handleSubmit(async (values) => {
          attempt.current ??= {
            input: professionalPracticeInputSchema.parse({
              ...values,
              revision: initial.current?.revision ?? 0,
              professionalRevision: initial.professionalRevision,
            }),
            key: crypto.randomUUID(),
          };
          setFrozen(true);
          setError("");
          onBusy(true);
          try {
            const result = await partnerApi.declarePractice(initial.userId, attempt.current.input, {
              csrfToken: identity.csrfToken,
              idempotencyKey: attempt.current.key,
            });
            onSaved(result);
          } catch (cause) {
            const conflict =
              cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
            setBlocked(conflict);
            setError(t(`practice.${conflict ? "conflict" : "retryExact"}`));
          } finally {
            onBusy(false);
          }
        })();
      }}
    >
      <p className="text-sm">
        {t("practice.subject", { name: initial.name, organization: initial.organization })}
      </p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          {t("practice.conflict")}
        </p>
      )}
      <fieldset disabled={pending || frozen || changed} className="space-y-5">
        <legend className="sr-only">{t("practice.edit")}</legend>
        <div className="space-y-3">
          <Label htmlFor="practice-language-search">{t("practice.languages")}</Label>
          <Input
            id="practice-language-search"
            autoFocus
            value={search}
            placeholder={t("practice.searchLanguages")}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("practice.languageLimit")}</p>
          <div
            className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-input p-3"
            role="group"
            aria-label={t("practice.languages")}
          >
            {!filteredOptions.length && (
              <p className="text-sm text-muted-foreground">{t("practice.noLanguages")}</p>
            )}
            {filteredOptions.map(({ code, name }) => (
              <label key={code} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(code)}
                  onChange={(event) =>
                    form.setValue(
                      "languageCodes",
                      event.target.checked
                        ? [...selectedLanguages, code]
                        : selectedLanguages.filter((value) => value !== code),
                      { shouldValidate: true },
                    )
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <PracticeValues value={{ languageCodes: selectedLanguages, cantons: selectedCantons }} />
        </div>
        <fieldset className="space-y-3">
          <legend className="font-medium">{t("practice.cantons")}</legend>
          <p className="text-sm text-muted-foreground">{t("practice.cantonHelp")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {swissCantonSchema.options.map((code) => (
              <label key={code} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCantons.includes(code)}
                  onChange={(event) =>
                    form.setValue(
                      "cantons",
                      event.target.checked
                        ? [...selectedCantons, code]
                        : selectedCantons.filter((value) => value !== code),
                      { shouldValidate: true },
                    )
                  }
                />
                {swissCantonNamesFr[code]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...form.register("confirmed")} />
          {t("practice.confirm")}
        </label>
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("practice.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {t("practice.back")}
        </Button>
        <Button type="submit" disabled={pending || blocked || (changed && !attempt.current)}>
          {t(pending ? "loading" : frozen ? "retry" : "practice.save")}
        </Button>
      </div>
    </form>
  );
}
export function PracticeDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [before, setBefore] = useState<number>(),
    [editing, setEditing] = useState<ProfessionalPracticeDossier | null>(null),
    [busy, setBusy] = useState(false);
  const key = [...session.queryKey, "practice", userId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.practice(userId, before, signal),
    gcTime: 0,
    refetchInterval: 10000,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("practice.title")}</DialogTitle>
          <DialogDescription>{t("practice.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <PracticeForm
            initial={editing}
            current={query.data}
            onBusy={setBusy}
            onBack={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={(result) => {
              client.setQueryData([...key, undefined], result);
              setEditing(null);
              setBefore(undefined);
              void client.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        ) : (
          <div className="space-y-5">
            <p className="text-sm">
              {t("practice.subject", {
                name: query.data.name,
                organization: query.data.organization,
              })}
            </p>
            {query.data.current ? (
              <section className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">
                  {t(`practice.scope.${query.data.current.professionalScope}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("practice.subject", {
                    name: query.data.current.declaredName,
                    organization: query.data.current.declaredOrganization,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("practice.record", {
                    revision: query.data.current.revision,
                    date: formatDate(query.data.current.declaredAt),
                  })}
                </p>
                <PracticeValues value={query.data.current} />
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">{t("practice.unset")}</p>
            )}
            <div className="space-y-2 text-sm">
              <p className="font-medium">{t("practice.legacy")}</p>
              <p className="whitespace-pre-wrap">{query.data.legacy.languages}</p>
              <p className="whitespace-pre-wrap">{query.data.legacy.regions}</p>
              <p className="text-muted-foreground">{t("practice.legacyHelp")}</p>
            </div>
            {query.data.canDeclare && (
              <Button onClick={() => setEditing(query.data)}>{t("practice.edit")}</Button>
            )}
            {query.data.history.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-medium">{t("practice.history")}</h3>
                {query.data.history.map((item) => (
                  <article key={item.revision} className="space-y-2 border-t border-border pt-3">
                    <p className="text-sm">
                      {t("practice.record", {
                        revision: item.revision,
                        date: formatDate(item.declaredAt),
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("practice.subject", {
                        name: item.declaredName,
                        organization: item.declaredOrganization,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`practice.scope.${item.professionalScope}`)}
                    </p>
                    <PracticeValues value={item} />
                  </article>
                ))}
                <div className="flex gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("practice.latest")}
                    </Button>
                  )}
                  {query.data.nextBeforeRevision && (
                    <Button
                      variant="outline"
                      onClick={() => setBefore(query.data.nextBeforeRevision!)}
                    >
                      {t("practice.older")}
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
