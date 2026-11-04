import { useEffect, useRef } from "react";
import { mountPixelField } from "./pixel-field";

/** The flickering pixels as a React element: a canvas filling its box (see pixel-field.ts). */
export function PixelField({ className }: { className?: string }) {
  const host = useRef<HTMLCanvasElement>(null);
  useEffect(() => (host.current ? mountPixelField(host.current) : undefined), []);
  return <canvas ref={host} aria-hidden="true" className={className} />;
}
