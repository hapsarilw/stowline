import { useEffect, useRef, useState } from 'react';
import {
  calibrateStability,
  createStowContext,
  createStowState,
  generateBenchCall,
} from '@/domain';
import { resetPlanStore, usePlanStore } from '@/state/plan-store';
import { resetViewStore, useViewStore } from '@/state/view-store';
import type { BenchSink } from '@/features/viewport3d/scene/Scene';
import { Viewport3D } from '@/features/viewport3d/Viewport3D';
import { frameStats } from './stats';

// /bench: the 3D view with a generated 10,000-container vessel, orbiting on its own, with the
// frame rate (NFR-01), frame time and draw calls (NFR-05). Playwright reads window.__stowBench.

export interface BenchReport {
  containers: number;
  renderCpuMs: number;
  gpuMs: number | null;
  fps: number;
  meanMs: number;
  p95Ms: number;
  frames: number;
  calls: number;
  triangles: number;
  renderer: string;
  width: number;
  height: number;
  dpr: number;
}

declare global {
  interface Window {
    __stowBench?: BenchReport & { reset: () => void };
  }
}

/** Frames measured over the last few seconds. */
const WINDOW_FRAMES = 600;

export function BenchPage() {
  const ready = usePlanStore((s) => s.header.id === 'bench');
  const [sink] = useState<BenchSink>(() => ({
    frameTimes: [],
    renderCpuMs: [],
    gpuMs: [],
    calls: 0,
    triangles: 0,
    instances: 0,
    renderer: '',
  }));
  const out = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const call = generateBenchCall();
    const ctx = createStowContext(call);
    const state = createStowState(call.placements);
    usePlanStore.getState().load(
      {
        header: {
          id: 'bench',
          vesselId: call.vessel.id,
          voyage: 'BENCH',
          port: 'SGSIN',
          etd: '2026-10-08T22:00:00+08:00',
          status: 'draft',
          version: 1,
          plannerId: '',
        },
        ctx,
        loadList: [],
        base: calibrateStability(state, ctx),
      },
      state,
    );
    useViewStore.setState({
      bay: call.vessel.bays[11]!.bay,
      selected: null,
      focus: null,
      centerTab: '3d',
    });
    return () => {
      resetPlanStore();
      resetViewStore();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const s = sink;
      const recent = s.frameTimes.slice(-WINDOW_FRAMES);
      const f = frameStats(recent);
      const canvas = document.querySelector('canvas');
      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
      const report: BenchReport = {
        containers: s.instances,
        renderCpuMs: mean(s.renderCpuMs.slice(-WINDOW_FRAMES)),
        gpuMs: s.gpuMs.length ? mean(s.gpuMs.slice(-WINDOW_FRAMES)) : null,
        ...f,
        calls: s.calls,
        triangles: s.triangles,
        renderer: s.renderer,
        width: canvas?.clientWidth ?? 0,
        height: canvas?.clientHeight ?? 0,
        dpr: window.devicePixelRatio,
      };
      const reset = () => {
        s.frameTimes.length = 0;
        s.renderCpuMs.length = 0;
        s.gpuMs.length = 0;
      };
      window.__stowBench = { ...report, reset };
      if (out.current) {
        out.current.textContent = [
          `containers   ${report.containers.toLocaleString('en-US')}`,
          `fps          ${report.fps.toFixed(1)}`,
          `frame time   ${report.meanMs.toFixed(2)} ms mean, ${report.p95Ms.toFixed(2)} ms p95 (last ${report.frames} frames)`,
          `render call  ${report.renderCpuMs.toFixed(2)} ms CPU, ${report.gpuMs === null ? 'GPU time not available' : `${report.gpuMs.toFixed(2)} ms GPU`}`,
          `draw calls   ${report.calls}`,
          `triangles    ${report.triangles.toLocaleString('en-US')}`,
          `canvas       ${report.width} x ${report.height} at ${report.dpr}x`,
          `GPU          ${report.renderer}`,
        ].join('\n');
      }
    }, 500);
    return () => clearInterval(timer);
  }, [ready, sink]);

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-text">
      <header className="flex flex-none items-start gap-6 border-b border-border bg-surface px-3 py-2">
        <h1 className="m-0 text-[14px] font-semibold">3D benchmark · 10,000 containers</h1>
        <pre
          ref={out}
          aria-live="off"
          className="m-0 font-mono text-[11.5px] leading-[1.4] text-text2"
        >
          Measuring…
        </pre>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {ready ? <Viewport3D bench={sink} /> : null}
      </div>
    </div>
  );
}
