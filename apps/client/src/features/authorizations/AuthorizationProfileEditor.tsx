import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { profileValuesSchema, type Profile } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
} from "@coverview/ui";
import { useAuthorizationSave } from "./use-authorization-save";

export const authorizationFieldGroups = {
  clientName: ["firstName", "lastName"],
  birthDate: ["birthDate"],
  address: ["street"],
  locality: ["postalCode", "city", "country"],
  email: ["contactEmail"],
  phone: ["phone"],
} as const;
export type AuthorizationFieldGroup = keyof typeof authorizationFieldGroups;

export function AuthorizationProfileEditor({
  identity,
  profile,
  group,
  onClose,
  onSaved,
  onRefresh,
}: {
  identity: IdentityMe;
  profile: Profile;
  group: AuthorizationFieldGroup;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => Promise<Profile>;
}) {
  const { t } = useTranslation("authorizations");
  const { t: tp } = useTranslation("profile");
  const fields = authorizationFieldGroups[group];
  const [base, setBase] = useState(profile);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field,
        profile.fields[field]?.value ?? (field === "contactEmail" ? identity.user.email : ""),
      ]),
    ),
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const save = useAuthorizationSave(identity, onSaved);
  const conflict = save.error instanceof ApiError && save.error.code === "PROFILE_CONFLICT";
  const errorKey =
    save.error instanceof ApiError && save.error.code === "PROFILE_INVALID_BIRTH_DATE"
      ? "birthDate"
      : conflict
        ? "conflict"
        : "save";
  const pending = save.isPending || refreshing;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 text-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("editField", { field: t(group) })}</DialogTitle>
          <DialogDescription className="text-sm">{t("editHelp")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            const entries = fields.map((field) => [field, values[field]?.trim() ?? ""] as const);
            const checked = profileValuesSchema.safeParse(
              Object.fromEntries(entries.filter(([, value]) => value)),
            );
            if (!checked.success) {
              setInvalid(checked.error.issues.map((issue) => String(issue.path[0])));
              return;
            }
            setInvalid([]);
            save.mutate({
              revision: base.revision,
              step: base.step,
              fields: Object.fromEntries(entries.map(([field, value]) => [field, value || null])),
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            {fields.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`authorization-edit-${field}`}>{tp(`fields.${field}`)}</Label>
                <Input
                  id={`authorization-edit-${field}`}
                  className="min-h-11"
                  value={values[field] ?? ""}
                  type={
                    field === "birthDate"
                      ? "date"
                      : field === "contactEmail"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : "text"
                  }
                  maxLength={
                    field === "street" || field === "contactEmail"
                      ? 240
                      : field === "phone"
                        ? 40
                        : field === "postalCode"
                          ? 24
                          : 160
                  }
                  aria-invalid={invalid.includes(field)}
                  aria-describedby={
                    invalid.includes(field) ? `authorization-invalid-${field}` : undefined
                  }
                  onChange={(event) => {
                    setValues((current) => ({ ...current, [field]: event.target.value }));
                    setInvalid((current) => current.filter((item) => item !== field));
                  }}
                />
                {invalid.includes(field) && (
                  <p id={`authorization-invalid-${field}`} className="text-sm text-red-700">
                    {tp("invalidField")}
                  </p>
                )}
              </div>
            ))}
          </fieldset>
          {save.isError && (
            <div role="alert" className="space-y-2 text-sm text-red-700">
              <p>{tp(`errors.${errorKey}`)}</p>
              {conflict && (
                <Button
                  type="button"
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
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className="min-h-11" disabled={pending || conflict}>
              {tp(pending ? "pending" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
