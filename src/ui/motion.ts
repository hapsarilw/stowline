// Motion from the design notes (screen 02), and its reduced form (FR-66): with reduced motion
// every animation is an instant change or a 100 ms fade.

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A refused drop: the slot shakes once in 220 ms (stw-shake). */
export const SHAKE: { frames: Keyframe[]; options: KeyframeAnimationOptions } = {
  frames: [
    { transform: 'translateX(0)', offset: 0 },
    { transform: 'translateX(-3px)', offset: 0.2 },
    { transform: 'translateX(3px)', offset: 0.4 },
    { transform: 'translateX(-2px)', offset: 0.6 },
    { transform: 'translateX(2px)', offset: 0.8 },
    { transform: 'translateX(0)', offset: 1 },
  ],
  options: { duration: 220 },
};

/** A valid drop: the container settles into the slot in 180 ms, ease-out (stw-settle). */
export const SETTLE: { frames: Keyframe[]; options: KeyframeAnimationOptions } = {
  frames: [{ transform: 'translateY(-6px) scale(1.06)' }, { transform: 'none' }],
  options: { duration: 180, easing: 'ease-out' },
};

export const FADE_MS = 100;
const FADE: Keyframe[] = [{ opacity: 0.35 }, { opacity: 1 }];

/** Plays an animation on an element, or the 100 ms fade with reduced motion. */
export function play(
  el: Element | null,
  motion: { frames: Keyframe[]; options: KeyframeAnimationOptions },
): Animation | null {
  if (!el || typeof el.animate !== 'function') return null;
  return prefersReducedMotion()
    ? el.animate(FADE, { duration: FADE_MS })
    : el.animate(motion.frames, motion.options);
}
