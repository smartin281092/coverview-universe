import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { cn } from "cn";

/**
 * A completed action: a green badge pops, its check is drawn, then confetti burst and fall.
 * Played once. With reduced motion, the last frame (badge and check, no confetti) is shown.
 * The static badge underneath stays if the player cannot load.
 */
export function SuccessCheck({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let disposed = false;
    let animation: AnimationItem | undefined;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    void Promise.all([
      import("lottie-web/build/player/lottie_light.js"),
      import("./success-check.json"),
    ])
      .then(([{ default: lottie }, { default: animationData }]) => {
        if (disposed) return;
        animation = lottie.loadAnimation({
          container: node,
          renderer: "svg",
          loop: false,
          autoplay: !still,
          animationData: structuredClone(animationData),
        });
        if (still) animation.goToAndStop(animation.totalFrames - 1, true);
      })
      .catch(() => {
        /* The static badge stays. */
      });
    return () => {
      disposed = true;
      animation?.destroy();
    };
  }, []);
  return (
    <div className={cn("cv-success-check", className)} aria-hidden="true">
      <svg viewBox="0 0 320 320">
        <circle cx="160" cy="155" r="83" fill="#DCFCE7" />
        <circle cx="160" cy="155" r="62" fill="#16A34A" />
        <path
          d="M132 157l19 19 38-40"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div ref={host} />
    </div>
  );
}
