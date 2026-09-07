import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/** The server reports stages, not a byte/page percentage: keep progress indeterminate. */
export function DocumentProgress({ label }: { label: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        bar.current,
        { xPercent: -100 },
        { xPercent: 300, duration: 1.6, repeat: -1, ease: "none" },
      );
    });
    return () => motion.revert();
  }, []);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuetext={label}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div ref={bar} className="h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
