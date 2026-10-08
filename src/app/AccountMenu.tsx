import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ROLES, roleInfo, type Role } from '@/domain';
import { useMockControl } from '@/api/mock/control';
import { useSessionStore } from '@/state/session-store';
import { cn } from '@/ui/cn';
import { IconLock } from '@/ui/icons';

// The account menu (design 09): who is signed in, the role switcher (FR-62) and the developer
// switch that makes the next save return 409 (SRS "Mock behavior"). Same menu on the plans list.

const GROUP = 'text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase';
type Item = { kind: 'role'; role: Role } | { kind: 'dev' };
const ITEMS: Item[] = [
  ...ROLES.map((r) => ({ kind: 'role' as const, role: r.id })),
  { kind: 'dev' },
];

export function AccountMenu() {
  const role = useSessionStore((s) => s.role);
  const force409 = useMockControl((s) => s.force409);
  const menuSeq = useSessionStore((s) => s.menuSeq);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const info = roleInfo(role);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // The focus goes to the chosen role when the menu opens, and moves with the arrow keys.
  useEffect(() => {
    if (open) items.current[active]?.focus();
  }, [open, active]);

  const openAt = () => {
    setActive(
      Math.max(
        0,
        ROLES.findIndex((r) => r.id === role),
      ),
    );
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  // "Switch role" in the read only strip opens this menu.
  const seen = useRef(menuSeq);
  useEffect(() => {
    if (menuSeq === seen.current) return;
    seen.current = menuSeq;
    openAt();
    // openAt only reads the role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuSeq]);

  const choose = (i: number) => {
    const it = ITEMS[i]!;
    if (it.kind === 'role') useSessionStore.getState().setRole(it.role);
    else useMockControl.getState().setForce409(!useMockControl.getState().force409);
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openAt();
    }
  };
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : ITEMS.length - 1)) % ITEMS.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : ITEMS.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="relative flex-none">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${info.user}, ${info.label.toLowerCase()}`}
        onClick={() => (open ? close() : openAt())}
        onKeyDown={onButtonKey}
        className={cn(
          'grid size-7 cursor-pointer place-items-center rounded-full border text-[11px] font-semibold hover:text-text',
          open ? 'border-accent bg-accentbg text-text' : 'border-border2 bg-raised text-text2',
        )}
      >
        {info.initials}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute top-9 right-0 z-30 w-[300px] overflow-hidden rounded-md border border-border2 bg-surface text-[12.5px] shadow-lg"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
            <span
              aria-hidden="true"
              className="grid size-8 flex-none place-items-center rounded-full border border-border2 bg-raised text-[11px] font-semibold text-text2"
            >
              {info.initials}
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="font-semibold">{info.user}</span>
              <span className="truncate text-[11.5px] text-text2">
                {info.label} · Singapore planning desk
              </span>
            </div>
          </div>
          <div role="group" aria-labelledby="acct-roles" className="flex flex-col gap-0.5 p-1.5">
            <span id="acct-roles" className={cn(GROUP, 'px-1.5 pt-1 pb-0.5')}>
              Switch role
            </span>
            {ROLES.map((r, i) => {
              const on = r.id === role;
              return (
                <div
                  key={r.id}
                  ref={(el) => void (items.current[i] = el)}
                  role="menuitemradio"
                  aria-checked={on}
                  tabIndex={active === i ? 0 : -1}
                  onClick={() => {
                    setActive(i);
                    choose(i);
                  }}
                  className={cn(
                    'flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-text -outline-offset-2 hover:bg-hover',
                    on && 'bg-accentbg font-semibold hover:bg-accentbg',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-3 flex-none place-items-center rounded-full border',
                      on ? 'border-accent' : 'border-text2',
                    )}
                  >
                    {on ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                  </span>
                  <span className="flex-1">{r.label}</span>
                  {r.canEdit ? null : (
                    <span className="flex items-center gap-1 text-[11px] font-normal text-text2">
                      <IconLock size={10} strokeWidth={1.6} />
                      Read only
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div
            role="group"
            aria-labelledby="acct-dev"
            className="flex flex-col gap-0.5 border-t border-border p-1.5"
          >
            <span id="acct-dev" className={cn(GROUP, 'px-1.5 pt-1 pb-0.5')}>
              Developer
            </span>
            <div
              ref={(el) => void (items.current[ROLES.length] = el)}
              role="menuitemcheckbox"
              aria-checked={force409}
              tabIndex={active === ROLES.length ? 0 : -1}
              onClick={() => {
                setActive(ROLES.length);
                choose(ROLES.length);
              }}
              className="flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-text2 -outline-offset-2 hover:bg-hover hover:text-text"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-3 flex-none place-items-center rounded-[2px] border text-[9px] leading-none',
                  force409 ? 'border-accent bg-accent text-onaccent' : 'border-text2',
                )}
              >
                {force409 ? '✓' : null}
              </span>
              <span>
                Next save returns <span className="font-mono">409</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
