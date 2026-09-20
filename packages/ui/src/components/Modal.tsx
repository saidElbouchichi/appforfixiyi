import { useEffect, useId, useRef, type JSX, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Usually the action buttons — rendered after the body, aligned to the inline end. */
  footer?: ReactNode;
  closeLabel?: string;
  testId?: string;
}

/**
 * Dialog with the four things a modal is usually missing (WCAG 2.2 AA
 * 2.1.1/2.1.2/2.4.3/4.1.2): it is labelled by its own title, `Escape`
 * closes it, focus moves into it on open and returns to the trigger on
 * close, and `Tab` is trapped inside it.
 *
 * Rendered inline (no portal) rather than into `document.body`: the overlay
 * is `position: fixed`, which is enough here, and a portal would need
 * client-only guards to stay SSR-safe in Next.js' App Router.
 */
export function Modal({ open, title, onClose, children, footer, closeLabel = "Fermer", testId }: ModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab") {
        trapFocus(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fx-modal__overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="fx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        data-testid={testId}
      >
        <div className="fx-modal__header">
          <h2 className="fx-modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="fx-modal__close" onClick={onClose} aria-label={closeLabel}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div>{children}</div>

        {footer === undefined ? null : <div className="fx-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) {
    return;
  }
  const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!first || !last) {
    return;
  }

  if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
