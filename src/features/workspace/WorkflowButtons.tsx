import { useState } from 'react';
import { approveState, canExport, canReturn, canRevise, canSendForReview } from '@/domain';
import { exportPlanFile } from '@/state/export';
import { usePlanStore } from '@/state/plan-store';
import { useSessionStore } from '@/state/session-store';
import { approve, returnToDraft, revise, sendForReview } from '@/state/workflow';
import { Button } from '@/ui/Button';
import { ReturnDialog } from './Dialogs';

/**
 * The workflow actions for the role and the status (FR-62, FR-63): Send for review, Approve,
 * Return, Revise, Export. An action the role may not take is not offered; Approve is disabled
 * while errors remain (AT-06).
 */
export function WorkflowButtons() {
  const role = useSessionStore((s) => s.role);
  const status = usePlanStore((s) => s.header.status);
  const id = usePlanStore((s) => s.header.id);
  const errors = usePlanStore((s) => s.violations.filter((v) => v.severity === 'error').length);
  const [returning, setReturning] = useState(false);
  const approval = approveState(role, status, errors);
  const cls = 'flex-none px-2 min-[1360px]:px-3';
  return (
    <>
      {canSendForReview(role, status) ? (
        <Button className={cls} aria-label="Send for review" onClick={() => void sendForReview()}>
          {/* Shorter on a narrow top bar; the name still holds the visible word. */}
          <span className="min-[1600px]:hidden">Review</span>
          <span className="hidden min-[1600px]:inline">Send for review</span>
        </Button>
      ) : null}
      {approval !== 'hidden' ? (
        <Button
          className={cls}
          disabled={approval === 'disabled'}
          title={
            approval === 'disabled'
              ? `${errors === 1 ? '1 error remains' : `${errors} errors remain`}: fix them to approve`
              : undefined
          }
          onClick={() => void approve()}
        >
          Approve
        </Button>
      ) : null}
      {canReturn(role, status) ? (
        <Button className={cls} onClick={() => setReturning(true)}>
          Return
        </Button>
      ) : null}
      {canRevise(role, status) ? (
        <Button className={cls} onClick={() => void revise()}>
          Revise
        </Button>
      ) : null}
      {canExport(role, status) ? (
        <Button className={cls} onClick={() => void exportPlanFile(id)}>
          Export
        </Button>
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
