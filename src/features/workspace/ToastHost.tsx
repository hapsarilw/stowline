import { undoLast } from '@/state/placement-store';
import { useViewStore } from '@/state/view-store';
import { Toast } from '@/ui/Toast';

/** Shows the current result message above the footer. A command's message offers Undo (FR-57). */
export function ToastHost() {
  const toast = useViewStore((s) => s.toast);
  const dismiss = useViewStore((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="absolute bottom-[76px] left-1/2 z-30 -translate-x-1/2 animate-[stw-in_160ms_ease-out] motion-reduce:animate-[stw-fade_100ms_linear]">
      <Toast
        tone={toast.kind}
        title={toast.title}
        message={toast.message}
        onUndo={toast.undo ? undoLast : undefined}
        onDismiss={dismiss}
      />
    </div>
  );
}
