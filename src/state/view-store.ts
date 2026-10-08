import { create } from 'zustand';
import { slotKeyFor, type Half, type SlotKey } from '@/domain';
import { defaultQuery, type ListQuery } from '@/features/load-list/query';
import type { CameraPreset } from '@/features/viewport3d/camera';
import type { ColorMode } from '@/features/viewport3d/colors';
import { usePlanStore } from './plan-store';

export type Theme = 'dark' | 'light';
export type CenterTab = '3d' | 'bay' | 'split';
export type RightTab = 'inspector' | 'violations';
export type ToastKind = 'ok' | 'info' | 'warn' | 'err';
export type SeverityFilter = 'all' | 'error' | 'warning';

/** Port playback (FR-56): the stop shown, 0 for the departure, and whether Play is on. */
export interface Playback {
  port: number;
  playing: boolean;
}

export interface Toast {
  kind: ToastKind;
  title: string;
  message?: string;
  undo?: boolean;
  /** One more button, such as Export on "Approved" or Discard on "Unsaved changes restored". */
  action?: { label: string; run: () => void };
}

/** A toast goes after 5 s, unless the pointer or the focus is on it (design 16). */
export const TOAST_MS = 5000;

const THEME_KEY = 'stowline.theme';

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // Storage can be blocked. The default theme is dark.
  }
  return 'dark';
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not fatal: the choice just does not persist.
  }
}

export interface ViewStore {
  theme: Theme;
  leftOpen: boolean;
  rightOpen: boolean;
  /** The side panels before the Bay tab collapsed them (screen 03), to restore on leaving. */
  panelsBeforeBay: { left: boolean; right: boolean } | null;
  rightTab: RightTab;
  centerTab: CenterTab;
  /** Share of the center taken by the 3D view in Split. */
  splitRatio: number;
  /** The 40ft bay shown in the bay view. */
  bay: number;
  /** Which slots the bay view shows: whole 40ft slots, or the fore or aft 20ft halves (D1). */
  half: Half;
  selected: SlotKey | null;
  focus: SlotKey | null;
  query: ListQuery;
  /** Load list rows ticked for placement. */
  checked: Readonly<Record<string, true>>;
  announcement: string;
  toast: Toast | null;
  /** 3D view: color mode (FR-20), last camera preset asked for (FR-19), hull and POD filter (FR-21). */
  colorMode: ColorMode;
  /**
   * seq changes on every request, so asking for the same preset again moves the camera back.
   * With a bay, the camera looks at that bay instead (Show, FR-43).
   */
  camera: { preset: CameraPreset; seq: number; bay: number | null };
  hullTransparent: boolean;
  onlyPod: string | null;
  /** Containers shown at full color, every other one dimmed. Show uses it (FR-43). */
  highlight: readonly SlotKey[] | null;
  /** Bumped to ask the bay grid to take the keyboard focus (FR-17). */
  gridFocusSeq: number;
  /** Violations panel: severity filter and the violation in focus (FR-42, FR-43). */
  severity: SeverityFilter;
  focusedViolation: string | null;
  /** The stability drawer (FR-53). */
  drawerOpen: boolean;
  playback: Playback | null;
  /** The center tab before playback switched to 3D, to go back to. */
  tabBeforePlayback: CenterTab | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftOpen: (open: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setCenterTab: (tab: CenterTab) => void;
  setSplitRatio: (ratio: number) => void;
  setBay: (bay: number, focus?: SlotKey | null) => void;
  setHalf: (half: Half) => void;
  select: (key: SlotKey | null, options?: { bay?: number }) => void;
  setFocus: (key: SlotKey, options?: { select?: boolean; announce?: string }) => void;
  setQuery: (patch: Partial<ListQuery>) => void;
  toggleChecked: (id: string) => void;
  announce: (text: string) => void;
  showToast: (toast: Toast) => void;
  dismissToast: () => void;
  /** Pauses the timer of the toast while it is hovered or focused, and restarts it after. */
  holdToast: (held: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  toggleHull: () => void;
  setOnlyPod: (pod: string | null) => void;
  setHighlight: (keys: readonly SlotKey[] | null) => void;
  requestGridFocus: () => void;
  setSeverity: (severity: SeverityFilter) => void;
  /** Focus on a violation: select it, dim the rest, move the camera to its bay. */
  focusViolation: (v: {
    id: string;
    bay: number;
    slot: SlotKey;
    slotKeys: readonly SlotKey[];
  }) => void;
  clearViolationFocus: () => void;
  setDrawerOpen: (open: boolean) => void;
  openPlayback: () => void;
  closePlayback: () => void;
  setPlaybackPort: (port: number) => void;
  setPlaying: (playing: boolean) => void;
}

/** The last stop of the port timeline: the departure and four ports. */
export const LAST_STOP = 4;

export const SPLIT_MIN = 0.25;
export const SPLIT_MAX = 0.8;
export const SPLIT_DEFAULT = 0.6;

/** The design opens on bay 18 with NSPU 482913 5 selected and three rows ticked. */
export const INITIAL_SELECTION: SlotKey = '180486';

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** The design opens with three unplanned rows ticked: the 4th to 6th in list order. */
function designChecked(): string[] {
  const { loadList, state } = usePlanStore.getState();
  return loadList
    .filter((c) => !state.slotOf.has(c.id))
    .slice(3, 6)
    .map((c) => c.id);
}

export function initialView(
  checked: readonly string[] = designChecked(),
): Omit<ViewStore, keyof ViewActions> {
  return {
    theme: readStoredTheme(),
    leftOpen: true,
    rightOpen: true,
    panelsBeforeBay: null,
    rightTab: 'inspector',
    centerTab: 'split',
    splitRatio: SPLIT_DEFAULT,
    bay: 18,
    half: 'both',
    selected: INITIAL_SELECTION,
    focus: INITIAL_SELECTION,
    query: defaultQuery(),
    checked: Object.fromEntries(checked.map((id) => [id, true as const])),
    announcement: '',
    toast: null,
    colorMode: 'pod',
    camera: { preset: 'iso', seq: 0, bay: null },
    hullTransparent: true,
    onlyPod: null,
    highlight: null,
    gridFocusSeq: 0,
    severity: 'all',
    focusedViolation: null,
    drawerOpen: false,
    playback: null,
    tabBeforePlayback: null,
  };
}

type ViewActions = {
  [
    K in keyof ViewStore as ViewStore[K] extends (...args: never[]) => unknown ? K : never
  ]: ViewStore[K];
};

export const useViewStore = create<ViewStore>()((set, get) => ({
  ...initialView(),
  setTheme(theme) {
    storeTheme(theme);
    set({ theme });
  },
  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setRightTab: (rightTab) => set({ rightTab }),
  setCenterTab(centerTab) {
    const s = get();
    if (centerTab === s.centerTab) return;
    // Screen 03: the Bay tab collapses both side panels to rails, so the bay gets the full width.
    if (centerTab === 'bay') {
      set({
        centerTab,
        leftOpen: false,
        rightOpen: false,
        panelsBeforeBay: { left: s.leftOpen, right: s.rightOpen },
      });
      return;
    }
    // Leaving it restores them, unless a panel was opened meanwhile.
    const before = s.centerTab === 'bay' ? s.panelsBeforeBay : null;
    if (before && !s.leftOpen && !s.rightOpen) {
      set({ centerTab, leftOpen: before.left, rightOpen: before.right, panelsBeforeBay: null });
    } else set({ centerTab, panelsBeforeBay: null });
  },
  setSplitRatio: (r) => set({ splitRatio: Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, r)) }),
  setBay: (bay, focus = null) => set({ bay, focus }),
  setHalf(half) {
    const { focus, half: old } = get();
    if (half === old) return;
    // Keep the focus on the same row and tier, in the same bay, in the new view.
    const next = focus ? convertHalf(focus, half) : null;
    set({ half, focus: next });
  },
  select(key, options) {
    set((s) => ({
      selected: key,
      ...(options?.bay !== undefined ? { bay: options.bay } : {}),
      focus: key ?? s.focus,
    }));
  },
  setFocus(key, options) {
    set((s) => ({
      focus: key,
      selected: options?.select ? key : s.selected,
      announcement: options?.announce ?? s.announcement,
    }));
  },
  setQuery: (patch) => set((s) => ({ query: { ...s.query, ...patch } })),
  toggleChecked(id) {
    set((s) => {
      const next = { ...s.checked };
      if (next[id]) delete next[id];
      else next[id] = true;
      return { checked: next };
    });
  },
  announce: (announcement) => set({ announcement }),
  showToast(toast) {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },
  holdToast(held) {
    clearTimeout(toastTimer);
    if (!held && get().toast) toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },
  dismissToast() {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  setColorMode: (colorMode) => set({ colorMode }),
  setCameraPreset: (preset) =>
    set((s) => ({ camera: { preset, seq: s.camera.seq + 1, bay: null } })),
  toggleHull: () => set((s) => ({ hullTransparent: !s.hullTransparent })),
  setOnlyPod: (onlyPod) => set({ onlyPod }),
  setHighlight: (highlight) => set({ highlight }),
  requestGridFocus: () => set((s) => ({ gridFocusSeq: s.gridFocusSeq + 1 })),
  setSeverity: (severity) => set({ severity }),
  focusViolation(v) {
    // Show needs the 3D view and the bay grid (design 04).
    if (get().centerTab === 'bay') get().setCenterTab('split');
    const s = get();
    set({
      focusedViolation: v.id,
      bay: v.bay,
      selected: v.slot,
      focus: v.slot,
      highlight: [...v.slotKeys],
      rightTab: 'violations',
      rightOpen: true,
      camera: { ...s.camera, seq: s.camera.seq + 1, bay: v.bay },
    });
  },
  clearViolationFocus() {
    const s = get();
    if (!s.focusedViolation && !s.highlight) return;
    set({
      focusedViolation: null,
      highlight: null,
      camera: { ...s.camera, seq: s.camera.seq + 1, bay: null },
    });
  },
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  openPlayback() {
    const s = get();
    if (s.playback) return;
    // Playback runs in the 3D view (design 06), with any violation focus cleared.
    s.setCenterTab('3d');
    set({
      playback: { port: 1, playing: true },
      tabBeforePlayback: s.centerTab,
      focusedViolation: null,
      highlight: null,
    });
  },
  closePlayback() {
    const s = get();
    if (!s.playback) return;
    set({ playback: null, tabBeforePlayback: null });
    if (s.tabBeforePlayback) s.setCenterTab(s.tabBeforePlayback);
  },
  setPlaybackPort(port) {
    const p = get().playback;
    if (!p) return;
    set({ playback: { ...p, port: Math.max(0, Math.min(LAST_STOP, port)) } });
  },
  setPlaying(playing) {
    const p = get().playback;
    if (!p) return;
    // Play at the last stop starts again from the first port.
    const port = playing && p.port >= LAST_STOP ? 1 : p.port;
    set({ playback: { port, playing } });
  },
}));

/** The key of the same row and tier in another view of the same 40ft bay. */
function convertHalf(key: SlotKey, half: Half): SlotKey {
  const bay = +key.slice(0, 2);
  const bay40 = bay % 2 === 0 ? bay : bay % 4 === 1 ? bay + 1 : bay - 1;
  return slotKeyFor(bay40, +key.slice(2, 4), +key.slice(4, 6), half);
}

export function resetViewStore(checked?: readonly string[]): void {
  clearTimeout(toastTimer);
  useViewStore.setState(initialView(checked));
}
