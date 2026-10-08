import type { Command } from '@/domain';

// Unsaved commands are kept in the browser and restored after a reload (FR-61, NFR-16).

export interface Unsaved {
  baseVersion: number;
  commands: Command[];
}

const key = (planId: string) => `stowline.unsaved.${planId}`;

export function writeUnsaved(planId: string, value: Unsaved | null): void {
  try {
    if (value && value.commands.length > 0)
      localStorage.setItem(key(planId), JSON.stringify(value));
    else localStorage.removeItem(key(planId));
  } catch {
    // Storage can be blocked or full: the work is still on screen, it just cannot be restored.
  }
}

export function readUnsaved(planId: string): Unsaved | null {
  try {
    const raw = localStorage.getItem(key(planId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Unsaved>;
    return typeof v.baseVersion === 'number' && Array.isArray(v.commands)
      ? { baseVersion: v.baseVersion, commands: v.commands }
      : null;
  } catch {
    return null;
  }
}
