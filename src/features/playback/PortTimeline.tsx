import { useEffect, useMemo, type KeyboardEvent } from 'react';
import { portStops } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { LAST_STOP, useViewStore } from '@/state/view-store';
import { cn } from '@/ui/cn';
import { IconNext, IconPause, IconPlay, IconPrevious, IconRestow } from '@/ui/icons';
import { prefersReducedMotion } from '@/ui/motion';
import { buildTimeline, liftDuration, REST_MS } from './model';

// The port timeline over the 3D view (FR-55, FR-56, design 06). The lift itself runs in the 3D
// frame loop; this only moves from port to port while Play is on.

const MEDIA =
  'grid h-[30px] w-[30px] cursor-pointer place-items-center rounded border border-border2 bg-raised text-text';

export function PortTimeline() {
  const playback = useViewStore((s) => s.playback);
  const state = usePlanStore((s) => s.state);
  const ctx = usePlanStore((s) => s.ctx);
  const violations = usePlanStore((s) => s.violations);
  const stops = useMemo(() => portStops(state, ctx, violations), [state, ctx, violations]);
  const port = playback?.port ?? 1;
  const playing = playback?.playing ?? false;
  const t = useMemo(() => buildTimeline(stops, port), [stops, port]);
  const view = useViewStore.getState;
  const count = stops[port]?.discharge ?? 0;

  // Play: after this port's lift and a pause, the next port; Play ends at the last one.
  useEffect(() => {
    if (!playing) return;
    const ms = liftDuration(count, prefersReducedMotion()) + REST_MS;
    const timer = setTimeout(() => {
      if (port < LAST_STOP) view().setPlaybackPort(port + 1);
      else view().setPlaying(false);
    }, ms);
    return () => clearTimeout(timer);
  }, [playing, port, count, view]);

  if (!playback) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    const to = {
      ArrowLeft: port - 1,
      ArrowDown: port - 1,
      ArrowRight: port + 1,
      ArrowUp: port + 1,
      Home: 0,
      End: LAST_STOP,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    view().setPlaybackPort(to);
  };

  return (
    <div
      role="group"
      aria-label="Port timeline"
      className="pointer-events-auto absolute right-2 bottom-2 left-2 z-[3] flex items-center gap-5 rounded border border-border bg-surface py-2.5 pr-5 pl-2.5"
    >
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          aria-label="Previous port"
          className={MEDIA}
          onClick={() => view().setPlaybackPort(Math.max(1, port - 1))}
        >
          <IconPrevious />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-[30px] w-9 cursor-pointer place-items-center rounded border border-accent bg-accent text-onaccent"
          onClick={() => view().setPlaying(!playing)}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          aria-label="Next port"
          className={MEDIA}
          onClick={() => view().setPlaybackPort(port + 1)}
        >
          <IconNext />
        </button>
      </div>

      <div className="relative h-[70px] min-w-0 flex-1 px-[42px]">
        <div className="relative h-full">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Port playback"
            aria-valuemin={0}
            aria-valuemax={LAST_STOP}
            aria-valuenow={port}
            aria-valuetext={t.now}
            onKeyDown={onKeyDown}
            className="absolute inset-x-0 top-[21px] h-3.5 rounded-sm outline-offset-2"
          >
            <div className="absolute inset-x-0 top-1.5 h-0.5 bg-border2" />
            <div
              className="absolute left-0 top-1.5 h-0.5 bg-accent"
              style={{ width: `${t.progress}%` }}
            />
          </div>
          {t.stops.map((s, i) => (
            <button
              key={s.code}
              type="button"
              aria-label={s.label}
              aria-current={s.state === 'current' ? 'step' : undefined}
              onClick={() => view().setPlaybackPort(i)}
              className={cn(
                'absolute top-0 flex min-w-[84px] -translate-x-1/2 cursor-pointer flex-col items-center gap-[3px] border-0 bg-transparent p-0',
                s.state === 'current'
                  ? 'text-text'
                  : s.state === 'past'
                    ? 'text-text2'
                    : 'text-text3',
              )}
              style={{ left: `${s.left}%` }}
            >
              <span className="flex h-4 items-center gap-[5px] font-mono text-[11.5px] font-semibold">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-[1px]"
                  style={{
                    background: i === 0 ? 'var(--text3)' : `var(--pod-${s.code.toLowerCase()})`,
                  }}
                />
                {s.code}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[3px] box-border size-3 rounded-full border-2',
                  s.state === 'current'
                    ? 'border-accent bg-accent'
                    : s.state === 'past'
                      ? 'border-text2 bg-text2'
                      : 'border-border2 bg-surface',
                )}
              />
              <span className="text-[11px] whitespace-nowrap">{s.name}</span>
              <span className="flex h-4 items-center gap-1">
                {s.discharge ? (
                  <span className="font-mono text-[10.5px] text-text2">{s.discharge}</span>
                ) : null}
                {s.restows ? (
                  <span className="inline-flex h-4 items-center gap-[3px] rounded-[2px] bg-warnbg px-1 text-[10.5px] font-semibold text-warn">
                    <IconRestow size={9} strokeWidth={2} />
                    {s.restows}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-[210px] flex-none flex-col gap-0.5 text-[12px]">
        <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
          Now playing
        </span>
        <span aria-live="polite" className="text-pretty">
          {t.now}
        </span>
      </div>
    </div>
  );
}
