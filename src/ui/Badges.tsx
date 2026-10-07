import type { ReactNode } from 'react';
import { PODS, type PlanStatus } from '@/domain';
import { cn } from './cn';
import { IconCheckCircle, IconError, IconNotApplicable, IconWarning } from './icons';

/** POD color is always paired with the printed POD code (NFR-12). */
export function PodBadge({ pod, className }: { pod: string; className?: string }) {
  const known = pod in PODS ? PODS[pod as keyof typeof PODS] : null;
  return (
    <span
      title={known?.name}
      className={cn(
        'inline-flex h-[18px] items-center rounded-[3px] px-[5px] font-mono text-[11px] font-semibold text-[#0b1220]',
        className,
      )}
      style={{ background: `var(--pod-${pod.toLowerCase()})` }}
    >
      {known?.short ?? pod}
    </span>
  );
}

/** A small square of the POD color, for rotation chips and legends. */
export function PodSwatch({ pod, size = 8 }: { pod: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block rounded-[1px]"
      style={{ width: size, height: size, background: `var(--pod-${pod.toLowerCase()})` }}
    />
  );
}

const STATUS: Record<PlanStatus, { label: string; box: string; dot: string }> = {
  draft: { label: 'Draft', box: 'border-border2 text-text2', dot: 'border-text2' },
  in_review: {
    label: 'In review',
    box: 'border-warn/50 bg-warnbg text-warn',
    dot: 'border-warn',
  },
  approved: {
    label: 'Approved',
    box: 'border-ok/50 bg-okbg text-ok',
    dot: 'border-ok bg-ok',
  },
};

/** Plan status: a dot and the status text. */
export function StatusBadge({ status }: { status: PlanStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-[5px] rounded border px-[7px] text-[10.5px] font-semibold uppercase tracking-[0.05em]',
        s.box,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full border-[1.5px]', s.dot)} />
      {s.label}
    </span>
  );
}

/** A number in a colored box, such as the violation count. */
export function CountBadge({
  tone,
  children,
  label,
}: {
  tone: 'err' | 'errSoft';
  children: ReactNode;
  /** What the number counts, read by screen readers after it: "violations". */
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] font-mono font-semibold',
        tone === 'err'
          ? 'h-[18px] bg-err px-[5px] text-[11px] text-onerr'
          : 'bg-errbg px-[5px] py-px text-[11px] text-err',
      )}
    >
      {children}
      {label ? (
        <>
          {' '}
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </span>
  );
}

export type StatusTone = 'error' | 'warning' | 'ok' | 'na';

const TONE_TEXT: Record<StatusTone, string> = {
  error: 'text-err',
  warning: 'text-warn',
  ok: 'text-ok',
  na: 'text-text3',
};

/** A status always has an icon and text (NFR-12). */
export function StatusIcon({ tone, size = 14 }: { tone: StatusTone; size?: number }) {
  const label = { error: 'Error', warning: 'Warning', ok: 'Pass', na: 'Not applicable' }[tone];
  const Icon = {
    error: IconError,
    warning: IconWarning,
    ok: IconCheckCircle,
    na: IconNotApplicable,
  }[tone];
  return (
    <span className={cn('grid', TONE_TEXT[tone])} role="img" aria-label={label}>
      <Icon size={size} />
    </span>
  );
}

export const toneText = (tone: StatusTone): string => TONE_TEXT[tone];
