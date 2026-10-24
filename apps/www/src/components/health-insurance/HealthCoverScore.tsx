import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { interpolate } from "./health-format";

type Rating = keyof typeof copy.coverviewScore.labels;
type Tier = keyof typeof copy.coverviewScore.tiers;
type Score = { tier: Tier; ratings: Record<Rating, number> };

// Sample scores for the local preview only: the Coverview score has no source of ratings yet,
// and invented ratings of named insurers never reach a published page. Spread over the models
// whatever their insurer, so that the three levels can be looked at.
const previews: Score[] = [
  { tier: "gold", ratings: { service: 9, reviews: 9, recommendation: 10 } },
  { tier: "silver", ratings: { service: 8, reviews: 7, recommendation: 8 } },
  { tier: "bronze", ratings: { service: 7, reviews: 6, recommendation: 6 } },
];
export const coverviewScorePreview = (modelId: string) =>
  previews[[...modelId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % previews.length]!;

// The model page's Coverview score, beside the price (user requests, 24 October 2026): its
// level in Martius, a slanted metallic gradient outlined in its dark shade and crossed now and
// then by a gleam, then the « i » whose floating detail gives the three ratings out of ten.
export function HealthCoverScore({ score }: { score: Score }) {
  return (
    <section className="hi-cover-score" aria-labelledby="hi-cover-score-title">
      <h4 id="hi-cover-score-title">{copy.coverviewScore.title}</h4>
      <div className="hi-cover-score-grade">
        <span className={`hi-cover-score-tier is-${score.tier}`}>
          {copy.coverviewScore.tiers[score.tier]}
        </span>
        <div className="hi-info-tooltip hi-cover-score-info">
          <button
            type="button"
            aria-label={copy.coverviewScore.details}
            aria-describedby="hi-cover-score-details"
          >
            <HealthIcon name="info-i" size={18} />
          </button>
          <div role="tooltip" id="hi-cover-score-details">
            <dl>
              {(Object.keys(copy.coverviewScore.labels) as Rating[]).map((key) => (
                <div key={key}>
                  <dt>{copy.coverviewScore.labels[key]}</dt>
                  <dd>
                    <span className="hi-sr-only">
                      {interpolate(copy.coverviewScore.rating, { value: score.ratings[key] })}
                    </span>
                    {Array.from({ length: 10 }, (_, index) => (
                      <span
                        key={index}
                        aria-hidden="true"
                        className={index < score.ratings[key] ? "is-full" : undefined}
                      />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
