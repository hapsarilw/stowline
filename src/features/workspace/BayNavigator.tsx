import { useMemo } from 'react';
import { bayOccupancy, pad } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { defaultFocus } from '@/features/bay-view/model';
import { cn } from '@/ui/cn';

const pct = (n: number, cap: number) => (cap === 0 ? 0 : Math.round((n / cap) * 100));

/** Deck and hold fill per bay, bays with violations marked, jump to a bay on click (FR-10). */
export function BayNavigator() {
  const ctx = usePlanStore((s) => s.ctx);
  const state = usePlanStore((s) => s.state);
  const byBay = usePlanStore((s) => s.violationIndex.byBay);
  const { bay: current, half } = useViewStore();
  const occupancy = useMemo(() => bayOccupancy(state, ctx), [state, ctx]);
  const bays = ctx.vessel.bays;

  return (
    <nav aria-label="Bay navigator" className="flex min-w-0 items-stretch gap-2 px-3 py-[3px]">
      <div
        aria-hidden="true"
        className="flex w-[38px] flex-none flex-col pt-[9px] text-[10px] text-text3"
      >
        <span className="h-4 leading-4">Deck</span>
        <span className="mt-0.5 h-4 leading-4">Hold</span>
        <span className="font-mono text-[9px] tracking-[0.04em]">BOW</span>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
        {occupancy.map((o, i) => {
          const isCurrent = o.bay === current;
          const n = byBay.get(o.bay) ?? 0;
          const deck = pct(o.deck, o.deckCapacity);
          const hold = pct(o.hold, o.holdCapacity);
          const gapAfter = i < bays.length - 1 && bays[i]!.x - bays[i + 1]!.x > 20;
          const fill = isCurrent ? 'var(--accent)' : n ? 'var(--text2)' : 'var(--text3)';
          return (
            <div key={o.bay} className="contents">
              <button
                type="button"
                aria-label={`Bay ${pad(o.bay)}: deck ${deck}% full, hold ${hold}% full${n ? `, ${n} violation${n > 1 ? 's' : ''}` : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  const { setBay } = useViewStore.getState();
                  setBay(o.bay, defaultFocus(ctx, state, o.bay, half));
                }}
                className={cn(
                  'flex min-w-0 flex-[1_1_0] cursor-pointer flex-col items-stretch gap-px rounded-[3px] border px-0.5 py-px hover:border-border2',
                  isCurrent ? 'border-accent bg-accentbg' : 'border-transparent bg-transparent',
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid h-2 place-items-center font-mono text-[8.5px] leading-none font-bold text-err"
                >
                  {n ? `▲${n}` : ''}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-[15px] items-end overflow-hidden rounded-[1px] bg-track"
                >
                  <span className="w-full" style={{ height: `${deck}%`, background: fill }} />
                </span>
                <span aria-hidden="true" className="h-0.5 bg-text3" />
                <span
                  aria-hidden="true"
                  className="flex h-[15px] items-end overflow-hidden rounded-[1px] bg-track"
                >
                  <span className="w-full" style={{ height: `${hold}%`, background: fill }} />
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'text-center font-mono text-[9.5px] leading-[1.15]',
                    isCurrent ? 'font-semibold text-text' : 'text-text3',
                  )}
                >
                  {pad(o.bay)}
                </span>
              </button>
              {gapAfter ? (
                <div
                  aria-hidden="true"
                  title="Deckhouse"
                  className="flex flex-[0_0_12px] flex-col gap-px py-0.5"
                >
                  <span className="flex-1 rounded-[1px] bg-border2" />
                  <span className="text-center font-mono text-[8px] text-text3">DH</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="flex flex-none items-end pb-px font-mono text-[9px] tracking-[0.04em] text-text3"
      >
        STERN
      </div>
    </nav>
  );
}
