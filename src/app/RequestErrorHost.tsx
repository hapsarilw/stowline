import { useRequestError } from '@/state/api';
import { Toast } from '@/ui/Toast';

/** A failed request, with Retry, on every route (NFR-18). */
export function RequestErrorHost() {
  const error = useRequestError((s) => s.error);
  const dismiss = useRequestError((s) => s.dismiss);
  if (!error) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <Toast
        tone="err"
        title="Request failed"
        message={error.message}
        onRetry={() => {
          dismiss();
          error.retry();
        }}
        onDismiss={dismiss}
      />
    </div>
  );
}
