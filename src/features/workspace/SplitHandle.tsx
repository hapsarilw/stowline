import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { SPLIT_MAX, SPLIT_MIN, useViewStore } from '@/state/view-store';

/** The bar between the 3D view and the bay view. Drag it, or use the arrow keys (FR-08). */
export function SplitHandle({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const ratio = useViewStore((s) => s.splitRatio);
  const drag = useRef(false);
  const set = useViewStore.getState().setSplitRatio;

  const move = (clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || box.height === 0) return;
    set((clientY - box.top) / box.height);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowUp') set(ratio - step);
    else if (e.key === 'ArrowDown') set(ratio + step);
    else if (e.key === 'Home') set(SPLIT_MIN);
    else if (e.key === 'End') set(SPLIT_MAX);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize 3D and bay view"
      aria-valuemin={Math.round(SPLIT_MIN * 100)}
      aria-valuemax={Math.round(SPLIT_MAX * 100)}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e: PointerEvent) => {
        drag.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e: PointerEvent) => drag.current && move(e.clientY)}
      onPointerUp={() => (drag.current = false)}
      onPointerCancel={() => (drag.current = false)}
      // The bar is 6 px as designed. The invisible hit area around it is 24 px (NFR-13).
      className="relative z-10 grid h-1.5 flex-none cursor-row-resize touch-none place-items-center border-y border-border bg-surface before:absolute before:-inset-y-[10px] before:inset-x-0 before:content-['']"
    >
      <span aria-hidden="true" className="h-0.5 w-8 rounded-[1px] bg-border2" />
    </div>
  );
}
