import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3 } from 'three';
import { bay40Of, parseKey, PODS, fmt1, type SlotKey } from '@/domain';
import { dispatch, usePlacementStore } from '@/state/placement-store';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { setDropPicker } from '../bridge';
import type { ContainerLayer } from './ContainerLayer';
import type { TargetLayer } from './targets';

// Hover and click (FR-22) without React renders: pointer moves are kept in a variable, one
// raycast runs per animation frame, and the tooltip DOM is filled directly.

export interface TooltipInfo {
  id: string;
  line: string;
  pod: string;
  podCode: string;
  podName: string;
  violation: string;
}

/** What the tooltip says about the container in a slot. */
export function tooltipInfo(key: SlotKey): TooltipInfo | null {
  const { state, ctx, violationIndex } = usePlanStore.getState();
  const p = state.placements.get(key);
  const c = p ? ctx.containers.get(p.containerId) : undefined;
  if (!c) return null;
  const pod = PODS[c.pod as keyof typeof PODS];
  return {
    id: c.id,
    line: `${key} · ${c.type} · ${fmt1(c.weightT)} t`,
    pod: pod?.short ?? c.pod,
    podCode: c.pod,
    podName: pod?.name ?? c.pod,
    violation: violationIndex.bySlot.get(key)?.message ?? '',
  };
}

/** Fills and places the tooltip element, or hides it. */
export function showTooltip(
  el: HTMLElement | null,
  info: TooltipInfo | null,
  x: number,
  y: number,
): void {
  if (!el) return;
  if (!info) {
    el.hidden = true;
    return;
  }
  const set = (field: string, text: string) => {
    const node = el.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (node) node.textContent = text;
  };
  set('id', info.id);
  set('line', info.line);
  set('pod', info.pod);
  set('podName', info.podName);
  set('violation', info.violation);
  const badge = el.querySelector<HTMLElement>('[data-field="pod"]');
  if (badge) badge.style.background = `var(--pod-${info.podCode.toLowerCase()})`;
  const v = el.querySelector<HTMLElement>('[data-field="violation"]');
  if (v) v.hidden = info.violation === '';
  const parent = el.parentElement?.getBoundingClientRect();
  const maxX = (parent?.width ?? 800) - 236;
  const maxY = (parent?.height ?? 400) - 110;
  el.style.transform = `translate(${Math.min(x, maxX) + 14}px, ${Math.min(y, maxY) + 14}px)`;
  el.hidden = false;
}

declare global {
  interface Window {
    /** Dev builds only: lets end-to-end tests find a container on screen. */
    __stowViewport?: {
      findPickable: () => { key: SlotKey; id: string; x: number; y: number } | null;
      /** A point on screen where a drop target is drawn and picks back to itself. */
      findTarget: (key: SlotKey) => { x: number; y: number } | null;
      /** How many frames the scene has drawn. It stops rising when the scene is at rest. */
      frames: () => number;
    };
  }
}

/** Frames drawn, for the dev test hook. The scene renders on demand, so a still count is rest. */
let framesDrawn = 0;

/** A pointer up within this many pixels of the pointer down is a click, not an orbit. */
const CLICK_SLOP = 4;

export function Picking({
  layer,
  targets,
  tooltip,
}: {
  layer: ContainerLayer;
  targets: TargetLayer;
  tooltip: React.RefObject<HTMLDivElement | null>;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    if (import.meta.env.DEV) framesDrawn++;
  });

  useEffect(() => {
    const el = gl.domElement;
    const ray = new Raycaster();
    const ndc = new Vector2();
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let down: { x: number; y: number } | null = null;
    let hovered: SlotKey | null = null;

    const pick = (cx: number, cy: number): SlotKey | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(layer.meshes, false)[0];
      if (!hit || hit.instanceId === undefined) return null;
      return layer.keyAt(hit.object, hit.instanceId) ?? null;
    };

    /** The drop target under a point, while a container is held (FR-32). */
    const pickTarget = (cx: number, cy: number): SlotKey | null => {
      if (targets.visibleCount === 0) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(targets.mesh, false)[0];
      if (!hit || hit.instanceId === undefined) return null;
      return targets.keyAt(hit.object, hit.instanceId) ?? null;
    };
    setDropPicker(pickTarget);

    const hover = (key: SlotKey | null, cx = 0, cy = 0) => {
      if (key !== hovered) {
        hovered = key;
        layer.setHover(key);
        el.style.cursor = key ? 'pointer' : 'grab';
        invalidate();
      }
      const r = el.getBoundingClientRect();
      showTooltip(tooltip.current, key ? tooltipInfo(key) : null, cx - r.left, cy - r.top);
    };

    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 0) {
        if (hovered) hover(null);
        return;
      }
      pointer = { x: e.clientX, y: e.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pointer) hover(pick(pointer.x, pointer.y), pointer.x, pointer.y);
      });
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > CLICK_SLOP) return;
      // A click while a container is in hand places it on a target; while swapping, it picks
      // the other container. The same events as the bay grid.
      const placement = usePlacementStore.getState().placement;
      if (placement.kind === 'holding' || placement.kind === 'over') {
        const target = pickTarget(e.clientX, e.clientY);
        if (target) dispatch({ type: 'drop', key: target });
        return;
      }
      const key = pick(e.clientX, e.clientY);
      if (!key) return;
      if (placement.kind === 'swapping') {
        dispatch({ type: 'chooseSwap', key });
        return;
      }
      const view = useViewStore.getState();
      view.select(key, { bay: bay40Of(parseKey(key).bay) });
      view.setRightTab('inspector');
    };
    const onLeave = () => {
      pointer = null;
      hover(null);
    };

    if (import.meta.env.DEV) {
      // The first deck container whose top face, on screen, picks back to itself.
      window.__stowViewport = {
        frames: () => framesDrawn,
        findTarget: (key) => {
          const r = el.getBoundingClientRect();
          const box = targets.boxOf(key);
          if (!box) return null;
          const v = new Vector3();
          // Targets can overlap on screen: sample the box until a point picks back to it.
          for (const dy of [0.45, 0, -0.3])
            for (const dx of [0, -0.35, 0.35])
              for (const dz of [0, -0.35, 0.35]) {
                v.set(
                  box.center.x + box.size.x * dx,
                  box.center.y + box.size.y * dy,
                  box.center.z + box.size.z * dz,
                ).project(camera);
                const x = r.left + ((v.x + 1) / 2) * r.width;
                const y = r.top + ((1 - v.y) / 2) * r.height;
                if (pickTarget(x, y) === key) return { x, y };
              }
          return null;
        },
        findPickable: () => {
          const r = el.getBoundingClientRect();
          const { state, ctx } = usePlanStore.getState();
          const v = new Vector3();
          for (const key of [...state.placements.keys()].sort().reverse()) {
            if (+key.slice(4, 6) < 82) continue;
            const box = layer.boxOf(key);
            if (!box) continue;
            v.copy(box.center)
              .setY(box.center.y + box.size.y * 0.45)
              .project(camera);
            const x = r.left + ((v.x + 1) / 2) * r.width;
            const y = r.top + ((1 - v.y) / 2) * r.height;
            if (x < r.left + 40 || x > r.right - 40 || y < r.top + 60 || y > r.bottom - 40)
              continue;
            if (pick(x, y) === key) {
              const id = ctx.containers.get(state.placements.get(key)!.containerId)!.id;
              return { key, id, x, y };
            }
          }
          return null;
        },
      };
    }

    el.style.cursor = 'grab';
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      setDropPicker(null);
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [gl, camera, invalidate, layer, targets, tooltip]);

  return null;
}
