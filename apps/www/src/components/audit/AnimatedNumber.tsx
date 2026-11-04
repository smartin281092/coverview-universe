import { useEffect, useRef } from "react";
import { loadGsap, useReducedMotion } from "./use-motion";

/** Un nombre qui compte jusqu’à sa valeur à l’arrivée, puis glisse à chaque changement. */
export function AnimatedNumber({
  value,
  format,
  duration = 1.1,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (reduced) {
      shown.current = value;
      element.textContent = format(value);
      return;
    }
    const state = { value: shown.current };
    let tween: { kill: () => void } | undefined;
    void loadGsap().then((gsap) => {
      tween = gsap.to(state, {
        value,
        duration,
        ease: "power3.out",
        onUpdate: () => {
          shown.current = state.value;
          element.textContent = format(state.value);
        },
      });
    });
    return () => tween?.kill();
  }, [value, format, reduced, duration]);
  return <span ref={node}>{format(value)}</span>;
}
