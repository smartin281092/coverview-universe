import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
} from "@coverview/ui";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { InsuranceLeadSource } from "@coverview/contracts/partner";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { numberFormat } from "@coverview/ui/number-format";

export function InsuranceRequestDialog({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const session = usePartner();
  const { t } = useTranslation();
  const source = useQuery({
    queryKey: [...session.queryKey, "insurance-source", leadId],
    queryFn: ({ signal }) => partnerApi.insuranceSource(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        closeLabel={t("insuranceSource.close")}
      >
        <DialogHeader>
          <DialogTitle>{t("insuranceSource.title")}</DialogTitle>
          <DialogDescription>{t("insuranceSource.description")}</DialogDescription>
        </DialogHeader>
        {source.isPending ? (
          <LoadingState label={t("loading")} />
        ) : source.isError ? (
          <ErrorState
            title={t("error")}
            description={
              source.error instanceof PartnerApiError
                ? t(`errors.${source.error.code}`, { defaultValue: t("error") })
                : t("error")
            }
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void source.refetch()}
          />
        ) : (
          source.data && <InsuranceRequestContent source={source.data} />
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t("insuranceSource.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InsuranceRequestContent({ source }: { source: InsuranceLeadSource }) {
  const { t, i18n } = useTranslation();
  const missing = t("insuranceSource.missing");
  const money = (minor: number) =>
    numberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(minor / 100);
  const calendarDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" }).format(
      new Date(`${value}T12:00:00Z`),
    );
  const transmitted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(new Date(source.transmittedAt));
  const rows = (values: [string, string][]) => (
    <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
      {values.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-muted-foreground">{t(`insuranceSource.fields.${key}`)}</dt>
          <dd className="mt-1 break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
  const item = source.item;
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-muted p-4 text-sm">{t("insuranceSource.indicative")}</p>
      {item ? (
        <>
          <section className="space-y-4" aria-labelledby="request-person-title">
            <h3 id="request-person-title" className="font-semibold">
              {t("insuranceSource.person")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("insuranceSource.declared")}</p>
            {rows([
              [
                "name",
                t("insuranceSource.fullName", {
                  firstName: item.firstName,
                  lastName: item.lastName,
                }),
              ],
              ["sex", t(`insuranceSource.sex.${item.sex}`)],
              [
                "birthDate",
                item.birthDate
                  ? calendarDate(item.birthDate)
                  : t("insuranceSource.birthYearOnly", { year: String(item.birthYear) }),
              ],
              ["currentInsurer", item.currentInsurerName || missing],
              [
                "locality",
                t("insuranceSource.locality", {
                  postalCode: item.locality.postalCode,
                  locality: item.locality.locality,
                }),
              ],
              ["municipality", item.locality.municipality || missing],
              ["canton", item.locality.canton || missing],
              [
                "country",
                item.locality.country && /^[a-z]{2}$/i.test(item.locality.country)
                  ? (new Intl.DisplayNames([i18n.language], { type: "region" }).of(
                      item.locality.country,
                    ) ?? item.locality.country)
                  : item.locality.country || missing,
              ],
            ])}
          </section>
          <section
            className="space-y-4 border-t border-border pt-5"
            aria-labelledby="request-config-title"
          >
            <h3 id="request-config-title" className="font-semibold">
              {t("insuranceSource.configuration")}
            </h3>
            {rows([
              ["insurer", item.offer.insurerName],
              ["model", item.offer.name],
              ["category", t(`insuranceSource.category.${item.offer.category}`)],
              ["monthlyPremium", money(item.offer.monthlyPremiumMinor)],
              ["deductible", money(item.deductible * 100)],
              [
                "accident",
                t(item.accident ? "insuranceSource.included" : "insuranceSource.excluded"),
              ],
              ["ageGroup", t(`insuranceSource.ageGroup.${item.offer.ageGroup}`)],
              ["region", item.offer.regionId],
              ["eligibility", t(`insuranceSource.eligibility.${item.offer.eligibility}`)],
              [
                "restricted",
                t(
                  item.offer.restricted
                    ? "insuranceSource.restricted"
                    : "insuranceSource.notRestricted",
                ),
              ],
              [
                "firstContacts",
                item.offer.firstContacts?.length
                  ? new Intl.ListFormat(i18n.language, {
                      style: "long",
                      type: "conjunction",
                    }).format(
                      item.offer.firstContacts.map((value) =>
                        t(`insuranceSource.firstContacts.${value}`),
                      ),
                    )
                  : missing,
              ],
              [
                "contactsVerification",
                item.offer.contactsVerified === undefined
                  ? missing
                  : t(
                      item.offer.contactsVerified
                        ? "insuranceSource.verifiedInSnapshot"
                        : "insuranceSource.toVerify",
                    ),
              ],
              ["tariffYear", t("insuranceSource.yearMissing")],
            ])}
            <p className="text-sm text-muted-foreground">{t("insuranceSource.eligibilityHelp")}</p>
            {item.offer.redistribution && (
              <p className="text-sm text-muted-foreground">
                {t("insuranceSource.redistribution", {
                  year: String(item.offer.redistribution.year),
                  monthly: money(item.offer.redistribution.monthlyMinor),
                  annual: money(item.offer.redistribution.annualMinor),
                })}
              </p>
            )}
          </section>
        </>
      ) : (
        <p role="status" className="rounded-lg border border-border p-4 text-sm">
          {t("insuranceSource.unavailable")}
        </p>
      )}
      <section
        className="space-y-4 border-t border-border pt-5"
        aria-labelledby="request-proof-title"
      >
        <h3 id="request-proof-title" className="font-semibold">
          {t("insuranceSource.provenance")}
        </h3>
        {rows([
          ["origin", t("insuranceSource.origin")],
          ["transmittedAt", transmitted],
          ["revision", String(source.requestRevision)],
          ["consent", t("insuranceSource.consent")],
          ["consentVersion", source.consentVersion],
          ["requestId", source.requestId],
        ])}
        <p className="text-sm text-muted-foreground">{t("insuranceSource.immutable")}</p>
      </section>
    </div>
  );
}
