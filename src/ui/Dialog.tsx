import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { IconClose } from './icons';
import { IconButton } from './Button';

// A modal dialog built from the existing tokens (decision D7). Esc closes it, Tab stays inside
// it while it is open, and the focus goes back to where it was.

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Dialog({ title, onClose, children, footer, width = 480 }: DialogProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first =
      root.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      root.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => before?.focus?.();
  }, []);
  // Esc closes the dialog wherever the focus is, also when a button was disabled under it.
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [onClose]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgba(5,9,16,0.6)] p-4"
      onKeyDown={onKeyDown}
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full flex-col rounded-md border border-border2 bg-surface text-text shadow-lg"
        style={{ maxWidth: width }}
      >
        <div className="flex h-11 flex-none items-center gap-2 border-b border-border pr-2 pl-4">
          <h2 className="m-0 flex-1 text-[14px] font-semibold">{title}</h2>
          <IconButton label="Close dialog" size="sm" onClick={onClose}>
            <IconClose size={12} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 text-[12.5px]">{children}</div>
        {footer ? (
          <div className="flex flex-none justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
