import { PODS, ROTATION } from '@/domain';
import { runValidation } from '@/state/actions';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { CountBadge, PodSwatch, StatusBadge } from '@/ui/Badges';
import { Button, IconButton } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { IconCheckCircle, IconMoon, IconRedo, IconSun, IconUndo } from '@/ui/icons';

const Divider = () => (
  <div aria-hidden="true" className="hidden h-6 w-px flex-none bg-border min-[1360px]:block" />
);

function Logo() {
  const on = [true, false, false, true, true, false, true, true, true];
  return (
    <div className="flex flex-none items-center gap-2">
      <div
        aria-hidden="true"
        className="grid grid-cols-[repeat(3,6px)] grid-rows-[repeat(3,6px)] gap-px"
      >
        {on.map((filled, i) => (
          <span key={i} className={filled ? 'bg-accent' : 'border border-border2'} />
        ))}
      </div>
      <span className="text-[14px] font-semibold tracking-[0.01em]">Stowline</span>
    </div>
  );
}

function Rotation() {
  return (
    <ol
      aria-label="Port rotation"
      className="m-0 flex min-w-0 flex-none list-none items-center gap-0.5 p-0"
    >
      {ROTATION.map((p, i) => {
        const current = p.state === 'current';
        const done = p.state === 'done';
        return (
          <li key={p.code} className="flex items-center gap-0.5">
            {i > 0 ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
                className="text-text3"
              >
                <path d="m6 4 4 4-4 4" />
              </svg>
            ) : null}
            <span
              title={`${p.name} · ${p.when}`}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex h-6 items-center gap-1.5 rounded border px-1.5 font-mono text-[11.5px] min-[1360px]:px-[7px]',
                current
                  ? 'border-accent bg-accentbg font-semibold text-text'
                  : 'border-border font-medium',
                done ? 'text-text3' : !current && 'text-text',
              )}
            >
              {done ? (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : null}
              {p.code in PODS ? <PodSwatch pod={p.code} /> : null}
              <span>{p.code}</span>
              <span className="sr-only">
                , {p.name}, {p.when}
                {done ? ', done' : ''}
              </span>
              {current ? (
                <span className="rounded-[2px] bg-accent px-1 font-sans text-[10px] font-semibold uppercase tracking-[0.04em] text-onaccent">
                  Now
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Vessel and voyage, port rotation, status, planned count, and the main actions (FR-09). */
export function TopBar() {
  const header = usePlanStore((s) => s.header);
  const vessel = usePlanStore((s) => s.ctx.vessel);
  const total = usePlanStore((s) => s.loadList.length);
  const planned = usePlanStore((s) => s.planned);
  const violations = usePlanStore((s) => s.violations.length);
  const canUndo = usePlanStore((s) => s.history.length > 0);
  const canRedo = usePlanStore((s) => s.future.length > 0);
  const theme = useViewStore((s) => s.theme);
  const pct = (planned / total) * 100;

  return (
    <header
      aria-label="Plan"
      className="col-span-full row-start-1 flex min-w-0 items-center gap-2 border-b border-border bg-surface pr-2 pl-3 min-[1360px]:gap-3"
    >
      <Logo />
      <Divider />
      <div className="flex flex-none flex-col leading-[1.2]">
        <span className="text-[13px] font-semibold">{vessel.name}</span>
        <span className="font-mono text-[11px] text-text2">
          Voy {header.voyage} · {vessel.teu.toLocaleString('en-US')} TEU
        </span>
      </div>
      <Divider />
      <Rotation />
      <Divider />
      <div className="flex flex-none items-center gap-2.5">
        <StatusBadge status={header.status} />
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11.5px] text-text2">
            <span className="font-semibold text-text">{planned.toLocaleString('en-US')}</span> /{' '}
            {total.toLocaleString('en-US')} planned
          </span>
          <div
            role="progressbar"
            aria-label="Plan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct * 10) / 10}
            className="h-[3px] w-20 overflow-hidden rounded-[2px] bg-track min-[1360px]:w-[132px]"
          >
            <div className="h-full bg-accent" style={{ width: `${pct.toFixed(1)}%` }} />
          </div>
        </div>
      </div>
      <div className="min-w-2 flex-1" />
      <div className="flex flex-none gap-0.5">
        <IconButton
          label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => usePlanStore.getState().undo()}
        >
          <IconUndo size={15} />
        </IconButton>
        <IconButton
          label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={() => usePlanStore.getState().redo()}
        >
          <IconRedo size={15} />
        </IconButton>
      </div>
      <Button className="flex-none pr-1.5 pl-2.5" onClick={() => void runValidation()}>
        <IconCheckCircle size={14} />
        <span>Validate</span>
        <CountBadge tone="errSoft" label="violations">
          {violations}
        </CountBadge>
      </Button>
      <Button variant="primary" className="flex-none px-3.5" disabled>
        Save
      </Button>
      <IconButton
        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="flex-none"
        onClick={() => useViewStore.getState().toggleTheme()}
      >
        {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
      </IconButton>
      <span
        role="img"
        aria-label="Account: Rina Adiputri, vessel planner"
        className="grid size-7 flex-none place-items-center rounded-full border border-border2 bg-raised text-[11px] font-semibold text-text2"
      >
        RA
      </span>
    </header>
  );
}
