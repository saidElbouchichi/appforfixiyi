import { useId, useRef, type JSX, type ReactNode } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";
import { useDialog } from "./useDialog.js";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Usually the action buttons — rendered after the body, aligned to the inline end. */
  footer?: ReactNode;
  /** Maximum width: 400 / 520 / 720px. */
  size?: "sm" | "md" | "lg";
  closeLabel?: string;
  testId?: string;
}

/**
 * Dialog with the four things a modal is usually missing (WCAG 2.2 AA
 * 2.1.1/2.1.2/2.4.3/4.1.2): it is labelled by its own title, `Escape`
 * closes it, focus moves into it on open and returns to the trigger on
 * close, and `Tab` is trapped inside it — see `useDialog`.
 *
 * Rendered inline (no portal) rather than into `document.body`: the overlay
 * is `position: fixed`, which is enough here, and a portal would need
 * client-only guards to stay SSR-safe in Next.js' App Router.
 */
export function Modal({ open, title, onClose, children, footer, size = "md", closeLabel = "Fermer", testId }: ModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, onClose, dialogRef);

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
        className={cx("fx-modal", `fx-modal--${size}`)}
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
            <Icon name="close" />
          </button>
        </div>

        <div>{children}</div>

        {footer === undefined ? null : <div className="fx-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
