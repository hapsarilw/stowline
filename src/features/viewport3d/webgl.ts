let cached: boolean | undefined;

/** Whether the browser can create a WebGL 2 context. Checked once. */
export function hasWebGL2(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached = canvas.getContext('webgl2') !== null;
  } catch {
    cached = false;
  }
  return cached;
}

/** For tests. */
export function resetWebGLCheck(): void {
  cached = undefined;
}
