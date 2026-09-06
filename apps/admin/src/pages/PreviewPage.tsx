import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AccessDeniedState, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { api } from "../api";

export function PreviewPage() {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>();
  const personas = useQuery({
    queryKey: ["platform", "personas"],
    queryFn: ({ signal }) => api.personas({ signal }),
    enabled: import.meta.env.DEV,
  });
  if (!import.meta.env.DEV)
    return (
      <AccessDeniedState
        title={t("stateExamples.localOnly")}
        description={t("stateExamples.localOnlyDescription")}
      />
    );
  const selected = personas.data?.personas.find((persona) => persona.id === selectedId);
  return (
    <>
      <div className="space-y-3">
        <h1 className="cv-app-heading">{t("personas.title")}</h1>
        <p className="max-w-xl leading-relaxed text-muted-foreground">
          {t("personas.description")}
        </p>
      </div>
      {personas.isPending ? (
        <LoadingState label={t("personas.loading")} />
      ) : personas.isError ? (
        <ErrorState
          title={t("personas.error")}
          description={t("personas.errorDescription")}
          retryLabel={t("health.retry")}
          pendingLabel={t("health.pending")}
          isPending={personas.isFetching}
          onRetry={() => {
            void personas.refetch();
          }}
        />
      ) : personas.data.personas.length === 0 ? (
        <EmptyState title={t("personas.empty")} description={t("personas.emptyDescription")} />
      ) : (
        <fieldset className="space-y-3">
          <legend className="mb-4 text-sm font-medium">{t("personas.legend")}</legend>
          {personas.data.personas.map((persona) => (
            <label
              key={persona.id}
              className="flex cursor-pointer items-center gap-4 rounded-xl border border-input bg-card p-5 has-checked:border-primary has-checked:bg-accent"
            >
              <input
                type="radio"
                name="persona"
                value={persona.id}
                checked={selectedId === persona.id}
                onChange={() => {
                  setSelectedId(persona.id);
                }}
                className="size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block break-all text-sm font-medium">{persona.email}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{persona.org}</span>
                <span className="mt-2 block text-xs text-primary">{t("personas.badge")}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {selected ? t("personas.selected", { email: selected.email }) : ""}
      </p>
    </>
  );
}
