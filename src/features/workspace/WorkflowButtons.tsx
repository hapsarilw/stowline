import { useId, useState, type ReactNode } from 'react';
import { approveState, canExport, canReturn, canRevise, canSendForReview } from '@/domain';
import { exportPlanFile } from '@/state/export';
import { usePlanStore } from '@/state/plan-store';
import { useSessionStore } from '@/state/session-store';
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
  const role = useSessionStore((s) => s.role);
  const status = usePlanStore((s) => s.header.status);
  const id = usePlanStore((s) => s.header.id);
  const errors = usePlanStore((s) => s.violations.filter((v) => v.severity === 'error').length);
  const [returning, setReturning] = useState(false);
  const approval = approveState(role, status, errors);
  const send = canSendForReview(role, status);
  const ret = canReturn(role, status);
  const rev = canRevise(role, status);
  const exp = canExport(role, status);
  if (!send && approval === 'hidden' && !ret && !rev && !exp) return null;
  return (
    <>
      <div aria-hidden="true" className="h-6 w-px flex-none bg-border" />
      {send ? (
        <Action
          label="Send for review"
          icon={<IconSend size={13} />}
          onClick={() => void sendForReview()}
        />
      ) : null}
      {ret ? (
        <Action label="Return" icon={<IconReturn size={13} />} onClick={() => setReturning(true)} />
      ) : null}
      {approval !== 'hidden' ? (
        <Action
          label="Approve"
          primary
          icon={<IconApprove size={13} />}
          blocked={
            approval === 'disabled'
              ? `${errors === 1 ? '1 error remains' : `${errors} errors remain`}: fix them to approve`
              : undefined
          }
          onClick={() => void approve()}
        />
      ) : null}
      {exp ? (
        <Action
          label="Export"
          icon={<IconExport size={13} />}
          onClick={() => void exportPlanFile(id)}
        />
      ) : null}
      {rev ? (
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
