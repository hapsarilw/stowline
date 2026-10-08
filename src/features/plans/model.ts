import type { GaugeWord, PlanSummary } from '@/api/types';

// What the plans list shows, worked out from the summaries (FR-01 to FR-03). Pure.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The wall clock in UTC+8, the planning desk's time zone, for any ISO time. */
function wall(iso: string): Date {
  return new Date(Date.parse(iso) + 8 * 3_600_000);
}

/** "08 Oct 22:00" */
export function formatEtd(iso: string): string {
  const d = wall(iso);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** The design's "today": its clock reads 7 Oct 2026 (the last check at 14:32:08). */
export const REFERENCE_DAY = '2026-10-07';

/** "Tomorrow", "in 3 days": the days from the reference day to the departure. */
export function dueText(etd: string, today = REFERENCE_DAY): { text: string; soon: boolean } {
  const day = (iso: string) => Math.floor(wall(iso).getTime() / 86_400_000);
  const n = day(etd) - Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  if (n === 0) return { text: 'Today', soon: true };
  if (n === 1) return { text: 'Tomorrow', soon: true };
  if (n < 0) return { text: `${-n} ${-n === 1 ? 'day' : 'days'} ago`, soon: false };
  return { text: `in ${n} days`, soon: false };
}

/** "2 min", "1 h", "Yesterday", "2 d", or a dash for a plan nobody touched. */
export function updatedText(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h`;
  if (min < 48 * 60) return 'Yesterday';
  return `${Math.round(min / (24 * 60))} d`;
}

export const initials = (planner: string | null): string =>
  planner
    ? planner
        .split(' ')
        .map((x) => x[0])
        .join('')
    : '—';

export function violationsText(p: Pick<PlanSummary, 'errors' | 'warnings'>): {
  text: string;
  tone: 'error' | 'warning' | 'ok';
} {
  if (p.errors + p.warnings === 0) return { text: 'Clear', tone: 'ok' };
  if (p.errors)
    return { text: `${p.errors} err${p.warnings ? ` · ${p.warnings} w` : ''}`, tone: 'error' };
  return { text: `${p.warnings} warn`, tone: 'warning' };
}

export const percent = (p: Pick<PlanSummary, 'planned' | 'total'>): number =>
  p.total === 0 ? 0 : Math.round((p.planned / p.total) * 100);

export const STATE_TEXT: Record<GaugeWord, 'OK' | 'Check' | 'Limit'> = {
  ok: 'OK',
  check: 'Check',
  limit: 'Limit',
};

/** "1.84 m", "0.62 m S", "0.4° P": the stability readings as the preview prints them. */
export function stabilityCards(
  s: PlanSummary['preview']['stability'],
): { k: string; v: string; state: GaugeWord }[] {
  const side = (n: number, pos: string, neg: string) => (n >= 0 ? pos : neg);
  return [
    { k: 'GM', v: `${s.gm.toFixed(2)} m`, state: s.gmState },
    {
      k: 'Trim',
      v: `${Math.abs(s.trim).toFixed(2)} m ${side(s.trim, 'S', 'H')}`,
      state: s.trimState,
    },
    {
      k: 'List',
      v: `${Math.abs(s.list).toFixed(1)}° ${side(s.list, 'P', 'S')}`,
      state: s.listState,
    },
  ];
}

/** "14:32" for a time on the day of the newest entry, a weekday for an earlier one. */
export function activityTime(iso: string, newest: string): string {
  const a = wall(iso);
  const b = wall(newest);
  const same =
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
  return same ? `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}` : WEEKDAYS[a.getUTCDay()]!;
}
