import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { FocusBanner } from '@/features/violations/FocusBanner';
import { PortTimeline } from '@/features/playback/PortTimeline';
import { Hints, Legend, Toolbar, TooltipBox } from '../Overlays';
import { Scene, type BenchSink, type SceneLabels } from './Scene';

export interface ViewportSceneProps {
  /** On /bench: draw every frame, orbit on its own and report frame times. */
  bench?: BenchSink;
  /** Called when the WebGL context is lost, so the shell can show the fallback. */
  onLost: () => void;
}

interface TimerQueryExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * On /bench: names the GPU, and times each render call on the CPU and, where the browser has
 * EXT_disjoint_timer_query_webgl2, on the GPU. The display caps the frame rate, so these show
 * how much of a frame the scene actually uses.
 */
function instrument(renderer: WebGLRenderer, sink: BenchSink): void {
  const g = renderer.getContext() as WebGL2RenderingContext;
  const info = g.getExtension('WEBGL_debug_renderer_info');
  sink.renderer = String(
    info ? g.getParameter(info.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER),
  );
  const ext = g.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
  const pending: WebGLQuery[] = [];
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    const query = ext ? g.createQuery() : null;
    if (query && ext) g.beginQuery(ext.TIME_ELAPSED_EXT, query);
    const t0 = performance.now();
    render(scene, camera);
    sink.renderCpuMs.push(performance.now() - t0);
    if (sink.renderCpuMs.length > 2000) sink.renderCpuMs.splice(0, 1000);
    if (query && ext) {
      g.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(query);
    }
    while (
      ext &&
      pending.length > 0 &&
      g.getQueryParameter(pending[0]!, g.QUERY_RESULT_AVAILABLE)
    ) {
      const q = pending.shift()!;
      if (!g.getParameter(ext.GPU_DISJOINT_EXT))
        sink.gpuMs.push(g.getQueryParameter(q, g.QUERY_RESULT) / 1e6);
      g.deleteQuery(q);
      if (sink.gpuMs.length > 2000) sink.gpuMs.splice(0, 1000);
    }
  };
}

/** The 3D view. Loaded on demand, in its own chunk with three.js. */
export default function ViewportScene({ bench, onLost }: ViewportSceneProps) {
  const tooltip = useRef<HTMLDivElement>(null);
  const labels = useRef<SceneLabels>({ bow: null, stern: null, bay: null, bayText: null });
  const labelText =
    'pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] font-medium whitespace-nowrap text-text2 select-none';
  const vessel = usePlanStore((s) => s.ctx.vessel.name);
  const split = useViewStore((s) => s.centerTab === 'split');
  return (
    <div className="absolute inset-0">
      <div
        role="img"
        aria-label={`3D stowage view of ${vessel}. Every action here is also available in the bay grid with the keyboard.`}
        className="absolute inset-0"
        data-testid="viewport-canvas"
      >
        <Canvas
          orthographic
          flat
          frameloop={bench ? 'always' : 'demand'}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ near: 1, far: 5000, position: [0, 300, 800], zoom: 1 }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onLost();
            });
            if (bench) instrument(gl, bench);
          }}
        >
          <Scene tooltip={tooltip} labels={labels} bench={bench} />
        </Canvas>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span
            ref={(el) => void (labels.current.bow = el)}
            hidden
            className="absolute top-0 left-0"
          >
            <span className={labelText}>BOW</span>
          </span>
          <span
            ref={(el) => void (labels.current.stern = el)}
            hidden
            className="absolute top-0 left-0"
          >
            <span className={labelText}>STERN</span>
          </span>
          <span
            ref={(el) => void (labels.current.bay = el)}
            hidden
            className="absolute top-0 left-0"
          >
            <span className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center select-none">
              <span
                ref={(el) => void (labels.current.bayText = el)}
                className="bg-accent px-1.5 py-0.5 font-mono text-[11px] leading-[14px] font-semibold whitespace-nowrap text-onaccent"
              />
              <span className="h-2 w-px bg-accent" />
            </span>
          </span>
        </div>
      </div>
      <Toolbar />
      <FocusBanner />
      <Legend />
      <PortTimeline />
      {split ? <Hints /> : null}
      <TooltipBox ref={tooltip} />
    </div>
  );
}
