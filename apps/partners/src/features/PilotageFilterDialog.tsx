import { useState } from "react";
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
  parseZurichDateTime,
} from "@coverview/ui";
import { leadCategorySchema } from "@coverview/contracts/partner";
import {
  pilotageQuerySchema,
  pilotageOptionsSchema,
  type PilotageQuery,
} from "@coverview/contracts/partner-pilotage";
import { localDateTime } from "./Field";
import { pilotagePeriod } from "./pilotage-display";
const schema = z.object({
  from: z.string(),
  to: z.string(),
  scope: z.enum(["self", "individual", "team", "organization", "network"]),
  organizationId: z.string(),
  users: z.array(z.string()),
  category: z.string(),
  source: z.string(),
  company: z.string(),
  product: z.string(),
});
export function PilotageFilterDialog({
  query,
  options,
  onClose,
  onApply,
  forGoal = false,
  scopeLocked = false,
}: {
  query: PilotageQuery;
  forGoal?: boolean;
  scopeLocked?: boolean;
  options: z.infer<typeof pilotageOptionsSchema>;
  onClose: () => void;
  onApply: (query: PilotageQuery) => void;
}) {
  const { t } = useTranslation("pilotage"),
    [error, setError] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      from: localDateTime(query.from).slice(0, 10),
      to: localDateTime(query.to).slice(0, 10),
      scope: query.scope,
      organizationId: query.organizationId ?? options.organizationId ?? "",
      users: query.members?.split(",") ?? [],
      category: query.category ?? "",
      source: query.source ?? "",
      company: query.company ?? "",
      product: query.product ?? "",
    },
  });
  const scope = form.watch("scope"),
    organization = form.watch("organizationId");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("filters")}</DialogTitle>
          <DialogDescription>{t("filterDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((v) => {
              try {
                const value = pilotageQuerySchema.parse({
                  from: parseZurichDateTime(`${v.from}T00:00`),
                  to: parseZurichDateTime(`${v.to}T00:00`),
                  scope: v.scope,
                  ...(["team", "organization"].includes(v.scope)
                    ? { organizationId: v.organizationId }
                    : {}),
                  ...(["team", "individual"].includes(v.scope)
                    ? { members: v.users.join(",") }
                    : {}),
                  ...(v.category ? { category: v.category } : {}),
                  ...(v.source ? { source: v.source } : {}),
                  ...(v.company ? { company: v.company } : {}),
                  ...(v.product ? { product: v.product } : {}),
                });
                onApply(value);
                onClose();
              } catch {
                setError(t("invalid"));
              }
            })(event);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {(["month", "previous", "quarter", "year"] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                onClick={() => {
                  const period = pilotagePeriod(p);
                  form.setValue("from", localDateTime(period.from).slice(0, 10));
                  form.setValue("to", localDateTime(period.to).slice(0, 10));
                }}
              >
                {t(`presets.${p}`)}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["from", "to"] as const).map((name) => (
              <div key={name}>
                <Label htmlFor={`pilotage-${name}`}>{t(name)}</Label>
                <Input id={`pilotage-${name}`} type="date" {...form.register(name)} />
              </div>
            ))}
          </div>
          <fieldset disabled={scopeLocked} className="space-y-4">
            <Label htmlFor="pilotage-scope">{t("population")}</Label>
            <select
              id="pilotage-scope"
              {...form.register("scope")}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="self">{t("scopes.self")}</option>
              {(options.canManageOrganization || options.canNetwork) &&
                ["individual", "team", "organization"]
                  .filter(
                    (v) => v !== "individual" || !forGoal || options.canNetwork || scopeLocked,
                  )
                  .map((v) => (
                    <option key={v} value={v}>
                      {t(`scopes.${v}`)}
                    </option>
                  ))}
              {options.canNetwork && <option value="network">{t("scopes.network")}</option>}
            </select>
            {["organization", "team"].includes(scope) && (
              <>
                <Label htmlFor="pilotage-org">{t("organization")}</Label>
                <select
                  id="pilotage-org"
                  {...form.register("organizationId")}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">{t("choose")}</option>
                  {options.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {scope === "individual" ? (
              <>
                <Label htmlFor="pilotage-person">{t("person")}</Label>
                <select
                  id="pilotage-person"
                  value={form.watch("users")[0] ?? ""}
                  onChange={(e) => form.setValue("users", e.target.value ? [e.target.value] : [])}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">{t("choose")}</option>
                  {options.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {t("separator")}
                      {p.organizationName}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              scope === "team" && (
                <fieldset>
                  <legend>{t("teamMembers")}</legend>
                  {options.people
                    .filter((p) => p.organizationId === organization)
                    .map((p) => (
                      <label key={p.id} className="flex min-h-11 items-center gap-3">
                        <input type="checkbox" value={p.id} {...form.register("users")} />
                        {p.name}
                      </label>
                    ))}
                </fieldset>
              )
            )}
          </fieldset>
          <Label htmlFor="pilotage-category">{t("category")}</Label>
          <select
            id="pilotage-category"
            {...form.register("category")}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="">{t("all")}</option>
            {leadCategorySchema.options.map((c) => (
              <option key={c} value={c}>
                {t(`partner:category.${c}`)}
              </option>
            ))}
          </select>
          {(["source", "company", "product"] as const).map((name) => (
            <div key={name}>
              <Label htmlFor={`pilotage-${name}`}>{t(name)}</Label>
              <Input
                id={`pilotage-${name}`}
                list={`pilotage-${name}-choices`}
                {...form.register(name)}
              />
              <datalist id={`pilotage-${name}-choices`}>
                {options[
                  name === "source" ? "sources" : name === "company" ? "companies" : "products"
                ].map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          ))}
          {options.truncated && <p>{t("optionsTruncated")}</p>}
          {error && <p role="alert">{error}</p>}
          <Button type="submit">{t("apply")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
