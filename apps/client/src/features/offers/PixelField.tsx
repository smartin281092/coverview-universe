import { useEffect, useRef } from "react";

const step = 4; // CSS pixels between two dots, as on the reference page analysed on 8 October 2026
const tile = 128; // CSS pixels of the repeated tile: 32 × 32 dots

/**
 * White one-pixel dots that flicker like a screen's pixels, each at its own pace (8 October 2026).
 * One small tile is drawn and repeated over the canvas. Decorative: still when the user reduces
 * motion, paused while off screen or in a hidden tab.
 */
export function PixelField({ className }: { className?: string }) {
  const host = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = host.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const side = tile * ratio;
    const pattern = document.createElement("canvas");
    pattern.width = side;
    pattern.height = side;
    const pen = pattern.getContext("2d");
    if (!pen) return;
    const perRow = tile / step;
    // Each dot rests at a low opacity and peaks once per period, from half a second to a second.
    const dots = Array.from({ length: perRow * perRow }, (_, index) => ({
      x: (index % perRow) * step * ratio,
      y: Math.floor(index / perRow) * step * ratio,
      low: Math.random() * 0.12,
      high: 0.15 + Math.random() * 0.22,
      period: 500 + Math.random() * 500,
      phase: Math.random() * Math.PI * 2,
    }));
    let frame = 0;
    let previous = 0;
    const paint = (time: number) => {
      pen.clearRect(0, 0, side, side);
      pen.fillStyle = "#ffffff";
      for (const dot of dots) {
        const wave = still
          ? 0.5
          : (1 - Math.cos((time / dot.period) * Math.PI * 2 + dot.phase)) / 2;
        pen.globalAlpha = dot.low + (dot.high - dot.low) * wave;
        pen.fillRect(dot.x, dot.y, ratio, ratio);
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      const fill = context.createPattern(pattern, "repeat");
      if (!fill) return;
      context.fillStyle = fill;
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    const loop = (time: number) => {
      frame = window.requestAnimationFrame(loop);
      // About thirty images a second are enough for a flicker.
      if (time - previous < 33) return;
      previous = time;
      paint(time);
    };
    const resize = () => {
      canvas.width = Math.ceil(canvas.clientWidth * ratio);
      canvas.height = Math.ceil(canvas.clientHeight * ratio);
      paint(performance.now());
    };
    const size = new ResizeObserver(resize);
    size.observe(canvas);
    const view = new IntersectionObserver(([entry]) => {
      window.cancelAnimationFrame(frame);
      if (entry?.isIntersecting && !still) frame = window.requestAnimationFrame(loop);
    });
    view.observe(canvas);
    resize();
    return () => {
      window.cancelAnimationFrame(frame);
      size.disconnect();
      view.disconnect();
    };
  }, []);
  return <canvas ref={host} aria-hidden="true" className={className} />;
}
