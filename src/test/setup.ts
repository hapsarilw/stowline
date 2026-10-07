import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom does no layout. TanStack Virtual measures its scroll element, so give every
// element a size, and stub the observers and scrolling it calls.
if (typeof window !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 320,
  });
  window.HTMLElement.prototype.scrollTo = () => undefined;
  // jsdom has no WebGL: the 3D view shows its fallback in component tests.
  window.HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
  window.HTMLElement.prototype.setPointerCapture = () => undefined;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
