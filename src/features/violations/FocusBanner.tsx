import { plural } from '@/domain';
import { usePlanStore } from '@/state/plan-store';
import { useViewStore } from '@/state/view-store';
import { cn } from '@/ui/cn';
import { IconError, IconWarning } from '@/ui/icons';
import { focusBanner } from './model';

/** Over the 3D view while a violation is in focus (FR-43, design 04). Esc clears it too. */
export function FocusBanner() {
  const id = useViewStore((s) => s.focusedViolation);
  const v = usePlanStore((s) => s.violations.find((x) => x.id === id));
  if (!v) return null;
  const b = focusBanner(v);
  const Icon = b.severity === 'error' ? IconError : IconWarning;
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto absolute top-12 left-1/2 z-[2] flex h-8 -translate-x-1/2 items-center gap-2.5 rounded border bg-surface pr-1 pl-2.5 text-[12px] whitespace-nowrap',
        b.severity === 'error' ? 'border-err' : 'border-warn',
      )}
    >
      <span className={cn('grid', b.severity === 'error' ? 'text-err' : 'text-warn')}>
        <Icon size={14} />
      </span>
      <span>
        Focused on <span className="font-semibold">{plural(b.count, 'container')}</span> ·{' '}
        <span className="font-mono">{b.title}</span> · others dimmed
      </span>
      <button
        type="button"
        onClick={() => useViewStore.getState().clearViolationFocus()}
        className="flex h-6 cursor-pointer items-center gap-1.5 rounded-[3px] border border-border2 bg-raised px-2 text-[12px]"
      >
        Clear focus <kbd className="font-mono text-[10px] text-text3">Esc</kbd>
      </button>
    </div>
  );
}
