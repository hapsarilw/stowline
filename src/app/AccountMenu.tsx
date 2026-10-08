import { useEffect, useRef, useState } from 'react';
import { ROLES, roleInfo } from '@/domain';
import { useMockControl } from '@/api/mock/control';
import { useSessionStore } from '@/state/session-store';
import { cn } from '@/ui/cn';

// The account menu: who is signed in, the role switcher (FR-62) and the developer switch that
// makes the next save return 409 (SRS "Mock behavior"). Built from the tokens (decision D7).

export function AccountMenu() {
  const role = useSessionStore((s) => s.role);
  const force409 = useMockControl((s) => s.force409);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const info = roleInfo(role);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative flex-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          (root.current?.querySelector('button') as HTMLElement | null)?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account: ${info.user}, ${info.label.toLowerCase()}`}
        onClick={() => setOpen(!open)}
        className="grid size-7 cursor-pointer place-items-center rounded-full border border-border2 bg-raised text-[11px] font-semibold text-text2 hover:text-text"
      >
        {info.initials}
      </button>
      {open ? (
        <div
          role="group"
          aria-label="Account menu"
          className="absolute top-9 right-0 z-30 flex w-[260px] flex-col gap-2 rounded-md border border-border2 bg-surface p-3 text-[12.5px] shadow-lg"
        >
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">{info.user}</span>
            <span className="text-text2">{info.label}</span>
          </div>
          <div role="radiogroup" aria-label="Role" className="flex flex-col gap-0.5">
            <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
              Switch role
            </span>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={r.id === role}
                onClick={() => useSessionStore.getState().setRole(r.id)}
                className={cn(
                  'flex h-7 cursor-pointer items-center justify-between rounded-[3px] border px-2 text-left text-[12.5px]',
                  r.id === role
                    ? 'border-border2 bg-raised text-text'
                    : 'border-transparent text-text2 hover:text-text',
                )}
              >
                <span>{r.label}</span>
                {r.canEdit ? null : <span className="text-[11px] text-text3">Read only</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
              Developer
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-text2">
              <input
                type="checkbox"
                checked={force409}
                onChange={(e) => useMockControl.getState().setForce409(e.target.checked)}
              />
              Next save returns 409
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
