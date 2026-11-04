import { useEffect, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";

export type ChoiceOption<T extends string> = {
  id: T;
  label: string;
  hint?: string;
  visual?: ReactNode;
  meta?: string;
};

/**
 * Une question à choix (3e pilier, prestataire, profil) : des cartes, une lettre de raccourci sur
 * chacune, la réponse passe à la question suivante d’elle-même.
 */
export function StepChoice<T extends string>({
  options,
  value,
  columns = 1,
  onSelect,
}: {
  options: readonly ChoiceOption<T>[];
  value: T | null;
  columns?: 1 | 2 | 3;
  onSelect: (id: T) => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toUpperCase();
      if (key.length !== 1 || key < "A" || key > "Z") return;
      const index = key.charCodeAt(0) - 65;
      const option = options[index];
      if (!option) return;
      event.preventDefault();
      onSelect(option.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [options, onSelect]);
  return (
    <div className={`audit-choices audit-choices-${columns}`} role="group">
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={index === 0 ? first : undefined}
            type="button"
            className={`audit-choice ${selected ? "is-selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelect(option.id)}
          >
            <span className="audit-choice-key" aria-hidden="true">
              {String.fromCharCode(65 + index)}
            </span>
            {option.visual && <span className="audit-choice-visual">{option.visual}</span>}
            <span className="audit-choice-text">
              <span className="audit-choice-label">{option.label}</span>
              {option.hint && <span className="audit-choice-hint">{option.hint}</span>}
            </span>
            {option.meta && <span className="audit-choice-meta">{option.meta}</span>}
            <span className="audit-choice-check" aria-hidden="true">
              <Check />
            </span>
          </button>
        );
      })}
    </div>
  );
}
