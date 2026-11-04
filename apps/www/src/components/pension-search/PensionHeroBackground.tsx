import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { PixelField } from "@coverview/ui/pixel-field";

const Scene = lazy(() => import("./PensionShaderScene"));

// Without WebGL the section keeps its still gradient (CSS).
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Animated gradient, blur above it and sharp flickering pixels on top, as on Wallet's offer pages
 * (user request, 4 November 2026). Still with reduced motion, the page's pause button, a hidden
 * tab or off screen.
 */
export default function PensionHeroBackground() {
  const host = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const page = host.current?.closest<HTMLElement>("[data-landing]");
    let visible = true;
    const update = () =>
      setStill(
        reduce.matches ||
          document.visibilityState !== "visible" ||
          !visible ||
          page?.dataset.motion === "paused",
      );
    const view = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      update();
    });
    if (host.current) view.observe(host.current);
    const pause = new MutationObserver(update);
    if (page) pause.observe(page, { attributes: true, attributeFilter: ["data-motion"] });
    update();
    // The shader waits for the page to settle: its chunk never delays the first paint.
    const idle = window.setTimeout(() => setReady(true), 150);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(idle);
      view.disconnect();
      pause.disconnect();
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div ref={host} className="lpp-hero-layers" aria-hidden="true">
      <div className="lpp-hero-shader">
        {ready && (
          <SceneBoundary>
            <Suspense fallback={null}>
              <Scene still={still} />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <div className="lpp-hero-blur" />
      <PixelField className="lpp-hero-pixels" />
    </div>
  );
}
