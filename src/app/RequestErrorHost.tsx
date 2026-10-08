import { useRequestError } from '@/state/api';
import { Toast } from '@/ui/Toast';

/** A failed request, with Retry, on every route (NFR-18); "Retrying…" while it runs (design 14). */
export function RequestErrorHost() {
  const error = useRequestError((s) => s.error);
  const retrying = useRequestError((s) => s.retrying);
  const dismiss = useRequestError((s) => s.dismiss);
  if (!error) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <Toast
        tone="err"
        title="Request failed"
        message={error.message}
        retrying={retrying === null ? null : { attempt: retrying }}
        onRetry={() => useRequestError.getState().retry()}
        onDismiss={dismiss}
      />
    </div>
  );
}
