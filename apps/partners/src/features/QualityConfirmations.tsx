import { useTranslation } from "react-i18next";
import { Badge } from "@coverview/ui";
import type { CaseConfirmation } from "@coverview/contracts/partner-quality";
import { formatDate } from "./Field";

const facts = ["contact", "appointment", "documents", "contract"] as const;
// A calendar date stated by the client, shown as such whatever the browser time zone.
const day = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

// The client's statements beside what the request declared at that moment (C8d, brief I.17.2).
export function QualityConfirmations({ items }: { items: CaseConfirmation[] }) {
  const { t } = useTranslation("quality");
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{t("confirmations.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("confirmations.notProof")}</p>
      {items.map((item) => (
        <article key={item.id} className="space-y-2 border-t border-border py-4">
          <p className="text-sm text-muted-foreground">
            {formatDate(item.createdAt)}
            {t("separator")}
            {t(`confirmations.channel.${item.channel}`)}
          </p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_1fr]">
            {facts.map((fact) => (
              <div key={fact} className="contents">
                <dt className="font-medium">{t(`confirmations.fact.${fact}`)}</dt>
                <dd>
                  {t("confirmations.client", {
                    answer: t(`confirmations.answers.${item.facts[fact]}`),
                  })}
                </dd>
                <dd className="text-muted-foreground">
                  {t("confirmations.declared", {
                    answer: t(`confirmations.declaredAnswers.${String(item.declared[fact])}`),
                  })}
                </dd>
              </div>
            ))}
          </dl>
          {item.facts.insurer && (
            <p className="text-sm">{t("confirmations.insurer", { name: item.facts.insurer })}</p>
          )}
          {item.facts.signedOn && (
            <p className="text-sm">
              {t("confirmations.signedOn", { date: day(item.facts.signedOn) })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {item.discrepancies.map((discrepancy) => (
              <Badge key={discrepancy} variant="outline">
                {t(`confirmations.discrepancy.${discrepancy}`)}
              </Badge>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
