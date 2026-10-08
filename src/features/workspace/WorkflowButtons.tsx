import { useId, useState, type ReactNode } from 'react';
import { usePlanActions } from '@/state/edit-gate';
import { exportPlanFile } from '@/state/export';
import { usePlanStore } from '@/state/plan-store';
import { approve, returnToDraft, revise, sendForReview } from '@/state/workflow';
import { cn } from '@/ui/cn';
import { IconApprove, IconError, IconExport, IconReturn, IconRevise, IconSend } from '@/ui/icons';
import { ReturnDialog } from './Dialogs';

interface ActionProps {
  label: string;
  icon: ReactNode;
  primary?: boolean;
  /** The button stays focusable and says why (design 10): aria-disabled, with the reason. */
  blocked?: string;
  onClick: () => void;
}

function Action({ label, icon, primary, blocked, onClick }: ActionProps) {
  const tip = useId();
  return (
    <span className="group relative flex-none">
      <button
        type="button"
        aria-disabled={blocked ? true : undefined}
        aria-describedby={blocked ? tip : undefined}
        onClick={() => {
          if (!blocked) onClick();
        }}
        className={cn(
          'inline-flex h-7 items-center justify-center gap-1.5 rounded border px-3 text-[12.5px]',
          primary
            ? 'border-accent bg-accent font-semibold text-onaccent'
            : 'border-border2 bg-raised font-medium text-text',
          blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:brightness-110',
        )}
      >
        {icon}
        <span>{label}</span>
      </button>
      {blocked ? (
        <span
          id={tip}
          role="tooltip"
          className="pointer-events-none absolute top-9 right-0 z-30 hidden items-center gap-1.5 rounded border border-err bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap text-text group-focus-within:flex group-hover:flex"
        >
          <span className="grid text-err">
            <IconError size={13} />
          </span>
          {blocked}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The workflow actions for the role and the status (FR-62, FR-63, design 10): after Save, behind
 * a divider, so the other buttons never move. An action the role may not take is not offered;
 * Approve is blocked, with its reason, while errors remain (AT-06).
 */
export function WorkflowButtons() {
  const id = usePlanStore((s) => s.header.id);
  const [returning, setReturning] = useState(false);
  const a = usePlanActions();
  if (!a.send && a.approve.state === 'hidden' && !a.ret && !a.revise && !a.export) return null;
  return (
    <>
      <div aria-hidden="true" className="h-6 w-px flex-none bg-border" />
      {a.send ? (
        <Action
          label="Send for review"
          icon={<IconSend size={13} />}
          onClick={() => void sendForReview()}
        />
      ) : null}
      {a.ret ? (
        <Action label="Return" icon={<IconReturn size={13} />} onClick={() => setReturning(true)} />
      ) : null}
      {a.approve.state !== 'hidden' ? (
        <Action
          label="Approve"
          primary
          icon={<IconApprove size={13} />}
          blocked={a.approve.reason ?? undefined}
          onClick={() => void approve()}
        />
      ) : null}
      {a.export ? (
        <Action
          label="Export"
          icon={<IconExport size={13} />}
          onClick={() => void exportPlanFile(id)}
        />
      ) : null}
      {a.revise ? (
        <Action
          label="Revise"
          primary
          icon={<IconRevise size={13} />}
          onClick={() => void revise()}
        />
      ) : null}
      {returning ? (
        <ReturnDialog
          onClose={() => setReturning(false)}
          onReturn={(c) => {
            setReturning(false);
            void returnToDraft(c);
          }}
        />
      ) : null}
    </>
  );
}
