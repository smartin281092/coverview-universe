import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { Check, FileCheck2 } from "lucide-react";
import animationData from "./request-progress.json";

export function RequestProgress({
  steps,
  current,
  cancelled = false,
  complete = false,
}: {
  steps: { label: string; description: string; at?: string | undefined }[];
  current: number;
  cancelled?: boolean;
  complete?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    let animation: AnimationItem | undefined;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (motion.matches || cancelled || complete) animation?.goToAndStop(60, true);
      else animation?.play();
    };
    void import("lottie-web/build/player/lottie_light.js")
      .then(({ default: lottie }) => {
        if (disposed) return;
        animation = lottie.loadAnimation({
          container: node,
          renderer: "svg",
          loop: true,
          autoplay: false,
          animationData: structuredClone(animationData),
        });
        update();
      })
      .catch(() => {
        /* The semantic steps and static vector stay available. */
      });
    motion.addEventListener("change", update);
    return () => {
      disposed = true;
      motion.removeEventListener("change", update);
      animation?.destroy();
    };
  }, [cancelled, complete]);
  return (
    <div className="cv-request-progress">
      <div className="cv-request-animation" aria-hidden="true">
        <FileCheck2 />
        <div ref={host} />
      </div>
      <ol className="cv-request-steps">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`${index < current || complete ? "is-done" : ""} ${index === current && !cancelled && !complete ? "is-current" : ""}`}
            aria-current={index === current && !cancelled && !complete ? "step" : undefined}
          >
            <span className="cv-request-step-icon">
              {index < current || complete ? <Check size={17} /> : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              {step.at && (
                <time dateTime={step.at}>
                  {new Intl.DateTimeFormat("fr-CH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(step.at))}
                </time>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
