import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  insuranceCompanyIdSchema,
  type InsuranceCompanyId,
  type Profile,
} from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
} from "@coverview/ui";
import { CircleCheck } from "lucide-react";
import { useAuthorizationSave } from "./use-authorization-save";

const png = new Set<InsuranceCompanyId>(["allianz", "assura", "automate"]);
export function CompanyPicker({
  identity,
  profile,
  selected,
  referenced,
  onClose,
  onSaved,
  onRefresh,
}: {
  identity: IdentityMe;
  profile: Profile;
  selected: InsuranceCompanyId[];
  referenced: InsuranceCompanyId[];
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => Promise<Profile>;
}) {
  const { t } = useTranslation("authorizations");
  const { t: tp } = useTranslation("profile");
  const [chosen, setChosen] = useState(selected);
  const [base, setBase] = useState(profile);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const save = useAuthorizationSave(identity, onSaved);
  const conflict = save.error instanceof ApiError && save.error.code === "PROFILE_CONFLICT";
  const pending = save.isPending || refreshing;
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const visible = insuranceCompanyIdSchema.options.filter((id) =>
    normalize(t(`companies.names.${id}`)).includes(normalize(search.trim())),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-hidden p-5 text-sm sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("companies.title")}</DialogTitle>
          <DialogDescription className="text-sm">{t("companies.help")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="company-search" className="sr-only">
            {t("companies.search")}
          </Label>
          <Input
            id="company-search"
            type="search"
            className="min-h-11"
            placeholder={t("companies.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div
          className="min-h-0 overflow-y-auto overscroll-contain p-1"
          role="group"
          aria-label={t("companies.title")}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((id) => {
              const checked = chosen.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={pending}
                  aria-label={t(`companies.names.${id}`)}
                  className={`relative flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border p-3 text-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${checked ? "border-primary bg-indigo-50 text-indigo-900" : "border-border bg-background hover:bg-muted"}`}
                  onClick={() =>
                    setChosen((current) =>
                      checked ? current.filter((item) => item !== id) : [...current, id],
                    )
                  }
                >
                  <span className="flex h-12 w-full items-center justify-center">
                    <img
                      src={`/companies/${id}.${png.has(id) ? "png" : "svg"}`}
                      alt=""
                      className={`max-h-12 max-w-28 object-contain ${id === "generali" ? "rounded bg-red-700 p-1" : ""}`}
                    />
                  </span>
                  <span>{t(`companies.names.${id}`)}</span>
                  {referenced.includes(id) && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("companies.referenced")}
                    </span>
                  )}
                  {checked && (
                    <CircleCheck
                      aria-hidden="true"
                      className="absolute top-2 right-2 size-5 text-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>
          {visible.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">{t("companies.emptySearch")}</p>
          )}
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <p role="status" className="text-sm text-muted-foreground">
            {t("companies.selected", { count: chosen.length })}
          </p>
          {save.isError && (
            <div role="alert" className="space-y-2 text-sm text-red-700">
              <p>{tp(conflict ? "errors.conflict" : "errors.save")}</p>
              {conflict && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setRefreshing(true);
                    void onRefresh()
                      .then((latest) => {
                        setBase(latest);
                        save.reset();
                      })
                      .catch(() => undefined)
                      .finally(() => setRefreshing(false));
                  }}
                >
                  {tp("refresh")}
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" className="min-h-11" disabled={pending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              className="min-h-11"
              disabled={pending || conflict}
              onClick={() =>
                save.mutate({
                  revision: base.revision,
                  step: base.step,
                  fields: {},
                  insuranceCompanies: insuranceCompanyIdSchema.options.filter((id) =>
                    chosen.includes(id),
                  ),
                })
              }
            >
              {t(pending ? "saving" : "companies.confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
