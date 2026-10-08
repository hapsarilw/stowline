import type { SlotKey } from '@/domain';

// The lazy 3D scene registers how to find the drop target under a point on screen, so a drag
// that starts in the load list or the bay view can end on a 3D target (FR-32). Kept out of the
// scene chunk so the drag code does not load three.js.

type Picker = (clientX: number, clientY: number) => SlotKey | null;

let picker: Picker | null = null;

export function setDropPicker(p: Picker | null): void {
  picker = p;
}

/** The 3D target under a point, or null when there is none or the scene is not loaded. */
export function pickDropTarget(clientX: number, clientY: number): SlotKey | null {
  return picker ? picker(clientX, clientY) : null;
}

/** Marks the element the 3D canvas sits in, for hit testing a drag. */
export const VIEWPORT_ATTR = 'data-viewport3d';
