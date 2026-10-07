import { useMemo } from 'react';
import { PODS, POD_LIST } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { cn } from '@/ui/cn';
import { CAMERA_PRESETS } from './camera';
import { COLOR_MODES, legendFor, type Palette } from './colors';

// The DOM on top of the 3D view: controls, legend, hints and the hover tooltip.
// Colors here are CSS variables, so the legend follows the theme without reading styles.

const CSS_PALETTE: Palette = {
  pods: Object.fromEntries(POD_LIST.map((p) => [p, `var(--pod-${p.toLowerCase()})`])),
  err: 'var(--g-err)',
  warn: 'var(--g-warn)',
  neutral: 'var(--g-neutral)',
  dim: 'var(--g-dim)',
  bg: 'var(--g-bg)',
};

const GROUP =
  'pointer-events-auto flex items-center gap-0.5 rounded border border-border bg-surface p-0.5';
const button = (on: boolean) =>
  cn(
    'h-6 min-w-6 cursor-pointer rounded-[3px] border-0 px-2 text-[12px]',
    // Pressed: the normal text color on the accent background, as the filter chips do. The
    // design's accent text on it is 4.49:1 in the light theme, under WCAG AA (decision, M3).
    on ? 'bg-accentbg text-text' : 'bg-transparent text-text2 hover:text-text',
  );

/** Camera presets (FR-19), color modes (FR-20), hull transparency and "show only" (FR-21). */
export function Toolbar() {
  const { camera, colorMode, hullTransparent, onlyPod } = useViewStore();
  const view = useViewStore.getState;
  return (
    <div
      role="toolbar"
      aria-label="3D view controls"
      className="pointer-events-none absolute top-2 right-2 left-2 flex flex-wrap items-center gap-1.5"
    >
      <div role="group" aria-label="Camera" className={GROUP}>
        <span aria-hidden="true" className="px-1.5 text-[11px] text-text3">
          Camera
        </span>
        {CAMERA_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={camera.preset === p.id}
            title={p.title}
            className={button(camera.preset === p.id)}
            onClick={() => view().setCameraPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Color" className={GROUP}>
        <span aria-hidden="true" className="px-1.5 text-[11px] text-text3">
          Color
        </span>
        {COLOR_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={colorMode === m.id}
            className={button(colorMode === m.id)}
            onClick={() => view().setColorMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={hullTransparent}
        title="Hull transparency"
        onClick={() => view().toggleHull()}
        className={cn(
          'pointer-events-auto flex h-[30px] cursor-pointer items-center gap-1.5 rounded border border-border px-2 text-[12px]',
          hullTransparent ? 'bg-accentbg text-text' : 'bg-surface text-text2',
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.5 9.5h13l-2 4h-9z" />
          <path d="M4 9.5V6h8v3.5" strokeDasharray="2 1.5" />
        </svg>
        <span>Hull</span>
        <span className="font-mono text-[11px]">{hullTransparent ? '20%' : 'Solid'}</span>
      </button>
      <label className="pointer-events-auto flex h-[30px] items-center gap-1.5 rounded border border-border bg-surface pr-1 pl-2 text-[12px] text-text2">
        Show only
        <select
          aria-label="Show only containers for port"
          value={onlyPod ?? ''}
          onChange={(e) => view().setOnlyPod(e.target.value || null)}
          className="h-6 rounded-[3px] border border-border2 bg-bg px-1 text-[12px] text-text"
        >
          <option value="">All PODs</option>
          {POD_LIST.map((p) => (
            <option key={p} value={p}>
              {p} · {PODS[p].name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** The legend of the active color mode (FR-20), with counts for POD and violations. */
export function Legend() {
  const mode = useViewStore((s) => s.colorMode);
  const state = usePlanStore((s) => s.state);
  const ctx = usePlanStore((s) => s.ctx);
  const violations = usePlanStore((s) => s.violations);
  const legend = useMemo(() => {
    const pods: Record<string, number> = {};
    for (const p of state.placements.values()) {
      const pod = ctx.containers.get(p.containerId)?.pod;
      if (pod) pods[pod] = (pods[pod] ?? 0) + 1;
    }
    const errors = violations.filter((v) => v.severity === 'error').length;
    return legendFor(mode, { pods, errors, warnings: violations.length - errors }, CSS_PALETTE);
  }, [mode, state, ctx, violations]);

  return (
    <div
      role="group"
      aria-label={`Legend: ${legend.title}`}
      className="absolute bottom-2 left-2 flex max-w-[calc(100%-16px)] flex-wrap items-center gap-2.5 rounded border border-border bg-surface px-2 py-[5px] text-[11.5px]"
    >
      <span className="text-[11px] text-text3">{legend.title}</span>
      {legend.items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-[5px]">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[2px]"
            style={{ background: i.color }}
          />
          <span className="font-mono">{i.label}</span>
          {i.count ? <span className="font-mono text-text3">{i.count}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function Hints() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-2 bottom-2 flex gap-2.5 text-[11px] text-text3"
    >
      <span>Drag to orbit</span>
      <span>Scroll to zoom</span>
      <span>Click to inspect</span>
    </div>
  );
}

/**
 * The hover tooltip (FR-22). Filled and moved by Picking without React renders. Hidden from
 * screen readers: the bay grid gives the same facts with the keyboard.
 */
export function TooltipBox({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      hidden
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-[4] flex min-w-[200px] flex-col gap-1 rounded border border-border2 bg-raised px-2.5 py-2"
    >
      <span data-field="id" className="font-mono text-[12.5px] font-semibold" />
      <span data-field="line" className="font-mono text-[11.5px] text-text2" />
      <span className="flex items-center gap-1.5">
        <span
          data-field="pod"
          className="inline-flex h-[18px] items-center rounded-[3px] px-[5px] font-mono text-[11px] font-semibold text-[#0b1220]"
        />
        <span data-field="podName" className="text-[11.5px] text-text2" />
      </span>
      <span data-field="violation" className="max-w-[240px] text-[11.5px] text-pretty text-err" />
    </div>
  );
}
