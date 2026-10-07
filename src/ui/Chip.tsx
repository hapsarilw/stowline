import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { IconChevronDown } from './icons';

const CHIP =
  'inline-flex h-6 cursor-pointer items-center gap-[5px] whitespace-nowrap rounded border px-2 text-[12px]';
const chipTone = (on: boolean) =>
  on ? 'border-accent bg-accentbg text-text' : 'border-border2 bg-transparent text-text2';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean;
  swatch?: ReactNode;
}

/** A filter chip that switches on and off. */
export function Chip({
  pressed,
  swatch,
  className,
  children,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(CHIP, chipTone(pressed), className)}
      {...props}
    >
      {swatch}
      <span>{children}</span>
    </button>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  swatch?: ReactNode;
}

interface ChipSelectProps<T extends string> {
  /** The chip text when nothing is chosen, such as "POD". */
  label: string;
  value: T | null;
  options: readonly ChipOption<T>[];
  onChange: (value: T | null) => void;
}

/** A chip with a caret that opens a list of choices. Arrow keys, Enter and Esc work. */
export function ChipSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: ChipSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const all: readonly (ChipOption<T> | { value: null; label: string; swatch?: undefined })[] = [
    {
      value: null,
      label: `All ${label}`.replace('All POD', 'All PODs').replace('All Type', 'All types'),
    },
    ...options,
  ];
  const chosen = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const openList = () => {
    setActive(
      Math.max(
        0,
        all.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(all[i]!.value);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(CHIP, chipTone(value !== null))}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openList();
          } else if (open) {
            const keys: Record<string, () => void> = {
              ArrowDown: () => setActive((a) => Math.min(a + 1, all.length - 1)),
              ArrowUp: () => setActive((a) => Math.max(a - 1, 0)),
              Home: () => setActive(0),
              End: () => setActive(all.length - 1),
              Enter: () => choose(active),
              ' ': () => choose(active),
              Escape: () => {
                e.stopPropagation();
                setOpen(false);
              },
            };
            const run = keys[e.key];
            if (run) {
              e.preventDefault();
              run();
            } else if (e.key === 'Tab') setOpen(false);
          }
        }}
      >
        {chosen?.swatch}
        <span>{chosen ? `${label}: ${chosen.label}` : label}</span>
        <IconChevronDown size={10} strokeWidth={1.8} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          className="absolute top-[calc(100%+4px)] left-0 z-10 min-w-[150px] rounded border border-border2 bg-raised p-1 shadow-lg"
        >
          {all.map((o, i) => (
            <li
              key={o.value ?? 'all'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              className={cn(
                'flex h-6 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-[12px]',
                i === active && 'bg-hover',
                o.value === value && 'font-semibold text-text',
              )}
            >
              {o.swatch}
              {o.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
