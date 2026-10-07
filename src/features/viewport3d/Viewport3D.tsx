// Placeholder for the 3D view, until M3. It shows the loading skeleton from the design.
// M3 replaces it with a lazy-loaded React Three Fiber scene, with this skeleton while it loads
// (FR-25) and the bay view as the fallback (FR-24).
export function Viewport3D() {
  const bars = [18, 30, 38, 38, 34, 56, 26, 14];
  return (
    <section
      aria-label="3D view"
      aria-busy="false"
      className="relative min-h-0 flex-1 overflow-hidden bg-bg"
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
        <div aria-hidden="true" className="flex animate-pulse items-end gap-[3px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className={i === 5 ? 'w-2.5 bg-border2' : 'w-[22px] bg-raised'}
              style={{ height: h }}
            />
          ))}
        </div>
        <span className="text-[12px] text-text2">
          The 3D view is not built yet. The bay view has every action.
        </span>
      </div>
    </section>
  );
}
