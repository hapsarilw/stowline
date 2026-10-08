import { undoLast } from '@/state/placement-store';
import { useConflict } from '@/state/save';
import { useViewStore } from '@/state/view-store';
import { Toast } from '@/ui/Toast';

/** Shows the current result message above the footer. A command's message offers Undo (FR-57). */
export function ToastHost() {
  const toast = useViewStore((s) => s.toast);
  const dismiss = useViewStore((s) => s.dismissToast);
  // While a save conflict waits for an answer, its alert holds the place (design 12, 16).
  const conflict = useConflict((s) => s.conflict !== null);
  if (!toast || conflict) return null;
  return (
    <div
      onMouseEnter={() => useViewStore.getState().holdToast(true)}
      onMouseLeave={() => useViewStore.getState().holdToast(false)}
      onFocus={() => useViewStore.getState().holdToast(true)}
      onBlur={() => useViewStore.getState().holdToast(false)}
      className="absolute bottom-[76px] left-1/2 z-30 -translate-x-1/2 animate-[stw-in_160ms_ease-out] motion-reduce:animate-[stw-fade_100ms_linear]"
    >
      <Toast
        tone={toast.kind}
        title={toast.title}
        message={toast.message}
        onUndo={toast.undo ? undoLast : undefined}
        action={toast.action}
        onDismiss={dismiss}
      />
    </div>
  );
}
