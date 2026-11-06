import { useEffect, useEffectEvent, useId, useRef } from "react";
import type { ReactNode } from "react";

function isOwnEntry(state: unknown, id: string): boolean {
  return typeof state === "object" && state !== null && "dialog" in state && state.dialog === id;
}

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly className?: string;
  /** Show a close button in the header. */
  readonly closable?: boolean;
}

/**
 * A modal built on the native <dialog>, which traps focus and closes on Esc. Opening it
 * adds a history entry, so the browser's Back button (or Android's back gesture) closes
 * the dialog rather than leaving the page.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  className = "",
  closable = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const closeFromHistory = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || dialog === null) {
      return undefined;
    }
    dialog.showModal();
    globalThis.history.pushState({ dialog: id }, "");
    let closedByHistory = false;
    const onPopState = () => {
      if (isOwnEntry(globalThis.history.state, id)) {
        // Still on this dialog's entry (a nested dialog closed, or a duplicate entry).
        return;
      }
      closedByHistory = true;
      closeFromHistory();
    };
    globalThis.addEventListener("popstate", onPopState);
    return () => {
      globalThis.removeEventListener("popstate", onPopState);
      dialog.close();
      if (!closedByHistory && isOwnEntry(globalThis.history.state, id)) {
        globalThis.history.back();
      }
    };
  }, [open, id]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className="dialog-body">
          <header className="dialog-header">
            <h2 id={`${id}-title`}>{title}</h2>
            {closable ? (
              <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
                ×
              </button>
            ) : undefined}
          </header>
          {children}
        </div>
      ) : undefined}
    </dialog>
  );
}
