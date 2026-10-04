import { useTranslation } from "react-i18next";
import type { Recommendation } from "@coverview/contracts/partner-recommendations";

const date = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );

// The advisor's validated recommendation, kept apart from the automatic orientation.
export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const { t } = useTranslation("offers");
  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/40 p-4">
      <h3 className="font-semibold">{t("recommendation.title")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("recommendation.meta", {
          author: recommendation.author,
          date: date(recommendation.createdAt),
        })}
      </p>
      {recommendation.status === "to_review" ? (
        <p role="status" className="text-sm">
          {t("recommendation.toReview")}
        </p>
      ) : (
        <>
          <p className="font-medium">
            {recommendation.kind === "offer"
              ? t("recommendation.offer", {
                  company: recommendation.company ?? "",
                  product: recommendation.product ?? "",
                })
              : t(`recommendation.${recommendation.kind}`)}
          </p>
          <p className="whitespace-pre-wrap text-sm">{recommendation.rationale}</p>
          {recommendation.attention && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {t("recommendation.attention", { value: recommendation.attention })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("recommendation.decision")}</p>
        </>
      )}
    </section>
  );
}
