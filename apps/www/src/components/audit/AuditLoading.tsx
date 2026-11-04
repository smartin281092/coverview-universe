import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import { SceneBackdrop } from "../scene/SceneBackdrop";
import { loadGsap, useReducedMotion } from "./use-motion";

export type LoadingKey = keyof typeof copy.loading.lines;
export const loadingKeys = Object.keys(copy.loading.lines) as LoadingKey[];
export type LoadingState = Record<LoadingKey, "pending" | "active" | "done">;

/** L’écran de calcul : chaque ligne se coche quand le travail correspondant est réellement fait. */
export function AuditLoading({ state }: { state: LoadingState }) {
  const reduced = useReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const done = loadingKeys.filter((key) => state[key] === "done").length;
  useEffect(() => {
    if (reduced || !list.current) return;
    void loadGsap().then((gsap) => {
      gsap.fromTo(
        list.current?.querySelectorAll("li") ?? [],
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.09, ease: "power3.out" },
      );
    });
  }, [reduced]);
  return (
    <section className="audit-loading" aria-live="polite" aria-busy={done < loadingKeys.length}>
      <SceneBackdrop className="audit-loading-scene" />
      <div className="audit-loading-card">
        <p className="audit-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.loading.title}</h1>
        <ol ref={list} className="audit-loading-list">
          {loadingKeys.map((key) => {
            const status = state[key];
            return (
              <li key={key} data-status={status}>
                <span className="audit-loading-mark" aria-hidden="true">
                  {status === "done" ? (
                    <Check />
                  ) : status === "active" ? (
                    <span className="audit-spinner" />
                  ) : null}
                </span>
                <span>{copy.loading.lines[key]}</span>
                <span className="audit-visually-hidden">
                  {status === "done" ? copy.loading.done : copy.loading.pending}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="audit-loading-bar" aria-hidden="true">
          <span style={{ width: `${(done / loadingKeys.length) * 100}%` }} />
        </div>
        <p className="audit-loading-note">{copy.loading.note}</p>
      </div>
    </section>
  );
}
