import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Infobulle d’explication (4 novembre 2026) : un bouton « i » qui montre un court texte au survol,
 * au focus et au clic ; Échap ou un clic ailleurs la ferme. Le texte est lié au bouton pour les
 * lecteurs d’écran. Les détails longs vont dans un dialogue, pas ici (FRONT-14).
 */
export function InfoTip({
  text,
  label,
  children,
}: {
  text: string;
  label: string;
  children?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPress = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open]);
  return (
    <span
      ref={host}
      className={`audit-tip ${open ? "is-open" : ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      {children}
      <button
        type="button"
        className="audit-tip-button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="audit-tip-bubble" hidden={!open}>
        {text}
      </span>
    </span>
  );
}
