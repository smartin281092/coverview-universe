import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { LoaderCircle } from "lucide-react";

/** Decorative activity indicator; the adjacent text announces the server state. */
export function DocumentProcessingIndicator() {
  const icon = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(icon.current, { rotation: 360, duration: 1.2, repeat: -1, ease: "none" });
    });
    return () => motion.revert();
  }, []);
  return <LoaderCircle ref={icon} className="mt-1 size-5 shrink-0" aria-hidden="true" />;
}
