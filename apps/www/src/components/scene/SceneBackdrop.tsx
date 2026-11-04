import { useEffect, useRef } from "react";
import { GradientScene, coverviewColors } from "./gradient-shader";
import { PixelField } from "./pixel-field";

/**
 * Fond d’un bandeau (4 novembre 2026) : le dégradé shader flouté, un voile sombre et la trame de
 * pixels, comme le hero de l’accueil et la page d’une offre dans Wallet. Décoratif : immobile
 * quand l’utilisateur réduit les animations, arrêté hors écran ou dans un onglet masqué.
 */
export function SceneBackdrop({
  colors = coverviewColors,
  className = "",
}: {
  colors?: readonly [string, string, string];
  className?: string;
}) {
  const gradientRef = useRef<HTMLCanvasElement>(null);
  const pixelRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const gradientCanvas = gradientRef.current;
    const pixelCanvas = pixelRef.current;
    if (!gradientCanvas || !pixelCanvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const gradient = new GradientScene(gradientCanvas, { colors });
    const pixels = new PixelField(pixelCanvas, { still: reduce.matches });
    let visible = true;
    const refresh = () => {
      const running = visible && !reduce.matches && document.visibilityState === "visible";
      pixels.setStill(reduce.matches);
      gradient.setRunning(running);
      pixels.setRunning(running);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      refresh();
    });
    observer.observe(gradientCanvas);
    reduce.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      observer.disconnect();
      reduce.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
      gradient.destroy();
      pixels.destroy();
    };
  }, [colors]);
  return (
    <div className={`cv-scene ${className}`} aria-hidden="true">
      <canvas ref={gradientRef} className="cv-scene-gradient" />
      <div className="cv-scene-shade" />
      <canvas ref={pixelRef} className="cv-scene-pixels" />
    </div>
  );
}
