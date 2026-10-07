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

export interface Toast {
  kind: ToastKind;
  title: string;
  message?: string;
  undo?: boolean;
}

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
  /** seq changes on every request, so asking for the same preset again moves the camera back. */
  camera: { preset: CameraPreset; seq: number };
  hullTransparent: boolean;
  onlyPod: string | null;
  /** Containers shown at full color, every other one dimmed. Show uses it (FR-43). */
  highlight: readonly SlotKey[] | null;
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
  setColorMode: (mode: ColorMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  toggleHull: () => void;
  setOnlyPod: (pod: string | null) => void;
  setHighlight: (keys: readonly SlotKey[] | null) => void;
}

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
    camera: { preset: 'iso', seq: 0 },
    hullTransparent: true,
    onlyPod: null,
    highlight: null,
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
  setCenterTab: (centerTab) => set({ centerTab }),
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
    toastTimer = setTimeout(() => set({ toast: null }), 5200);
  },
  dismissToast() {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  setColorMode: (colorMode) => set({ colorMode }),
  setCameraPreset: (preset) => set((s) => ({ camera: { preset, seq: s.camera.seq + 1 } })),
  toggleHull: () => set((s) => ({ hullTransparent: !s.hullTransparent })),
  setOnlyPod: (onlyPod) => set({ onlyPod }),
  setHighlight: (highlight) => set({ highlight }),
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
