import { useViewStore } from '@/state/view-store';
import { Toast } from '@/ui/Toast';

/** Shows the current result message above the footer. */
export function ToastHost() {
  const toast = useViewStore((s) => s.toast);
  const dismiss = useViewStore((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="absolute bottom-[76px] left-1/2 z-30 -translate-x-1/2 animate-[stw-in_160ms_ease-out]">
      <Toast tone={toast.kind} title={toast.title} message={toast.message} onDismiss={dismiss} />
    </div>
  );
}
