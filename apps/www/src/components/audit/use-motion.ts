import { useEffect, useState } from "react";

/** Préférence de réduction des animations, suivie en direct. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

type Gsap = (typeof import("gsap"))["gsap"];
let loading: Promise<Gsap> | null = null;

/** GSAP, chargé une fois et seulement dans le navigateur (le rendu serveur ne l’importe pas). */
export function loadGsap(): Promise<Gsap> {
  loading ??= import("gsap").then((module) => module.gsap);
  return loading;
}

/** Les mots d’un titre, chacun dans un span, pour une révélation mot à mot. */
export function splitWords(text: string): string[] {
  return text.split(/(\s+)/u).filter((part) => part.length > 0);
}
