import { useMemo } from 'react';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { StatusIcon } from '@/ui/Badges';
import { cn } from '@/ui/cn';
import { IconClose } from '@/ui/icons';
import {
  draftDiagram,
  drawerStatus,
  gmDial,
  hydrostatics,
  listDial,
  strengthChart,
  trimBar,
  trimText,
  type DrawerStatus,
} from './drawer';
import { useTween } from './useTween';

// The stability drawer (FR-53, design 05). Opens from the Stability button on the strip. The
// numbers and needles count over 300 ms (FR-52). Colors are tokens, so both themes work.

export const DRAWER_ID = 'stability-drawer';

const TONE = { ok: 'text-ok', check: 'text-warn', limit: 'text-err' } as const;
const ICON_TONE = { ok: 'ok', check: 'warning', limit: 'error' } as const;

function Status({ s }: { s: DrawerStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', TONE[s.state])}>
      <StatusIcon tone={ICON_TONE[s.state]} size={11} />
      {s.text}
    </span>
  );
}

const MONO = { fontFamily: 'var(--font-mono)' };

export function StabilityDrawer() {
  const open = useViewStore((s) => s.drawerOpen);
  const bay = useViewStore((s) => s.bay);
  const r = usePlanStore((s) => s.stability);
  const ctx = usePlanStore((s) => s.ctx);
  const planned = usePlanStore((s) => s.planned);
  const total = usePlanStore((s) => s.loadList.length);
  const header = usePlanStore((s) => s.header);
  const [gm, trim, list, fwd, aft, mean] = useTween([
    r.gm,
    r.trim,
    r.list,
    r.draftFwd,
    r.draftAft,
    r.draftMean,
  ]) as [number, number, number, number, number, number];

  const chart = useMemo(() => strengthChart(r.bmCurve, r.sfCurve, ctx, bay), [r, ctx, bay]);
  if (!open) return null;

  const L = ctx.vessel.limits;
  const h = ctx.vessel.hydrostatics;
  const status = drawerStatus(r, L);
  const wl = draftDiagram({ trim, draftMean: mean }, h.summerDraftM);
  const gmD = gmDial(gm, L);
  const listD = listDial(list, L);
  const bar = trimBar(trim, L);
  const hydro = hydrostatics({ ...r, gm }, h);

  return (
    <section
      id={DRAWER_ID}
      aria-label="Stability details"
      className="absolute right-0 bottom-16 left-0 z-20 flex h-[392px] animate-[stw-up_220ms_ease-out] flex-col border-t border-border2 bg-surface motion-reduce:animate-[stw-fade_100ms_linear]"
    >
      <div className="flex h-10 flex-none items-center gap-3 border-b border-border pr-2 pl-4">
        <h2 className="m-0 text-[13px] font-semibold">Stability</h2>
        <span className="text-[12px] text-text2">
          Departure condition · {header.port} · {header.status} plan,{' '}
          {planned.toLocaleString('en-US')} of {total.toLocaleString('en-US')} loaded
        </span>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Close stability drawer"
          onClick={() => useViewStore.getState().setDrawerOpen(false)}
          className="grid size-7 cursor-pointer place-items-center rounded border-0 bg-transparent text-text2 hover:bg-hover hover:text-text"
        >
          <IconClose size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_400px]">
        {/* Longitudinal strength */}
        <div className="flex min-w-0 flex-col gap-2 border-r border-border px-4 py-3">
          <div className="flex items-center gap-3.5 text-[12px]">
            <span className="font-semibold">Longitudinal strength</span>
            <span className="text-text2">% of permissible, along ship length</span>
            <div className="flex-1" />
            <span className="inline-flex items-center gap-[5px] text-text2">
              <span className="h-0.5 w-4 bg-accent" />
              Bending moment
            </span>
            <span className="inline-flex items-center gap-[5px] text-text2">
              <span className="w-4 border-t-2 border-dashed border-text" />
              Shear force
            </span>
            <span className="inline-flex items-center gap-[5px] text-text2">
              <span className="w-4 border-t border-dashed border-err" />
              Limit
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[36px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_16px] gap-x-1.5 gap-y-0.5">
            <div
              aria-hidden="true"
              className="relative text-right font-mono text-[10px] text-text3"
            >
              {[
                ['+100', 4.5],
                ['+50', 27.3],
                ['0', 50],
                ['−50', 72.7],
                ['−100', 95.5],
              ].map(([t, at]) => (
                <span
                  key={t}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${at}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="relative rounded-[2px] border border-border bg-bg">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 600 220"
                preserveAspectRatio="none"
                role="img"
                aria-label={chart.label}
                className="absolute inset-0"
              >
                <rect
                  x={chart.bandX}
                  y="0"
                  width="24"
                  height="220"
                  style={{ fill: 'var(--accent)' }}
                  opacity="0.1"
                />
                <path
                  d="M0 60H600M0 160H600"
                  style={{ stroke: 'var(--border)' }}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 110H600"
                  style={{ stroke: 'var(--border2)' }}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 10H600M0 210H600"
                  style={{ stroke: 'var(--err)' }}
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 25H600M0 195H600"
                  style={{ stroke: 'var(--warn)' }}
                  strokeDasharray="2 4"
                  opacity="0.7"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  data-testid="sf-curve"
                  d={chart.sfPath}
                  fill="none"
                  style={{ stroke: 'var(--text)' }}
                  strokeWidth="1.6"
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  data-testid="bm-curve"
                  d={chart.bmPath}
                  fill="none"
                  style={{ stroke: 'var(--accent)' }}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {chart.peaks.map((p) => (
                <span
                  key={p.text}
                  aria-hidden="true"
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-[130%] bg-bg px-[3px] font-mono text-[10.5px] font-semibold whitespace-nowrap',
                    p.tone === 'accent' ? 'text-accent' : 'text-text',
                  )}
                  style={{ left: `${p.left}%`, top: `${p.top}%` }}
                >
                  {p.text}
                </span>
              ))}
              <span
                aria-hidden="true"
                className="absolute top-0.5 right-1.5 bg-bg px-0.5 text-[10px] text-err"
              >
                100% limit
              </span>
              <span
                aria-hidden="true"
                className="absolute top-[9%] right-1.5 bg-bg px-0.5 text-[10px] text-warn"
              >
                85% caution
              </span>
            </div>
            <span />
            <div aria-hidden="true" className="relative font-mono text-[10px] text-text3">
              {chart.bays.map((b) => (
                <span
                  key={b.label}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${b.left}%` }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Draft and trim */}
        <div className="flex min-w-0 flex-col gap-2 border-r border-border px-4 py-3">
          <div className="flex items-center gap-2.5 text-[12px]">
            <span className="font-semibold">Draft and trim</span>
            <span className="text-text2">Trim exaggerated ×8</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 340 170"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Draft forward ${fwd.toFixed(2)} metres, aft ${aft.toFixed(2)} metres, ${trimText(trim)}`}
            >
              <path
                d="M14 40 L300 40 L326 44 L322 108 L304 140 L52 140 Q30 132 22 104 Z"
                style={{ fill: 'var(--raised)', stroke: 'var(--border2)' }}
              />
              <rect
                x="196"
                y="6"
                width="16"
                height="34"
                style={{ fill: 'var(--g-house)' }}
                opacity="0.85"
              />
              <path d="M24 40V26h162v14M222 40V30h76v10" style={{ fill: 'var(--border)' }} />
              <path d="M24 33h162M222 35h76" style={{ stroke: 'var(--bg)' }} strokeWidth="0.6" />
              <polygon points={wl.poly} style={{ fill: 'var(--accent)' }} opacity="0.16" />
              <line
                x1="0"
                y1={wl.summerY}
                x2="340"
                y2={wl.summerY}
                style={{ stroke: 'var(--warn)' }}
                strokeDasharray="4 3"
              />
              <line
                data-testid="waterline"
                x1="0"
                y1={wl.y1}
                x2="340"
                y2={wl.y2}
                style={{ stroke: 'var(--accent)' }}
                strokeWidth="1.6"
              />
              <path d="M30 128V150M170 128V150M310 128V150" style={{ stroke: 'var(--text2)' }} />
              <text
                x="4"
                y={wl.summerY}
                dy="-4"
                fontSize="8.5"
                style={{ ...MONO, fill: 'var(--warn)' }}
              >
                Summer {h.summerDraftM.toFixed(2)}
              </text>
              {[
                ['FWD', 30],
                ['MID', 170],
                ['AFT', 310],
              ].map(([t, x]) => (
                <text
                  key={t}
                  x={x}
                  y="162"
                  textAnchor="middle"
                  fontSize="9"
                  style={{ ...MONO, fill: 'var(--text2)' }}
                >
                  {t}
                </text>
              ))}
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['Fwd', fwd],
              ['Mid', mean],
              ['Aft', aft],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col gap-px rounded border border-border bg-bg px-2 py-1.5"
              >
                <span className="text-[11px] text-text2">Draft {k}</span>
                <span className="font-mono text-[15px] font-semibold">
                  {(v as number).toFixed(2)}{' '}
                  <span className="text-[11px] font-normal text-text2">m</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dials, trim and hydrostatics */}
        <div className="grid min-w-0 grid-cols-2 grid-rows-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="self-start text-[12px] font-semibold">GM</span>
            <svg
              width="100%"
              viewBox="0 0 200 112"
              role="img"
              aria-label={`GM ${gm.toFixed(2)} metres, minimum ${L.gmMinM.toFixed(2)}`}
            >
              <path
                d={gmD.red}
                fill="none"
                style={{ stroke: 'var(--err)' }}
                strokeWidth="10"
                opacity="0.7"
              />
              <path
                d={gmD.ok}
                fill="none"
                style={{ stroke: 'var(--ok)' }}
                strokeWidth="10"
                opacity="0.55"
              />
              <line
                x1={gmD.tick.a.x}
                y1={gmD.tick.a.y}
                x2={gmD.tick.b.x}
                y2={gmD.tick.b.y}
                style={{ stroke: 'var(--text)' }}
                strokeWidth="2"
              />
              <line
                x1="100"
                y1="96"
                x2={gmD.needle.x}
                y2={gmD.needle.y}
                style={{ stroke: 'var(--text)' }}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="100" cy="96" r="4" style={{ fill: 'var(--text)' }} />
              <text
                x="20"
                y="110"
                fontSize="9"
                textAnchor="middle"
                style={{ ...MONO, fill: 'var(--text3)' }}
              >
                0
              </text>
              <text
                x="180"
                y="110"
                fontSize="9"
                textAnchor="middle"
                style={{ ...MONO, fill: 'var(--text3)' }}
              >
                3.0
              </text>
            </svg>
            <span className="font-mono text-[18px] font-semibold">{gm.toFixed(2)} m</span>
            <Status s={status.gm} />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="self-start text-[12px] font-semibold">List</span>
            <svg
              width="100%"
              viewBox="0 0 200 112"
              role="img"
              aria-label={`List ${Math.abs(list).toFixed(1)} degrees ${list >= 0 ? 'to port' : 'to starboard'}`}
            >
              <path
                d={listD.warnL}
                fill="none"
                style={{ stroke: 'var(--warn)' }}
                strokeWidth="10"
                opacity="0.5"
              />
              <path
                d={listD.warnR}
                fill="none"
                style={{ stroke: 'var(--warn)' }}
                strokeWidth="10"
                opacity="0.5"
              />
              <path
                d={listD.errL}
                fill="none"
                style={{ stroke: 'var(--err)' }}
                strokeWidth="10"
                opacity="0.75"
              />
              <path
                d={listD.errR}
                fill="none"
                style={{ stroke: 'var(--err)' }}
                strokeWidth="10"
                opacity="0.75"
              />
              <path
                d={listD.ok}
                fill="none"
                style={{ stroke: 'var(--ok)' }}
                strokeWidth="10"
                opacity="0.6"
              />
              <line
                x1="100"
                y1="96"
                x2={listD.needle.x}
                y2={listD.needle.y}
                style={{ stroke: 'var(--text)' }}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="100" cy="96" r="4" style={{ fill: 'var(--text)' }} />
              <text
                x="20"
                y="110"
                fontSize="9"
                textAnchor="middle"
                style={{ ...MONO, fill: 'var(--text3)' }}
              >
                5° P
              </text>
              <text
                x="180"
                y="110"
                fontSize="9"
                textAnchor="middle"
                style={{ ...MONO, fill: 'var(--text3)' }}
              >
                5° S
              </text>
            </svg>
            <span className="font-mono text-[18px] font-semibold">
              {Math.abs(list).toFixed(1)}°{' '}
              <span className="text-[12px] font-normal text-text2">
                {list >= 0 ? 'to port' : 'to starboard'}
              </span>
            </span>
            <Status s={status.list} />
          </div>
          <div className="col-span-2 flex flex-col gap-[5px]">
            <div className="flex items-baseline gap-2 text-[12px]">
              <span className="font-semibold">Trim</span>
              <span className="font-mono font-semibold">{trimText(trim)}</span>
              <div className="flex-1" />
              <Status s={status.trim} />
            </div>
            <div className="relative h-2 rounded-[2px] bg-track">
              <span
                className="absolute top-0 bottom-0 bg-ok opacity-30"
                style={{ left: `${bar.okLeft}%`, right: `${bar.okRight}%` }}
              />
              <span className="absolute -top-[3px] -bottom-[3px] left-1/2 w-px bg-text3" />
              <span
                className="absolute -top-1 -bottom-1 -ml-[1.5px] w-[3px] rounded-[1px] bg-text"
                style={{ left: `${bar.mark}%` }}
              />
            </div>
            <div
              aria-hidden="true"
              className="flex justify-between font-mono text-[10px] text-text3"
            >
              <span>{L.trimLimitM.toFixed(1)} head</span>
              <span>0</span>
              <span>{L.trimLimitM.toFixed(1)} stern</span>
            </div>
          </div>
          <dl className="col-span-2 m-0 grid grid-cols-[repeat(3,auto_minmax(0,1fr))] content-end gap-x-2 gap-y-1 text-[11.5px]">
            {hydro.map((x) => (
              <div key={x.label} className="contents">
                <dt className="text-text2">{x.label}</dt>
                <dd className="m-0 text-right font-mono">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
