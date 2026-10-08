import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

// A segmented radio group (the severity filter in design 04). Arrow keys move and choose,
// as a radio group does; only the chosen option is in the tab order.

interface SegmentedProps<T extends string> {
  label: string;
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.id === value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const id = options[(i + step + options.length) % options.length]!.id;
    onChange(id);
    refs.current.get(id)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex gap-0.5 rounded border border-border bg-bg p-0.5', className)}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex h-[22px] cursor-pointer items-center gap-[5px] rounded-[3px] border px-2 text-[12px]',
              on ? 'border-border2 bg-raised text-text' : 'border-transparent text-text2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
