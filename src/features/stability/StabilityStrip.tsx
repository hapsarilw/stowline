import { usePlanStore } from '@/state/plan-store';
import { cn } from '@/ui/cn';
import { IconCheckCircle, IconChevronUp, IconError, IconWarning } from '@/ui/icons';
import { buildGauges, type GaugeModel } from './gauges';
import { useTween } from './useTween';

const TONE_TEXT = { ok: 'text-ok', check: 'text-warn', limit: 'text-err' } as const;
const ZONE_BG = { err: 'var(--err)', ok: 'var(--ok)', warn: 'var(--warn)' } as const;

function Gauge({ g }: { g: GaugeModel }) {
  const Icon = g.state === 'ok' ? IconCheckCircle : g.state === 'check' ? IconWarning : IconError;
  return (
    <div
      role="group"
      aria-label={`${g.label} ${g.value} ${g.unit}, ${g.stateText}`}
      className="box-border flex w-32 flex-col justify-center gap-[3px] border-r border-border px-3"
    >
      <div className="flex items-center gap-1.5 text-[11px] text-text2">
        <span>{g.label}</span>
        <div className="flex-1" />
        <span
          className={cn(
            'inline-flex items-center gap-[3px] text-[10px] font-semibold uppercase tracking-[0.04em]',
            TONE_TEXT[g.state],
          )}
        >
          <Icon size={11} strokeWidth={1.8} />
          {g.stateText}
        </span>
      </div>
      <div className="flex items-baseline gap-[5px] whitespace-nowrap">
        <span className="font-mono text-[15px] font-semibold">{g.value}</span>
        <span className="truncate text-[10.5px] text-text2">{g.unit}</span>
      </div>
      <div className="relative h-1 rounded-[2px] bg-track">
        {g.zones.map((z) => (
          <span
            key={z.left}
            className="absolute top-0 bottom-0 opacity-60"
            style={{ left: `${z.left}%`, width: `${z.width}%`, background: ZONE_BG[z.tone] }}
          />
        ))}
        <span
          className="absolute -top-[3px] -bottom-[3px] -ml-px w-0.5 bg-text"
          style={{ left: `${g.mark}%` }}
        />
        {g.delta ? (
          <span className="absolute -top-[19px] right-0 rounded-[2px] bg-accentbg px-[3px] font-mono text-[10.5px] font-semibold text-accent">
            {g.delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** GM, trim, list and bending moment with shear force, always visible (FR-50). */
export function StabilityStrip() {
  const stability = usePlanStore((s) => s.stability);
  const limits = usePlanStore((s) => s.ctx.vessel.limits);
  const target = [stability.gm, stability.trim, stability.list, stability.bmPct, stability.sfPct];
  const [gm, trim, list, bmPct, sfPct] = useTween(target);
  const gauges = buildGauges(
    { gm: gm!, trim: trim!, list: list!, bmPct: bmPct!, sfPct: sfPct! },
    {
      gm: stability.gm,
      trim: stability.trim,
      list: stability.list,
      bmPct: stability.bmPct,
      sfPct: stability.sfPct,
    },
    limits,
  );

  return (
    <section aria-label="Stability" className="flex items-stretch border-l border-border">
      {gauges.map((g) => (
        <Gauge key={g.key} g={g} />
      ))}
      <button
        type="button"
        disabled
        aria-label="Stability details"
        className="flex w-[72px] flex-col items-center justify-center gap-[3px] border-0 bg-transparent text-[11px] text-text2 disabled:opacity-45"
      >
        <IconChevronUp size={14} strokeWidth={1.6} />
        <span>Stability</span>
      </button>
    </section>
  );
}
