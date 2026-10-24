import { healthCopy as copy } from "../../content/fr/health-insurance";
import { interpolate } from "./health-format";

type Scores = Record<"service" | "reviews" | "quality", number>;

// Sample ratings for the local preview only, the same for every model: CoverScore has no source
// of ratings yet, and invented ratings of named insurers never reach a published page.
export const coverScorePreview: Scores = { service: 8, reviews: 7, quality: 9 };

// The model page's CoverScore (user request, 24 October 2026): three ratings out of ten, each as
// ten small bars, filled ones in a pink to red gradient.
export function HealthCoverScore({ scores }: { scores: Scores }) {
  return (
    <section className="hi-cover-score" aria-labelledby="hi-cover-score-title">
      <h4 id="hi-cover-score-title">{copy.coverScore.title}</h4>
      <dl>
        {(Object.keys(copy.coverScore.labels) as (keyof Scores)[]).map((key) => (
          <div key={key}>
            <dt>{copy.coverScore.labels[key]}</dt>
            <dd role="img" aria-label={interpolate(copy.coverScore.rating, { value: scores[key] })}>
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index} className={index < scores[key] ? "is-full" : undefined} />
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
