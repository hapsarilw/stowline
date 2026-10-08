import { useEffect, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrthographicCamera } from 'three';
import { useViewStore } from '@/state/view-store';
import { prefersReducedMotion } from '@/ui/motion';
import type { ShipBounds } from './hull';
import {
  cameraPose,
  easeInOut,
  fitZoom,
  mixViews,
  PRESETS,
  viewOf,
  type CameraView,
} from './mapping';

// Orbit, pan and zoom, and the five presets with a 600 ms move (FR-19).

export const CAMERA_MOVE_MS = 600;

export { prefersReducedMotion };

export function CameraRig({
  bounds,
  autoRotate = false,
}: {
  bounds: ShipBounds;
  autoRotate?: boolean;
}) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const fly = useRef<{ from: CameraView; to: CameraView; t0: number } | null>(null);
  const lastSize = useRef<{ width: number; height: number } | null>(null);

  const apply = (view: CameraView, w = width, h = height) => {
    const pose = cameraPose(view, w, h, bounds);
    camera.position.copy(pose.position);
    camera.zoom = pose.zoom;
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.target.copy(pose.target);
      const fit = fitZoom(view.yaw, view.pitch, w, h, bounds);
      c.minZoom = fit * 0.6;
      c.maxZoom = fit * 6;
      c.update();
    }
    invalidate();
  };

  const current = (w: number, h: number): CameraView =>
    viewOf(
      camera.position,
      controls.current?.target ?? camera.position.clone().setY(0),
      camera.zoom,
      w,
      h,
      bounds,
    );

  // First size: the preset. Later sizes: the same view, fitted to the new size.
  useEffect(() => {
    if (width === 0 || height === 0) return;
    const prev = lastSize.current;
    if (!prev) apply(PRESETS[useViewStore.getState().camera.preset]);
    else apply(current(prev.width, prev.height));
    lastSize.current = { width, height };
    // apply and current read the latest camera and controls; they are not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(
    () =>
      useViewStore.subscribe((s, prev) => {
        if (s.camera.seq === prev.camera.seq || !lastSize.current) return;
        const to = PRESETS[s.camera.preset];
        if (prefersReducedMotion()) {
          fly.current = null;
          apply(to);
          return;
        }
        fly.current = { from: current(width, height), to, t0: performance.now() };
        invalidate();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );

  useFrame(() => {
    const f = fly.current;
    if (!f) return;
    const t = Math.min(1, (performance.now() - f.t0) / CAMERA_MOVE_MS);
    apply(mixViews(f.from, f.to, easeInOut(t)));
    if (t >= 1) fly.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minPolarAngle={(1 * Math.PI) / 180}
      maxPolarAngle={(88 * Math.PI) / 180}
      autoRotate={autoRotate}
      autoRotateSpeed={6}
      onStart={() => (fly.current = null)}
    />
  );
}
