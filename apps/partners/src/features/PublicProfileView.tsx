import { useTranslation } from "react-i18next";
import { AdvisorProfileCard, swissCantonNamesFr } from "@coverview/ui";
import type { PublicProfile } from "@coverview/contracts/partner-profiles";

const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
const languages = new Intl.DisplayNames(["fr"], { type: "language" });

export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation("profiles"),
    { t: base } = useTranslation();
  const list = (values: string[]) => (values.length ? values.join(", ") : t("facts.none"));
  const rating = profile.rating;
  return (
    <AdvisorProfileCard
      name={profile.name}
      organization={profile.organization}
      presentation={profile.presentation}
      facts={[
        {
          label: t("facts.specialties"),
          value: list(profile.specialties.map((c) => base(`category.${c}`))),
        },
        {
          label: t("facts.languages"),
          value: list(profile.languages.map((code) => languages.of(code) ?? code)),
        },
        {
          label: t("facts.cantons"),
          value: list(
            profile.cantons.map(
              (code) => swissCantonNamesFr[code as keyof typeof swissCantonNamesFr] ?? code,
            ),
          ),
        },
        {
          label: t("facts.modes"),
          value: list(profile.modes.map((mode) => base(`appointment.${mode}`))),
        },
      ]}
      rating={
        rating.status === "available"
          ? t("rating.available", { average: rating.average?.toLocaleString("fr-CH") })
          : t("rating.insufficient", { count: rating.count, minimum: rating.minimum })
      }
      ratingDetail={t("rating.detail", {
        count: rating.count,
        minimum: rating.minimum,
        from: day.format(new Date(rating.periodFrom)),
        to: day.format(new Date(rating.periodTo)),
      })}
    />
  );
}
