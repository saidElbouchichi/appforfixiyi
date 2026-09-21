import { useId, useRef, type JSX, type ReactNode } from "react";

import { Icon } from "./Icon.js";
import { useDialog } from "./useDialog.js";

export interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky actions at the bottom, within thumb reach. */
  footer?: ReactNode;
  closeLabel?: string;
  testId?: string;
}

/**
 * Part 2B "BottomSheet": the phone's modal — it rises from the bottom edge,
 * within thumb reach. Same dialog contract as Modal (`useDialog`). The grab
 * handle is decorative: closing is done with the close button, `Escape` or
 * a tap on the scrim, never with a gesture alone (WCAG 2.5.1).
 */
export function BottomSheet({ open, title, onClose, children, footer, closeLabel = "Fermer", testId }: BottomSheetProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, onClose, sheetRef);

  if (!open) return null;

  return (
    <div
      className="fx-sheet__overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fx-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={sheetRef} data-testid={testId}>
        <span className="fx-sheet__handle" aria-hidden="true" />
        <div className="fx-sheet__header">
          <h2 className="fx-modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="fx-modal__close" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="fx-sheet__body">{children}</div>
        {footer === undefined ? null : <div className="fx-sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}
