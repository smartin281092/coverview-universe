import { useState, type ComponentProps } from "react";
import type { EvidenceCatalog } from "@coverview/api-client/health-recommendation";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";

type Benefit = EvidenceCatalog["benefits"][number];
type Icon = ComponentProps<typeof HealthIcon>["name"];

const illustrations: Record<string, Icon> = {
  // Canonical taxonomy keys.
  partner_discounts: "bag",
  health_product_discounts: "bag",
  pharmacy_purchase_discount: "pharmacy",
  mail_order_pharmacy: "pharmacy",
  fitness_discounts: "fitness",
  prevention_courses: "fitness",
  activity_rewards_program: "gift",
  supplementary_premium_discount: "family",
  referral_reward: "family",
  assistance_services: "shield",
  hardship_fund: "heart",
  occupational_prevention: "shield",
  health_legal_protection: "shield",
  premium_payment_discount: "discount",
  insurance_bundle_discount: "discount",
  health_coaching: "heart",
  mental_health_support: "heart",
  vaccination_cost_share_waiver: "pharmacy",
  // Keys of catalogues published before the taxonomy.
  member_shop_discounts: "bag",
  member_hotel_discounts: "hotel",
  hotelcard_discount: "hotel",
  family_supplementary_discount: "family",
  customer_referral_reward: "family",
  activity_rewards: "fitness",
  cycling_prevention_contribution: "bike",
  member_swimming_access: "swimming",
  preventive_checkup: "doctor",
  complementary_medicine_advice: "phone",
  fitness_contribution: "fitness",
  fitness_membership_discount: "fitness",
  pharmacy_welcome_voucher: "gift",
  pharmacy_club_membership_discount: "pharmacy",
  activity_supplementary_premium_discount: "fitness",
  activity_reward_eligibility: "fitness",
  activity_cash_reward: "gift",
  activity_cash_reward_supplementary: "gift",
  activity_voucher_reward: "gift",
  flu_vaccine_event: "pharmacy",
  agricultural_prevention_discount: "shield",
  agricultural_safety_check_contribution: "shield",
  safety_equipment_discount: "shield",
  agricultural_family_assistance: "family",
  hardship_support_fund: "heart",
};

function illustrationFor(benefit: Benefit): Icon {
  return (
    illustrations[benefit.equivalenceGroup] ??
    (benefit.category === "pharmacy"
      ? "pharmacy"
      : benefit.category === "telemedicine"
        ? "phone"
        : benefit.category === "prevention"
          ? "heart"
          : "gift")
  );
}

export function HealthClubBenefits({
  benefits,
  catalog,
  year,
}: {
  benefits: Benefit[];
  catalog: EvidenceCatalog;
  year: number;
}) {
  const [selected, setSelected] = useState<Benefit | null>(null);
  const confirmed =
    selected?.year === year && selected.yearConfirmed && selected.verification === "verified";
  const labels = new Map(catalog.benefitTypes.map((type) => [type.key, type.label]));
  return (
    <>
      <ul className="hi-club-grid">
        {benefits.map((benefit) => (
          <li key={benefit.id}>
            <button
              type="button"
              className="hi-club-card"
              aria-haspopup="dialog"
              onClick={() => setSelected(benefit)}
            >
              <span className="hi-club-art" aria-hidden="true">
                <HealthIcon name={illustrationFor(benefit)} size={48} />
              </span>
              {labels.has(benefit.equivalenceGroup) && (
                <span className="hi-benefit-type">{labels.get(benefit.equivalenceGroup)}</span>
              )}
              <strong>{benefit.title}</strong>
              <span className="hi-club-advantage">{benefit.effect}</span>
            </button>
          </li>
        ))}
      </ul>
      <HealthDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? copy.evidence.title}
      >
        {selected && (
          <div className="hi-club-detail">
            {labels.has(selected.equivalenceGroup) && (
              <p className="hi-benefit-type">{labels.get(selected.equivalenceGroup)}</p>
            )}
            <p>{selected.effect}</p>
            {/* No « à vérifier / à confirmer » mention on the model page (user request,
                24 October 2026: « Ça ne fait pas sérieux »): only what is known is said. */}
            {selected.classification !== "unknown" && (
              <p className="hi-small">
                {copy.evidence.nature[selected.classification]} · {year}
              </p>
            )}
            {confirmed && <p className="hi-small">{copy.evidence.confirmed}</p>}
            {selected.telemedicine !== "not_applicable" && selected.telemedicine !== "unknown" && (
              <p>{copy.evidence.telemedicine[selected.telemedicine]}</p>
            )}
            <h3>{copy.evidence.conditions}</h3>
            <p>
              {selected.conditions} {selected.activation}
            </p>
            {selected.exclusions && (
              <>
                <h3>{copy.evidence.exclusions}</h3>
                <p>{selected.exclusions}</p>
              </>
            )}
            {selected.sourceIds.map((id) => {
              const source = catalog.sources.find((item) => item.id === id);
              return (
                source && (
                  <div className="hi-club-source" key={id}>
                    <a href={source.url} className="hi-text-link" target="_blank" rel="noreferrer">
                      {source.title}
                      {source.page ? ` · p. ${source.page}` : ""} ↗
                    </a>
                    <p>{source.passage}</p>
                    <small>
                      {copy.evidence.source} · {source.checkedAt}
                    </small>
                  </div>
                )
              );
            })}
          </div>
        )}
      </HealthDialog>
    </>
  );
}
