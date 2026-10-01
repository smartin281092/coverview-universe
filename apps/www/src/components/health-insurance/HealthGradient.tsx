import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

const Scene = lazy(() => import("./HealthShaderScene"));

class GradientFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Decorative only: never receives a profile, answer or account identifier. */
export function HealthGradient() {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!preference.matches && document.visibilityState === "visible");
    update();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(Boolean(entry?.isIntersecting)),
    );
    if (host.current) observer.observe(host.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <span ref={host} className="hi-cta-shader" aria-hidden="true">
      {visible && motion && (
        <GradientFallback>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </GradientFallback>
      )}
    </span>
  );
}
