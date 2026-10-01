import { useEffect, useRef, type ReactNode } from "react";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
export function HealthDialog({
  open,
  onClose,
  title,
  children,
  sheet = false,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  sheet?: boolean;
  header?: ReactNode;
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
      className={`hi-dialog ${sheet ? "hi-sheet" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="hi-dialog-inner">
        <header className="hi-dialog-header">
          {header ?? <h2>{title}</h2>}
          <button className="hi-icon-button" onClick={onClose} aria-label={copy.close}>
            <HealthIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
