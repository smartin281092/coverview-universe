import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export type LineTab<T extends string> = { id: T; label: string; icon: LucideIcon; color: string };

/**
 * La barre d’onglets de Wallet et du comparateur : un rail gris, un soulignement de 3 px à la
 * couleur de l’icône qui glisse vers l’onglet ouvert, l’icône colorée une fois l’onglet ouvert.
 * Flèches gauche et droite, Début et Fin au clavier.
 */
export function LineTabs<T extends string>({
  tabs,
  value,
  label,
  onChange,
}: {
  tabs: readonly LineTab<T>[];
  value: T;
  label: string;
  onChange: (id: T) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const measure = () => {
      const open = node.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (open) setUnderline({ left: open.offsetLeft, width: open.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    list.current?.querySelector<HTMLElement>(`[data-tab="${target.id}"]`)?.focus();
  };
  const current = tabs.find((tab) => tab.id === value);
  return (
    <div ref={list} className="audit-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map(({ id, label: name, icon: Icon, color }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`audit-tab-${id}`}
            data-tab={id}
            aria-selected={selected}
            aria-controls={`audit-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            className="audit-tab"
            style={{ "--tab-color": color } as React.CSSProperties}
            onClick={() => onChange(id)}
          >
            <Icon aria-hidden="true" />
            {name}
          </button>
        );
      })}
      <span className="audit-tabs-track" aria-hidden="true" />
      {underline && (
        <span
          className="audit-tabs-underline"
          aria-hidden="true"
          style={{
            width: underline.width,
            transform: `translateX(${underline.left}px)`,
            backgroundColor: current?.color,
          }}
        />
      )}
    </div>
  );
}
