import { Button } from '@/ui/Button';
import { StatusIcon, toneText } from '@/ui/Badges';
import { cn } from '@/ui/cn';
import { IconLock } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { buildInspector } from './model';
import { useMemo } from 'react';

const STATUS_BOX = {
  error: 'border-err text-err',
  warning: 'border-warn text-warn',
  ok: 'border-ok text-ok',
} as const;

const SECTION = 'flex flex-col gap-2.5 border-b border-border p-3';
const LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text3';

/** Facts about the selected container and its slot. Read only for now (FR-46, FR-47). */
export function Inspector() {
  const ctx = usePlanStore((s) => s.ctx);
  const state = usePlanStore((s) => s.state);
  const violations = usePlanStore((s) => s.violations);
  const selected = useViewStore((s) => s.selected);
  const m = useMemo(
    () => buildInspector(ctx, state, violations, selected),
    [ctx, state, violations, selected],
  );

  if (!m) {
    return (
      <div className="flex flex-col gap-2 px-4 py-6 text-[12.5px] text-text2">
        <span className="font-semibold text-text">Nothing selected</span>
        <span className="text-pretty">
          Select a container in the load list, the 3D view or the bay grid. In the grid, use the
          arrow keys to move between slots.
        </span>
      </div>
    );
  }

  const stackBar = { err: 'var(--err)', warn: 'var(--warn)', accent: 'var(--accent)' }[
    m.stack.tone
  ];
  return (
    <>
      <div className={SECTION}>
        <div className="flex items-center gap-1.5">
          <span className={LABEL}>Container</span>
          <div className="flex-1" />
          {m.locked ? (
            <span className="inline-flex h-[18px] items-center gap-1 rounded-[3px] border border-border2 px-1.5 text-[11px] text-text2">
              <IconLock size={10} strokeWidth={1.8} />
              Locked
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex h-[18px] items-center rounded-[3px] border px-1.5 text-[11px] font-semibold',
              STATUS_BOX[m.status.tone],
            )}
          >
            {m.status.text}
          </span>
        </div>
        <div className="font-mono text-[17px] font-semibold tracking-[0.02em]">{m.id}</div>
        <div
          aria-hidden="true"
          className="relative box-border flex h-[52px] items-center justify-between rounded-[2px] border border-[rgba(11,18,32,0.45)] px-2.5 text-[#0b1220]"
          style={{
            backgroundColor: `var(--pod-${m.pod.code.toLowerCase()})`,
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(11,18,32,0.16) 0 2px, transparent 2px 7px)',
          }}
        >
          <div
            className="flex flex-col px-1 py-0.5 leading-[1.1]"
            style={{ background: `var(--pod-${m.pod.code.toLowerCase()})` }}
          >
            <span className="font-mono text-[18px] font-bold">{m.pod.short}</span>
            <span className="text-[10.5px] font-semibold">{m.pod.name}</span>
          </div>
          <div
            className="flex flex-col items-end px-1 py-0.5 font-mono text-[10.5px] leading-[1.2] font-semibold"
            style={{ background: `var(--pod-${m.pod.code.toLowerCase()})` }}
          >
            <span>{m.iso}</span>
            <span>{m.weight} t</span>
          </div>
        </div>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-[5px] text-[12px]">
          {m.fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-text2">{f.label}</dt>
              <dd className="m-0 truncate text-right font-mono text-[11.5px]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={SECTION}>
        <div className="flex items-baseline justify-between">
          <span className={LABEL}>{m.slot.title}</span>
          <span className="text-[11.5px] text-text2">{m.slot.note}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {m.slot.parts.map((p) => (
            <div
              key={p.label}
              className="flex flex-col gap-0.5 rounded border border-border bg-bg px-2 py-1.5"
            >
              <span className="font-mono text-[18px] font-semibold">{p.value}</span>
              <span className="text-[11px] text-text2">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-[5px]">
          <div className="flex justify-between text-[12px]">
            <span className="text-text2">{m.stack.label}</span>
            <span className={cn('font-mono font-semibold', m.stack.tone === 'err' && 'text-err')}>
              {m.stack.text}
            </span>
          </div>
          <div className="relative h-1.5 rounded-[2px] bg-track">
            <div
              className="h-full rounded-[2px]"
              style={{ width: `${m.stack.percent}%`, background: stackBar }}
            />
            <div
              title="Stack limit"
              className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-text"
              style={{ left: `${m.stack.limitPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col px-3 py-2.5">
        <span className={cn(LABEL, 'mb-1')}>Rule checks</span>
        <ul className="m-0 list-none p-0">
          {m.checks.map((k) => (
            <li
              key={k.rule}
              className="grid min-h-[26px] grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border text-[12px]"
            >
              <StatusIcon tone={k.tone} />
              <span>{k.name}</span>
              <span className={cn('font-mono text-[11.5px]', toneText(k.tone))}>{k.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1" />
      <div className="sticky bottom-0 grid grid-cols-3 gap-1.5 border-t border-border bg-surface px-3 py-2.5">
        {(['Unplace', 'Lock', 'Swap'] as const).map((label) => (
          <Button
            key={label}
            disabled
            aria-keyshortcuts={label[0]}
            className="h-[30px] gap-1.5 text-[12.5px]"
          >
            <span>{label}</span>
            <Kbd>{label[0]}</Kbd>
          </Button>
        ))}
      </div>
    </>
  );
}
