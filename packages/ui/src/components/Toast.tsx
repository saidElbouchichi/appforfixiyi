import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";

import { cx } from "../cx.js";

import type { AlertVariant } from "./Alert.js";
import { Icon, type IconName } from "./Icon.js";
import { IconButton } from "./IconButton.js";

const VARIANT_ICON: Record<AlertVariant, IconName> = { info: "info", success: "success", warning: "warning", error: "error" };

export interface ToastOptions {
  variant?: AlertVariant;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  /**
   * Milliseconds before it leaves. `null` keeps it until dismissed — the
   * default for errors, which the user must be able to read at their pace.
   */
  duration?: number | null;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

export interface ToastApi {
  show: (toast: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  /** Older toasts beyond this are dropped: a stack taller than 3 hides the page. */
  max?: number;
  defaultDuration?: number;
  regionLabel?: string;
  dismissLabel?: string;
}

/**
 * Part 2B "Toast". Mount once near the root; call `useToast().show()`
 * anywhere below. The region is always in the DOM and polite, so a toast is
 * announced when it appears; an error toast interrupts (`role="alert"`).
 */
export function ToastProvider({ children, max = 3, defaultDuration = 5000, regionLabel = "Notifications", dismissLabel = "Fermer" }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastOptions) => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      const duration = toast.duration !== undefined ? toast.duration : toast.variant === "error" ? null : defaultDuration;
      setToasts((current) => [...current, { ...toast, duration, id }].slice(-max));
      return id;
    },
    [defaultDuration, max],
  );

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <section className="fx-toast-region" aria-label={regionLabel}>
        <ol className="fx-toast-list" aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} dismissLabel={dismissLabel} />
          ))}
        </ol>
      </section>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast() must be called under a <ToastProvider>.");
  return api;
}

/**
 * The countdown pauses while the pointer or the focus is on the toast
 * (WCAG 2.2.1): the time left is kept, not restarted.
 */
function ToastItem({ toast, onDismiss, dismissLabel }: { toast: ToastEntry; onDismiss: (id: number) => void; dismissLabel: string }): JSX.Element {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration ?? null);
  const variant = toast.variant ?? "info";

  useEffect(() => {
    if (paused || remainingRef.current === null) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingRef.current);
    return () => {
      clearTimeout(timer);
      if (remainingRef.current !== null) remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [paused, onDismiss, toast.id]);

  return (
    <li
      className={cx("fx-toast", `fx-toast--${variant}`)}
      role={variant === "error" ? "alert" : undefined}
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
    >
      <Icon name={VARIANT_ICON[variant]} className="fx-toast__icon" />
      <div className="fx-toast__content">
        <p className="fx-toast__title">{toast.title}</p>
        {toast.message ? <p className="fx-toast__message">{toast.message}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className="fx-toast__action"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <IconButton
        label={dismissLabel}
        icon="close"
        onClick={() => {
          onDismiss(toast.id);
        }}
      />
    </li>
  );
}
