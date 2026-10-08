import { Button } from './Button';
import { cn } from './cn';
import { IconButton } from './Button';
import { IconCheckCircle, IconClose, IconError, IconSpinner, IconWarning } from './icons';

export type ToastTone = 'ok' | 'info' | 'warn' | 'err';

interface ToastProps {
  tone: ToastTone;
  title: string;
  message?: string;
  onUndo?: () => void;
  /** For a failed request (NFR-18). */
  onRetry?: () => void;
  /** Another action, with its label. */
  action?: { label: string; run: () => void };
  /** Showing that the request is running again (design 14). */
  retrying?: { attempt: number } | null;
  onDismiss?: () => void;
}

/**
 * A result message (FR-45). Errors are announced at once, the others politely (NFR-14).
 * The icon and the title always come together.
 */
export function Toast({
  tone,
  title,
  message,
  onUndo,
  onRetry,
  action,
  retrying,
  onDismiss,
}: ToastProps) {
  const Icon = tone === 'err' ? IconError : tone === 'warn' ? IconWarning : IconCheckCircle;
  if (retrying) {
    // Design 14: the request is running again. Text carries the state, the spinner only turns
    // when motion is allowed.
    return (
      <div
        role="alert"
        className="flex min-w-[380px] max-w-[600px] items-center gap-2.5 rounded border border-border2 bg-raised py-2 pr-3 pl-3"
      >
        <span className="grid text-accent motion-safe:animate-spin">
          <IconSpinner size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[12.5px] font-semibold">Retrying…</span>
          <span className="text-[12px] text-text2">Attempt {retrying.attempt}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      role={tone === 'err' ? 'alert' : 'status'}
      className={cn(
        'flex min-w-[380px] max-w-[600px] items-center gap-2.5 rounded border bg-raised py-2 pr-1.5 pl-3',
        tone === 'err' ? 'border-err' : tone === 'warn' ? 'border-warn' : 'border-border2',
      )}
    >
      <span
        className={cn(
          'grid',
          tone === 'err' ? 'text-err' : tone === 'warn' ? 'text-warn' : 'text-ok',
        )}
      >
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[12.5px] font-semibold">{title}</span>
        {message ? <span className="text-[12px] text-pretty text-text2">{message}</span> : null}
      </div>
      {onUndo ? (
        <Button
          variant="secondary"
          className="h-[26px] border-border2 bg-transparent px-2.5 text-[12px] font-normal"
          onClick={onUndo}
        >
          Undo
        </Button>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          className="h-[26px] border-border2 bg-transparent px-2.5 text-[12px] font-normal"
          onClick={action.run}
        >
          {action.label}
        </Button>
      ) : null}
      {onRetry ? (
        <Button
          variant="secondary"
          className="h-[26px] border-border2 bg-transparent px-2.5 text-[12px] font-normal"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
      {onDismiss ? (
        <IconButton
          label="Dismiss"
          size="sm"
          className="size-[26px] text-text2"
          onClick={onDismiss}
        >
          <IconClose size={12} />
        </IconButton>
      ) : null}
    </div>
  );
}
