import type { ReactNode } from 'react';
import { cn } from './cn';
import { IconCheckCircle, IconError, IconWarning } from './icons';

export type TooltipTone = 'neutral' | 'error' | 'ok' | 'warning';

const BORDER: Record<TooltipTone, string> = {
  neutral: 'border-border2',
  error: 'border-err',
  ok: 'border-ok',
  warning: 'border-warn',
};
const TEXT: Record<TooltipTone, string> = {
  neutral: 'text-text',
  error: 'text-err',
  ok: 'text-ok',
  warning: 'text-warn',
};

interface TooltipCardProps {
  tone?: TooltipTone;
  title: ReactNode;
  /** The second line, in mono type. */
  detail?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * The tooltip box from the components sheet. A rule result has an icon and text,
 * never color alone (NFR-12).
 */
export function TooltipCard({
  tone = 'neutral',
  title,
  detail,
  className,
  children,
}: TooltipCardProps) {
  const Icon = tone === 'error' ? IconError : tone === 'warning' ? IconWarning : IconCheckCircle;
  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none flex flex-col gap-0.5 rounded border bg-raised px-[9px] py-1.5 text-[12px] text-text',
        BORDER[tone],
        className,
      )}
    >
      <span className={cn('flex items-center gap-1.5 font-semibold', TEXT[tone])}>
        {tone === 'neutral' ? null : <Icon size={13} strokeWidth={1.6} />}
        {title}
      </span>
      {detail ? <span className="font-mono text-[11px] text-text2">{detail}</span> : null}
      {children}
    </div>
  );
}
