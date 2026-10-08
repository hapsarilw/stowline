import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion as reducedMotion } from '@/ui/motion';

/**
 * Counts from the numbers on screen to new numbers over `ms` (FR-52: 300 ms, ease-out).
 * With reduced motion the new numbers show at once (FR-66).
 */
export function useTween(target: readonly number[], ms = 300): number[] {
  const [shown, setShown] = useState<number[]>([...target]);
  const current = useRef<number[]>([...target]);
  const key = target.join('|');

  useEffect(() => {
    const to = key.split('|').map(Number);
    const from = [...current.current];
    if (reducedMotion() || ms <= 0 || to.every((v, i) => v === from[i])) {
      current.current = to;
      setShown(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const next = to.map((v, i) => from[i]! + (v - from[i]!) * e);
      current.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, ms]);

  return shown;
}
