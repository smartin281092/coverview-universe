import { useEffect, useRef, type ReactNode } from "react";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";

/**
 * The base comparator's dialog and side sheet (HealthDialog), with this page's texts: a native
 * modal dialog, so focus stays inside, Escape closes it and the focus returns where it was.
 */
export function ScDialog({
  open,
  onClose,
  title,
  children,
  sheet = false,
  header,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  sheet?: boolean;
  header?: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement || previous instanceof SVGElement)
        previous.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={`hi-dialog ${sheet ? "hi-sheet" : ""} ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="hi-dialog-inner">
          <header className="hi-dialog-header">
            {header ?? <h2>{title}</h2>}
            <button
              type="button"
              className="hi-icon-button"
              onClick={onClose}
              aria-label={copy.close}
            >
              <HealthIcon name="close" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
