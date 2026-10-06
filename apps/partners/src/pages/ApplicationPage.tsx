import { AvailabilityDialog } from "../features/AvailabilityDialog";
import { CapacityDialog } from "../features/CapacityDialog";
import { SharedModesDialog } from "../features/SharedModesDialog";
import { ConventionDialog } from "../features/ConventionDialog";
import { PracticeDialog } from "../features/PracticeDialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  partnerApplicationInputSchema,
  leadCategorySchema,
  partnerRoleSchema,
} from "@coverview/contracts/partner";
import { Badge, Button, Input, Label } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { formatDate } from "../features/Field";
import { CompetenceDialog } from "../features/CompetenceDialog";
import { AccessNotice, HistoryDialog } from "../features/AccessDialogs";
export function ApplicationPage() {
  const { t } = useTranslation(),
    access = useTranslation("access").t,
    { identity, context } = usePartner(),
    client = useQueryClient();
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conventionOpen, setConventionOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [sharedModesOpen, setSharedModesOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [competenceOpen, setCompetenceOpen] = useState(false);
  const application = context.application;
  const form = useForm<z.infer<typeof partnerApplicationInputSchema>>({
    resolver: zodResolver(partnerApplicationInputSchema),
    defaultValues: application
      ? {
          name: application.name,
          organization: application.organization,
          phone: application.phone,
          roles: application.roles,
          categories: application.categories,
          languages: application.languages,
          regions: application.regions,
          qualifications: application.qualifications,
        }
      : {
          name: "",
          organization: "",
          phone: "",
          roles: ["referrer"],
          categories: ["other"],
          languages: "Français",
          regions: "",
          qualifications: "",
        },
  });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const editable =
    !application || ["draft", "needs_information", "rejected"].includes(application.state);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="cv-meta">{t("app")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t(editable ? "application.title" : "nav.profile")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("application.description")}</p>
      </header>
      {application && <AccessNotice application={application} />}
      {application && (
        <section className="rounded-xl border border-border p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{t(`applicationState.${application.state}`)}</Badge>
            <p>{application.organization}</p>
            {application.organizationState !== "approved" && (
              <Badge variant="outline">
                {access("flags.organizationState", {
                  state: t(`applicationState.${application.organizationState}`),
                })}
              </Badge>
            )}
          </div>
          {application.reviewReason && <p className="mt-4 text-sm">{application.reviewReason}</p>}
          {application.reviewDueAt && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("application.reviewDue", { date: formatDate(application.reviewDueAt) })}
            </p>
          )}
          {!context.operational && (
            <p className="mt-4 text-sm text-muted-foreground">{t("application.restricted")}</p>
          )}
          {editable && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("professionalScope.applicationChange")}
            </p>
          )}
          <Button className="mt-4" variant="outline" onClick={() => setCompetenceOpen(true)}>
            {t("competence.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setAvailabilityOpen(true)}>
            {t("availability.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setCapacityOpen(true)}>
            {t("capacity.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setSharedModesOpen(true)}>
            {t("sharedModes.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setPracticeOpen(true)}>
            {t("practice.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setConventionOpen(true)}>
            {t("convention.title")}
          </Button>
          <Button className="mt-4" variant="outline" onClick={() => setHistoryOpen(true)}>
            {access("member.history")}
          </Button>
          {context.operational && (
            <div className="mt-4 flex gap-2">
              {application.grantedRoles.map((role) => (
                <Badge key={role} variant="secondary">
                  {t(`role.${role}`)}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}
      {conventionOpen && (
        <ConventionDialog userId={identity.user.id} onClose={() => setConventionOpen(false)} />
      )}
      {availabilityOpen && (
        <AvailabilityDialog userId={identity.user.id} onClose={() => setAvailabilityOpen(false)} />
      )}
      {capacityOpen && (
        <CapacityDialog
          key={`${identity.user.id}:${identity.session.id}`}
          userId={identity.user.id}
          onClose={() => setCapacityOpen(false)}
        />
      )}
      {sharedModesOpen && (
        <SharedModesDialog
          key={`${identity.user.id}:${identity.session.id}`}
          userId={identity.user.id}
          onClose={() => setSharedModesOpen(false)}
        />
      )}
      {practiceOpen && (
        <PracticeDialog userId={identity.user.id} onClose={() => setPracticeOpen(false)} />
      )}
      {competenceOpen && (
        <CompetenceDialog userId={identity.user.id} onClose={() => setCompetenceOpen(false)} />
      )}
      {historyOpen && <HistoryDialog userId={null} onClose={() => setHistoryOpen(false)} />}
      {editable && (
        <form
          className="space-y-6"
          onChange={() => setKey(crypto.randomUUID())}
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              setError("");
              try {
                await partnerApi.application(values, {
                  csrfToken: identity.csrfToken,
                  idempotencyKey: key,
                });
                await client.invalidateQueries({ queryKey: ["private", identity.user.id] });
              } catch {
                setError(t("error"));
              }
            })(event);
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {(["name", "organization", "phone", "languages", "regions"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>
                  {t(field === "phone" ? "field.phone" : `application.${field}`)}
                </Label>
                <Input
                  id={field}
                  {...form.register(field)}
                  aria-invalid={!!form.formState.errors[field]}
                />
              </div>
            ))}
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-3 font-medium">{t("application.roles")}</legend>
            {partnerRoleSchema.options.map((role) => (
              <label key={role} className="mr-5 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" value={role} {...form.register("roles")} />
                {t(`role.${role}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-3 font-medium">{t("application.categories")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {leadCategorySchema.options.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={category} {...form.register("categories")} />
                  {t(`category.${category}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="qualifications">{t("application.qualifications")}</Label>
            <textarea
              id="qualifications"
              {...form.register("qualifications")}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-3 text-sm"
            />
          </div>
          {(error || Object.keys(form.formState.errors).length > 0) && (
            <p role="alert" className="text-sm text-destructive">
              {error || t("errors.PARTNER_ACTION_REQUIRED")}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit">
            {t("application.submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
