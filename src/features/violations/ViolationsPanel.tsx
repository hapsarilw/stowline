import { useMemo, useState } from 'react';
import type { Violation } from '@/domain';
import { applyFix, fixFor, runValidation, showViolation } from '@/state/actions';
import { canEditPlan, readOnlyReason } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { useSessionStore } from '@/state/session-store';
import { useViewStore, type SeverityFilter } from '@/state/view-store';
import { PodBadge } from '@/ui/Badges';
import { cn } from '@/ui/cn';
import { IconCheckCircle, IconError, IconEye, IconWarning } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { buildViolations, type ViolationRow } from './model';

// The violations panel (FR-42 to FR-45), as design 04: severity filter and Re-run, the time of
// the last full check, then errors and warnings with the containers involved, Show and Apply fix.

function Row({
  r,
  editable,
  reason,
}: {
  r: ViolationRow;
  editable: boolean;
  reason: string | null;
}) {
  const tone = r.severity === 'error' ? 'text-err' : 'text-warn';
  return (
    <article
      aria-label={r.label}
      data-violation={r.id}
      onClick={() => showViolation(r.id)}
      className={cn(
        'flex cursor-pointer flex-col gap-1.5 border-b border-border px-3 py-2.5 hover:bg-hover',
        r.selected && 'bg-sel shadow-[inset_0_0_0_1px_var(--accent)] hover:bg-sel',
        r.isNew &&
          'animate-[stw-slide_160ms_ease-out] motion-reduce:animate-[stw-fade_100ms_linear]',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('text-[10.5px] font-semibold tracking-[0.05em] uppercase', tone)}>
          {r.heading}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[11.5px] text-text2">{r.slot}</span>
      </div>
      <p className="m-0 text-[12.5px] leading-[1.4] text-pretty">{r.message}</p>
      {r.selected && r.involved.length ? (
        <ul
          aria-label="Containers involved"
          className="m-0 flex list-none flex-col rounded border border-border bg-bg px-2 py-1"
        >
          {r.involved.map((x) => (
            <li
              key={x.slot}
              className="grid h-6 grid-cols-[52px_minmax(0,1fr)_34px_36px] items-center gap-1.5 font-mono text-[11.5px]"
            >
              <span className="text-text2">{x.slot}</span>
              <span className="truncate">{x.id}</span>
              <span className="text-right">{x.weight}</span>
              <PodBadge pod={x.podCode} className="h-4 justify-self-end px-1 text-[10.5px]" />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-start gap-1.5 text-[12px] text-text2">
        <span className="flex-none font-semibold text-text">Fix</span>
        <span className="flex-1 text-pretty">{r.fixText}</span>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label={`Show ${r.heading.toLowerCase()} at ${r.slot}`}
          onClick={(e) => {
            e.stopPropagation();
            showViolation(r.id);
          }}
          className="flex h-6 cursor-pointer items-center gap-[5px] rounded-[3px] border border-border2 bg-raised px-2 text-[12px] hover:border-text3"
        >
          <IconEye size={13} />
          Show
        </button>
        {r.action ? (
          <button
            type="button"
            disabled={!editable}
            title={reason ?? undefined}
            aria-label={r.action.name}
            onClick={(e) => {
              e.stopPropagation();
              applyFix(r.id);
            }}
            // On the surface color, not transparent: on a selected row's --sel the accent text
            // falls to 4.4:1 in the light theme (WCAG AA needs 4.5:1).
            className="h-6 cursor-pointer rounded-[3px] border border-accent bg-surface px-2 text-[12px] text-accent hover:bg-hover disabled:cursor-default disabled:opacity-45"
          >
            {r.action.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** Ids that were not there before the last change: their rows slide in (FR-45). */
function useNewIds(violations: readonly Violation[]): ReadonlySet<string> {
  const [prev, setPrev] = useState(violations);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  if (violations !== prev) {
    const before = new Set(prev.map((v) => v.id));
    setPrev(violations);
    setFresh(new Set(violations.filter((v) => !before.has(v.id)).map((v) => v.id)));
  }
  return fresh;
}

export function ViolationsPanel() {
  const violations = usePlanStore((s) => s.violations);
  const state = usePlanStore((s) => s.state);
  const ctx = usePlanStore((s) => s.ctx);
  const checkedAt = usePlanStore((s) => s.checkedAt);
  const severity = useViewStore((s) => s.severity);
  const focused = useViewStore((s) => s.focusedViolation);
  const newIds = useNewIds(violations);
  const status = usePlanStore((s) => s.header.status);
  const role = useSessionStore((s) => s.role);
  const editable = canEditPlan(role, status);
  const reason = readOnlyReason(role, status);

  const m = useMemo(
    () =>
      buildViolations({
        violations,
        state,
        ctx,
        severity,
        focused,
        newIds,
        checkedAt: new Date(checkedAt),
        fixOf: fixFor,
      }),
    [violations, state, ctx, severity, focused, newIds, checkedAt],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-2 px-3 py-2">
        <Segmented<SeverityFilter>
          label="Severity"
          value={severity}
          onChange={(id) => useViewStore.getState().setSeverity(id)}
          options={m.filters.map((f) => ({
            id: f.id,
            label: (
              <>
                {f.label} <span className="font-mono text-[11px]">{f.count}</span>
              </>
            ),
          }))}
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void runValidation()}
          className="h-6 cursor-pointer rounded-[3px] border-0 bg-transparent px-2 text-[12px] text-accent hover:bg-hover"
        >
          Re-run
        </button>
      </div>
      <div
        data-testid="violations-summary"
        className="flex-none px-3 pb-2 text-[11.5px] text-pretty text-text2"
      >
        {m.summary}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {m.groups.map((g) => {
          const Icon = g.severity === 'error' ? IconError : IconWarning;
          return (
            <div key={g.severity} role="group" aria-label={g.label}>
              <div
                className={cn(
                  'sticky top-0 z-[1] flex h-7 items-center gap-1.5 border-y border-border bg-bg px-3 text-[11px] font-semibold tracking-[0.06em] uppercase',
                  g.severity === 'error' ? 'text-err' : 'text-warn',
                )}
              >
                <Icon size={13} strokeWidth={1.6} />
                <span>{g.label}</span>
                <span className="font-mono">{g.rows.length}</span>
              </div>
              {g.rows.map((r) => (
                <Row key={r.id} r={r} editable={editable} reason={reason} />
              ))}
            </div>
          );
        })}
        {m.empty ? (
          <div className="flex flex-col gap-1.5 px-4 py-6 text-[12.5px] text-text2">
            <span className="flex items-center gap-1.5 font-semibold text-ok">
              <IconCheckCircle size={14} strokeWidth={1.6} />
              No violations
            </span>
            All rule checks pass for the current plan.
          </div>
        ) : null}
      </div>
    </div>
  );
}
