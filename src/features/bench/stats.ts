/** Summary of recent frame times in milliseconds: frames per second, mean and 95th percentile. */
export function frameStats(times: readonly number[]): {
  fps: number;
  meanMs: number;
  p95Ms: number;
  frames: number;
} {
  if (times.length === 0) return { fps: 0, meanMs: 0, p95Ms: 0, frames: 0 };
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, t) => a + t, 0) / times.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  return { fps: 1000 / mean, meanMs: mean, p95Ms: p95, frames: times.length };
}
