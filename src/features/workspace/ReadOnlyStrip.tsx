import { useReadOnlyStrip } from '@/state/edit-gate';
import { useSessionStore } from '@/state/session-store';
import { revise } from '@/state/workflow';
import { Button } from '@/ui/Button';
import { IconLock } from '@/ui/icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** "07 Oct 2026 16:05" in UTC+8, the planning desk's clock. */
function stamp(iso: string): string {
  const d = new Date(Date.parse(iso) + 8 * 3_600_000);
  return `${two(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/**
 * Under the top bar while the plan cannot be changed (design 11): why, who decided, and the
 * way out: Revise for an approved plan, Switch role for a role that only reads.
 */
export function ReadOnlyStrip() {
  const strip = useReadOnlyStrip();
  if (!strip) return null;
  return (
    <div
      role="note"
      aria-label="Read only"
      className="col-span-full flex min-h-9 items-center gap-2.5 border-b border-border bg-raised px-3 text-[12.5px]"
    >
      <span className="grid text-text2">
        <IconLock size={14} strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1 truncate">{strip.reason}</span>
      {strip.approved ? (
        <span className="flex-none text-[12px] text-text2">
          Approved by {strip.approved.by}
          {strip.approved.at ? ` · ${stamp(strip.approved.at)}` : ''}
        </span>
      ) : strip.roleNote ? (
        <span className="flex-none text-[12px] text-text2">{strip.roleNote}</span>
      ) : null}
      {strip.way === 'revise' ? (
        <Button
          className="h-6 flex-none px-2.5 text-[12px] font-normal"
          onClick={() => void revise()}
        >
          Revise
        </Button>
      ) : strip.way === 'switchRole' ? (
        <Button
          className="h-6 flex-none px-2.5 text-[12px] font-normal"
          onClick={() => useSessionStore.getState().openMenu()}
        >
          Switch role
        </Button>
      ) : null}
    </div>
  );
}
