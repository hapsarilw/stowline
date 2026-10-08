import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera } from 'three';
import { Vector3 } from 'three';
import { liftOrder, pad, PODS, POD_LIST, type SlotKey } from '@/domain';
import { LIFT_M, liftDuration, liftProgress } from '@/features/playback/model';
import { heldContainer, marksFor } from '@/state/placement';
import { usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { prefersReducedMotion, CameraRig } from './CameraRig';
import { ContainerLayer, type ColorInput } from './ContainerLayer';
import { hullFor, shipBounds } from './hull';
import { easeInOut, gapOffset, sizeClassOf, toScene } from './mapping';
import { Picking } from './Picking';
import { ShipModel } from './ShipModel';
import { TargetLayer } from './targets';
import { onThemeChange, readSceneTheme, type SceneTheme } from './theme';

/** Numbers the /bench route reads (NFR-01, NFR-05). */
export interface BenchSink {
  frameTimes: number[];
  /** CPU time of each render call, and GPU time of each frame where the browser can measure it. */
  renderCpuMs: number[];
  gpuMs: number[];
  calls: number;
  triangles: number;
  instances: number;
  renderer: string;
}

export const GAP_MOVE_MS = 400;

function BenchProbe({ sink, layer }: { sink: BenchSink; layer: ContainerLayer }) {
  const last = useRef(0);
  useFrame(({ gl }) => {
    const now = performance.now();
    if (last.current) sink.frameTimes.push(now - last.current);
    if (sink.frameTimes.length > 2000) sink.frameTimes.splice(0, 1000);
    last.current = now;
    // info is reset at the start of each render, so this is the previous frame.
    sink.calls = gl.info.render.calls;
    sink.triangles = gl.info.render.triangles;
    sink.instances = layer.count;
  });
  return null;
}

/** DOM labels drawn over the canvas: bow, stern and the selected bay (FR-23). */
export interface SceneLabels {
  bow: HTMLElement | null;
  stern: HTMLElement | null;
  bay: HTMLElement | null;
  bayText: HTMLElement | null;
}

const projected = new Vector3();

/** Puts a DOM label on a scene point. Hidden when the point is behind the camera. */
function placeDom(
  el: HTMLElement | null,
  point: Vector3,
  camera: Camera,
  width: number,
  height: number,
): void {
  if (!el) return;
  projected.copy(point).project(camera);
  const x = ((projected.x + 1) / 2) * width;
  const y = ((1 - projected.y) / 2) * height;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  el.hidden = projected.z > 1;
}

export function Scene({
  tooltip,
  labels,
  bench,
}: {
  tooltip: React.RefObject<HTMLDivElement | null>;
  labels: React.RefObject<SceneLabels>;
  bench?: BenchSink;
}) {
  const ctx = usePlanStore((s) => s.ctx);
  const invalidate = useThree((s) => s.invalidate);
  const sections = useMemo(() => hullFor(ctx.vessel), [ctx]);
  const bounds = useMemo(() => shipBounds(sections), [sections]);
  const layer = useMemo(() => new ContainerLayer(ctx), [ctx]);
  const ship = useMemo(() => new ShipModel(sections, ctx.vessel.deckhouseX), [sections, ctx]);
  const targets = useMemo(() => new TargetLayer(ctx), [ctx]);
  const bayPoint = useRef(new Vector3());
  const gapMove = useRef<{ from: Map<number, number>; target: number; t0: number } | null>(null);
  /** The containers of the current port lifting off (FR-56), in lift order. */
  const lift = useRef<{ keys: SlotKey[]; t0: number; shown: Float32Array } | null>(null);

  useEffect(() => () => layer.dispose(), [layer]);
  useEffect(() => () => ship.dispose(), [ship]);
  useEffect(() => () => targets.dispose(), [targets]);

  const placeLabel = () => {
    const bay = useViewStore.getState().bay;
    const b = ctx.geometry.bayByNum(bay);
    if (!b) return;
    toScene(b.x + gapOffset(b.index, layer.gaps), 0, 22, bayPoint.current);
    const text = labels.current.bayText;
    if (text) text.textContent = `BAY ${pad(bay)}`;
  };

  // Store changes go straight into the three.js objects. Nothing here renders React.
  useEffect(() => {
    let theme: SceneTheme = readSceneTheme();
    const colorInput = (): ColorInput => {
      const v = useViewStore.getState();
      return {
        mode: v.colorMode,
        palette: theme,
        onlyPod: v.onlyPod,
        highlight: v.highlight ? new Set(v.highlight) : null,
        violations: usePlanStore.getState().violationIndex,
      };
    };
    const applyTheme = () => {
      targets.setColors({ ok: theme.ok, warn: theme.warn, err: theme.err });
      ship.setTheme(theme);
      layer.setEdge(theme.edge);
      layer.setOutlineColors(theme);
      layer.recolor(colorInput());
    };

    // FR-32, FR-38: targets in the selected bay and the ghost, while a container is held.
    const syncTargets = () => {
      const placement = usePlacementStore.getState().placement;
      const { state } = usePlanStore.getState();
      const held = heldContainer(placement);
      const c = held ? ctx.containers.get(held) : undefined;
      if (!c || placement.kind === 'swapping') {
        targets.update(new Map(), '40', layer.gaps);
        targets.setGhost(null, false, layer.gaps);
        return;
      }
      const marks = marksFor(placement, { state, ctx, bay: useViewStore.getState().bay });
      targets.update(marks, sizeClassOf(c), layer.gaps);
      const over = placement.kind === 'over' && placement.check.target ? placement : null;
      targets.setGhost(over ? over.target : null, over ? over.check.valid : false, layer.gaps);
    };

    const plan = usePlanStore.getState();
    const view = useViewStore.getState();
    layer.recolor(colorInput());
    layer.sync(plan.state);
    applyTheme();
    ship.setTransparent(view.hullTransparent);
    ship.setDrafts(plan.stability.draftFwd, plan.stability.draftAft);
    const start = ctx.geometry.bayByNum(view.bay);
    layer.gaps = new Map(start && !view.playback ? [[start.index, 1]] : []);
    layer.applyGaps();
    layer.setSelected(view.selected);
    layer.setFocus(view.highlight);
    placeLabel();
    syncTargets();
    invalidate();

    // Port playback (FR-56): ports before the stop are gone, the stop's containers lift off.
    // The bay gap closes while it runs, as in design 06.
    const moveGap = (target: number) => {
      if (prefersReducedMotion()) {
        layer.gaps = new Map(target >= 0 ? [[target, 1]] : []);
        layer.applyGaps();
        layer.updateOutlines();
        targets.applyGaps(layer.gaps);
        placeLabel();
      } else gapMove.current = { from: new Map(layer.gaps), target, t0: performance.now() };
    };
    const applyPlayback = (restart: boolean) => {
      const p = useViewStore.getState().playback;
      layer.clearPoses();
      if (!p) {
        lift.current = null;
        return;
      }
      const { state } = usePlanStore.getState();
      for (const [key, pl] of state.placements) {
        const pod = ctx.containers.get(pl.containerId)?.pod as keyof typeof PODS | undefined;
        if (pod && PODS[pod] && PODS[pod].order < p.port) layer.setPose(key, 0, 1);
      }
      const pod = POD_LIST[p.port - 1];
      const keys = pod ? liftOrder(state, ctx, pod) : [];
      if (prefersReducedMotion()) {
        // Removed at once with reduced motion.
        for (const key of keys) layer.setPose(key, 0, 1);
        lift.current = null;
        return;
      }
      const t0 = restart || !lift.current ? performance.now() : lift.current.t0;
      lift.current = { keys, t0, shown: new Float32Array(keys.length) };
    };
    applyPlayback(true);
    invalidate();

    const offPlacement = usePlacementStore.subscribe((s, prev) => {
      if (s.placement === prev.placement) return;
      syncTargets();
      invalidate();
    });

    const offPlan = usePlanStore.subscribe((s, prev) => {
      if (s.state !== prev.state) {
        layer.sync(s.state);
        syncTargets();
        if (useViewStore.getState().playback) applyPlayback(false);
      }
      if (s.violationIndex !== prev.violationIndex) {
        const keys = new Set<SlotKey>([
          ...prev.violationIndex.bySlot.keys(),
          ...s.violationIndex.bySlot.keys(),
        ]);
        layer.recolor(colorInput(), keys);
        layer.reapplyPoses();
      }
      if (s.stability !== prev.stability)
        ship.setDrafts(s.stability.draftFwd, s.stability.draftAft);
      layer.updateOutlines();
      invalidate();
    });

    const offView = useViewStore.subscribe((s, prev) => {
      if (
        s.colorMode !== prev.colorMode ||
        s.onlyPod !== prev.onlyPod ||
        s.highlight !== prev.highlight
      ) {
        layer.recolor(colorInput());
        layer.reapplyPoses();
      }
      if (s.highlight !== prev.highlight) layer.setFocus(s.highlight);
      if (s.selected !== prev.selected) layer.setSelected(s.selected);
      if (s.hullTransparent !== prev.hullTransparent) ship.setTransparent(s.hullTransparent);
      const pb = s.playback;
      const pbPrev = prev.playback;
      if (pb?.port !== pbPrev?.port || (pb === null) !== (pbPrev === null)) applyPlayback(true);
      if ((pb === null) !== (pbPrev === null)) {
        const b = ctx.geometry.bayByNum(s.bay);
        moveGap(pb ? -1 : (b?.index ?? -1));
      }
      if (s.bay !== prev.bay) {
        placeLabel();
        syncTargets();
        const b = ctx.geometry.bayByNum(s.bay);
        if (b && !s.playback) {
          if (prefersReducedMotion()) {
            layer.gaps = new Map([[b.index, 1]]);
            layer.applyGaps();
            layer.updateOutlines();
            targets.applyGaps(layer.gaps);
            placeLabel();
          } else
            gapMove.current = { from: new Map(layer.gaps), target: b.index, t0: performance.now() };
        }
      }
      invalidate();
    });

    const offTheme = onThemeChange(() => {
      theme = readSceneTheme();
      applyTheme();
      layer.reapplyPoses();
      invalidate();
    });

    return () => {
      offPlacement();
      offPlan();
      offView();
      offTheme();
    };
    // placeLabel only reads refs and stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, ship, targets, ctx, invalidate]);

  const bowPoint = useMemo(() => toScene(bounds.maxX + 4, 0, 4), [bounds]);
  const sternPoint = useMemo(() => toScene(bounds.minX + 2, 0, 4), [bounds]);

  // Labels follow the camera. This runs only on frames that render.
  useFrame(({ camera, size }) => {
    const l = labels.current;
    placeDom(l.bow, bowPoint, camera, size.width, size.height);
    placeDom(l.stern, sternPoint, camera, size.width, size.height);
    placeDom(l.bay, bayPoint.current, camera, size.width, size.height);
    // No bay label during playback (design 06).
    if (l.bay && useViewStore.getState().playback) l.bay.hidden = true;
  });

  // The bay gap opens at the selected bay in 400 ms (FR-23), while the old one closes.
  useFrame(() => {
    const m = gapMove.current;
    if (!m) return;
    const t = Math.min(1, (performance.now() - m.t0) / GAP_MOVE_MS);
    const e = easeInOut(t);
    const gaps = new Map<number, number>();
    for (const [k, a] of m.from)
      if (k !== m.target && a * (1 - e) > 0.001) gaps.set(k, a * (1 - e));
    if (m.target >= 0) {
      const start = m.from.get(m.target) ?? 0;
      gaps.set(m.target, start + (1 - start) * e);
    }
    layer.gaps = gaps;
    layer.applyGaps();
    layer.updateOutlines();
    targets.applyGaps(layer.gaps);
    placeLabel();
    if (t < 1) invalidate();
    else gapMove.current = null;
  });

  // The lift (FR-56): each container rises and fades over 500 ms, 20 ms after the one before.
  // Only containers whose progress changed are written.
  useFrame(() => {
    const l = lift.current;
    if (!l) return;
    const elapsed = performance.now() - l.t0;
    l.keys.forEach((key, k) => {
      const p = liftProgress(k, elapsed);
      if (p === l.shown[k]) return;
      l.shown[k] = p;
      layer.setPose(key, LIFT_M * (1 - (1 - p) ** 3), p);
    });
    if (elapsed < liftDuration(l.keys.length, false)) invalidate();
    else lift.current = null;
  });

  return (
    <>
      <primitive object={ship.group} />
      <primitive object={layer.group} />
      <primitive object={targets.group} />
      <CameraRig bounds={bounds} autoRotate={bench !== undefined} />
      <Picking layer={layer} targets={targets} tooltip={tooltip} />
      {bench ? <BenchProbe sink={bench} layer={layer} /> : null}
    </>
  );
}
