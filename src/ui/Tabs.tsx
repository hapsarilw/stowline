import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  /** Name for screen readers when the label is not plain text. */
  name?: string;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'segmented' | 'underline';
  /** Id prefix. Each tab gets `${idPrefix}-tab-${id}` and controls `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
  className?: string;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs, one tab stop. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  variant = 'segmented',
  idPrefix,
  className,
}: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next]!.id;
    onChange(id);
    refs.current.get(id)?.focus();
  };

  const segmented = variant === 'segmented';
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'flex',
        segmented
          ? 'gap-0.5 rounded border border-border bg-bg p-0.5'
          : 'h-10 items-stretch gap-1 px-2',
        className,
      )}
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
              else refs.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${t.id}` : undefined}
            aria-selected={selected}
            aria-label={t.name}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={
              segmented
                ? cn(
                    'h-6 cursor-pointer rounded-[3px] border px-3 text-[12px] font-medium',
                    selected
                      ? 'border-border2 bg-raised text-text'
                      : 'border-transparent text-text2',
                  )
                : cn(
                    'flex cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-2 text-[13px] font-semibold',
                    selected ? 'border-accent text-text' : 'border-transparent text-text2',
                  )
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
