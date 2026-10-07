import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-border2 px-1 font-mono text-[10px] leading-4 text-text3">
      {children}
    </kbd>
  );
}
