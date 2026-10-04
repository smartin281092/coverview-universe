import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import {
  leadViewFiltersSchema,
  type LeadView,
  type LeadViewFilters,
  type LeadViewInput,
} from "@coverview/contracts/partner-navigation";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import type { LeadNavigationSearch } from "./lead-navigation-state";
const nameSchema = z.object({
  name: z.string().trim().min(2).max(60),
  scope: z.enum(["private", "team", "global"]),
});
export function SavedLeadViews({
  filters,
  onApply,
}: {
  filters: LeadNavigationSearch;
  onApply: (filters: LeadViewFilters) => void;
}) {
  const { t } = useTranslation("navigation"),
    session = usePartner(),
    cache = useQueryClient();
  const prefix = [...session.queryKey, "lead-views"],
    query = useQuery({
      queryKey: prefix,
      queryFn: ({ signal }) => partnerApi.leadViews(signal),
      gcTime: 0,
      staleTime: 0,
      retry: false,
      refetchInterval: 30000,
    });
  const [editor, setEditor] = useState<LeadView | "new" | null>(null),
    [remove, setRemove] = useState<LeadView | null>(null),
    [status, setStatus] = useState("");
  const form = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "", scope: "private" as const },
  });
  // Managers may share a view with their organization; CoverView may publish a global view.
  const scopes = [
    "private" as const,
    ...(session.context.canManage ? (["team"] as const) : []),
    ...(session.context.administrator ? (["global"] as const) : []),
  ];
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const mutation = useMutation({
    mutationKey: [...prefix, "save"],
    gcTime: 0,
    retry: false,
    mutationFn: (input: LeadViewInput) => {
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.saveLeadView(input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      if (abort.current.signal.aborted) return;
      setEditor(null);
      setRemove(null);
      setStatus(t("saved"));
      void cache.invalidateQueries({ queryKey: prefix });
    },
  });
  const data = query.isError ? undefined : query.data;
  const owned = data?.items.filter((view) => view.owned) ?? [];
  const open = (value: LeadView | "new") => {
    setEditor(value);
    form.reset({
      name: value === "new" ? "" : value.name,
      scope: value === "new" ? "private" : value.scope,
    });
    mutation.reset();
    setStatus("");
  };
  return (
    <section className="space-y-3" aria-label={t("views")}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold">{t("views")}</h2>
        {data?.items.map((view) => (
          <div key={view.id} className="flex items-center rounded-md border border-border">
            <Button
              variant="ghost"
              onClick={() => {
                onApply(view.filters);
                setStatus(t("applied", { name: view.name }));
              }}
            >
              {view.name}
              {view.scope !== "private" && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t(`scope.${view.scope}`)}
                </span>
              )}
            </Button>
            {view.owned && (
              <>
                <Button
                  variant="ghost"
                  aria-label={t("editNamed", { name: view.name })}
                  onClick={() => open(view)}
                >
                  {t("edit")}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t("removeNamed", { name: view.name })}
                  onClick={() => {
                    setRemove(view);
                    mutation.reset();
                  }}
                >
                  {t("remove")}
                </Button>
              </>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          disabled={!data || owned.length >= 20}
          onClick={() => open("new")}
        >
          {t("saveView")}
        </Button>
      </div>
      {query.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <p>{t("unavailable")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("reload")}
          </Button>
        </div>
      ) : !data ? (
        <p>{t("loading")}</p>
      ) : !data.items.length ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : null}
      <p role="status" className="text-sm">
        {status}
      </p>
      {(editor || remove) && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value && !mutation.isPending) {
              setEditor(null);
              setRemove(null);
            }
          }}
        >
          <DialogContent closeLabel={t("close")}>
            <DialogHeader>
              <DialogTitle>
                {t(remove ? "removeNamed" : "saveView", { name: remove?.name })}
              </DialogTitle>
              <DialogDescription>{t(remove ? "removeHelp" : "privateHelp")}</DialogDescription>
            </DialogHeader>
            {remove ? (
              <Button
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({ action: "remove", id: remove.id, revision: remove.revision })
                }
              >
                {t("confirmRemove")}
              </Button>
            ) : (
              editor && (
                <form
                  className="space-y-4"
                  onSubmit={(event) =>
                    void form.handleSubmit((values) => {
                      const { cursor, ...current } = filters;
                      void cursor;
                      mutation.mutate({
                        action: "save",
                        id: editor === "new" ? null : editor.id,
                        revision: editor === "new" ? 0 : editor.revision,
                        name: values.name,
                        scope: values.scope,
                        filters: leadViewFiltersSchema.parse(current),
                      });
                    })(event)
                  }
                >
                  <Label htmlFor="view-name">{t("name")}</Label>
                  <Input
                    id="view-name"
                    maxLength={60}
                    {...form.register("name")}
                    disabled={mutation.isPending}
                  />
                  {scopes.length > 1 && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">{t("scopeLabel")}</legend>
                      {scopes.map((scope) => (
                        <label key={scope} className="flex items-start gap-2 text-sm">
                          <input
                            type="radio"
                            value={scope}
                            {...form.register("scope")}
                            disabled={mutation.isPending}
                            className="mt-1"
                          />
                          <span>{t(`scopeHelp.${scope}`)}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {!!Object.keys(form.formState.errors).length && (
                    <p role="alert">{t("invalidName")}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{t("currentFilters")}</p>
                  <Button type="submit" disabled={mutation.isPending}>
                    {t(mutation.isPending ? "saving" : "save")}
                  </Button>
                </form>
              )
            )}
            {mutation.isError && <p role="alert">{t("error")}</p>}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
