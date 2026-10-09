import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  AdvisorProfileCard,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  swissCantonNamesFr,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { usePictureUrl } from "./use-picture";
import { numberFormat } from "../../number-format";

const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
const languages = new Intl.DisplayNames(["fr"], { type: "language" });

// Shown only for people serving one of the client's own requests; the server decides.
export function AdvisorProfileDialog({
  userId,
  queryKey,
  onClose,
}: {
  userId: string;
  queryKey: readonly unknown[];
  onClose: () => void;
}) {
  const { t } = useTranslation("offers");
  const profile = useQuery({
    queryKey: [...queryKey, "advisor-profile", userId],
    queryFn: ({ signal }) => partnerApi.publicProfile(userId, true, signal),
    gcTime: 0,
    retry: false,
  });
  // Photo and organisation logo (C8c), fetched only when the published profile states them.
  const organization = profile.data?.organizationProfile ?? null;
  const photoUrl = usePictureUrl(
    [...queryKey, "advisor-photo", userId, profile.data?.publishedAt ?? null],
    (signal) => partnerApi.advisorPhoto(userId, true, signal),
    profile.data?.photo?.mime ?? null,
  );
  const logoUrl = usePictureUrl(
    [...queryKey, "advisor-logo", userId, organization?.publishedAt ?? null],
    (signal) => partnerApi.advisorOrganizationLogo(userId, true, signal),
    organization?.logo?.mime ?? null,
  );
  const unpublished =
    profile.error instanceof PartnerApiError && profile.error.code === "PARTNER_NOT_FOUND";
  const list = (values: string[]) =>
    values.length ? values.join(", ") : t("advisorProfile.facts.none");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("advisorProfile.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("advisorProfile.title")}</DialogDescription>
        </DialogHeader>
        {profile.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("advisorProfile.loading")}
          </p>
        ) : profile.isError ? (
          <p role={unpublished ? "status" : "alert"} className="text-sm">
            {unpublished ? t("advisorProfile.unpublished") : t("advisorProfile.error")}
          </p>
        ) : (
          <AdvisorProfileCard
            name={profile.data.name}
            organization={profile.data.organization}
            presentation={profile.data.presentation}
            photoUrl={photoUrl}
            photoAlt={t("advisorProfile.photoAlt", { name: profile.data.name })}
            organizationProfile={
              organization
                ? {
                    heading: t("advisorProfile.organization", { name: organization.name }),
                    presentation: organization.presentation,
                    logoUrl,
                    logoAlt: t("advisorProfile.logoAlt", { name: organization.name }),
                  }
                : null
            }
            facts={[
              {
                label: t("advisorProfile.facts.specialties"),
                value: list(profile.data.specialties.map((c) => t(`categories.${c}`))),
              },
              {
                label: t("advisorProfile.facts.languages"),
                value: list(profile.data.languages.map((code) => languages.of(code) ?? code)),
              },
              {
                label: t("advisorProfile.facts.cantons"),
                value: list(
                  profile.data.cantons.map(
                    (code) => swissCantonNamesFr[code as keyof typeof swissCantonNamesFr] ?? code,
                  ),
                ),
              },
              {
                label: t("advisorProfile.facts.modes"),
                value: list(profile.data.modes.map((mode) => t(`advice.modes.${mode}`))),
              },
            ]}
            rating={
              profile.data.rating.status === "available"
                ? t("advisorProfile.rating.available", {
                    average:
                      profile.data.rating.average === null
                        ? undefined
                        : numberFormat("fr-CH").format(profile.data.rating.average),
                  })
                : t("advisorProfile.rating.insufficient", {
                    count: profile.data.rating.count,
                    minimum: profile.data.rating.minimum,
                  })
            }
            ratingDetail={t("advisorProfile.rating.detail", {
              count: profile.data.rating.count,
              minimum: profile.data.rating.minimum,
              from: day.format(new Date(profile.data.rating.periodFrom)),
              to: day.format(new Date(profile.data.rating.periodTo)),
            })}
          />
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t("advisorProfile.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
