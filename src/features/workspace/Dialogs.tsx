import { useState } from 'react';
import { plural } from '@/domain';
import { useImportReport } from '@/state/import';
import { rebaseOnServer, useConflict, when } from '@/state/save';
import { saveCurrent } from '@/state/save';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { IconWarning } from '@/ui/icons';

/** The save was refused: who saved and when, and a choice: review the changes, or retry (FR-60). */
export function ConflictBanner() {
  const conflict = useConflict((s) => s.conflict);
  const reviewing = useConflict((s) => s.reviewing);
  if (!conflict) return null;
  const n = conflict.kept.length;
  return (
    <>
      <div
        role="alert"
        className="absolute top-14 left-1/2 z-30 flex max-w-[640px] -translate-x-1/2 items-center gap-3 rounded border border-warn bg-raised py-2 pr-2 pl-3 text-[12.5px]"
      >
        <span className="grid text-warn">
          <IconWarning size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-semibold">
            {conflict.savedBy} saved version {conflict.currentVersion} at {when(conflict.savedAt)}
          </span>
          <span className="text-text2">
            Your {plural(n, 'change')} {n === 1 ? 'is' : 'are'} kept here and not saved.
          </span>
        </div>
        <Button
          className="h-[26px] px-2.5 text-[12px] font-normal"
          onClick={() => useConflict.getState().setReviewing(true)}
        >
          Review changes
        </Button>
        <Button
          className="h-[26px] px-2.5 text-[12px] font-normal"
          onClick={() => void saveCurrent()}
        >
          Retry
        </Button>
      </div>
      {reviewing ? (
        <Dialog
          title="Review changes"
          onClose={() => useConflict.getState().setReviewing(false)}
          footer={
            <>
              <Button onClick={() => useConflict.getState().setReviewing(false)}>Close</Button>
              <Button variant="primary" onClick={() => void rebaseOnServer()}>
                Apply my changes to version {conflict.currentVersion}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
                On the server
              </div>
              <p className="m-0 mt-1">
                {conflict.savedBy} saved version {conflict.currentVersion} at{' '}
                {when(conflict.savedAt)}.
              </p>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
                Your changes · {n}
              </div>
              <ul className="m-0 mt-1 list-none p-0 font-mono text-[11.5px]">
                {conflict.kept.map((k, i) => (
                  <li key={i} className="border-b border-border py-1">
                    {k}
                  </li>
                ))}
              </ul>
            </div>
            <p className="m-0 text-text2">
              Applying them loads version {conflict.currentVersion} and puts your changes on top,
              checking each against the rules. Then you can save.
            </p>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** The result of Import load list: what was accepted, and each rejected row with its reason (FR-64). */
export function ImportReportDialog() {
  const report = useImportReport((s) => s.report);
  if (!report) return null;
  const close = useImportReport.getState().close;
  return (
    <Dialog
      title="Import load list"
      width={560}
      onClose={close}
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <p className="m-0 mb-3" data-testid="import-summary">
        <span className="font-semibold">{plural(report.accepted, 'row')} accepted</span>
        {' · '}
        <span className={report.rejected.length ? 'font-semibold text-err' : ''}>
          {report.rejected.length} rejected
        </span>{' '}
        <span className="text-text2">from {report.fileName}</span>
      </p>
      {report.rejected.length ? (
        <table className="w-full border-collapse text-left text-[12px]" aria-label="Rejected rows">
          <thead>
            <tr className="text-text2">
              <th className="w-10 py-1 font-medium">Row</th>
              <th className="w-[130px] py-1 font-medium">ID</th>
              <th className="py-1 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {report.rejected.map((r) => (
              <tr key={r.row} className="border-t border-border align-top">
                <td className="py-1 font-mono">{r.row}</td>
                <td className="py-1 font-mono break-all">{r.id || '—'}</td>
                <td className="py-1">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="m-0 text-text2">Every row passed the checks.</p>
      )}
    </Dialog>
  );
}

/** Return needs a comment (FR-62). */
export function ReturnDialog({
  onClose,
  onReturn,
}: {
  onClose: () => void;
  onReturn: (comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const empty = comment.trim() === '';
  return (
    <Dialog
      title="Return to Draft"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setTried(true);
              if (!empty) onReturn(comment.trim());
            }}
          >
            Return to Draft
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Comment for the planner</span>
        <textarea
          data-autofocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={tried && empty}
          aria-describedby={tried && empty ? 'return-error' : undefined}
          rows={4}
          className="rounded border border-border2 bg-bg p-2 text-[12.5px] text-text"
        />
        {tried && empty ? (
          <span id="return-error" role="alert" className="text-err">
            A comment is required when a plan is returned.
          </span>
        ) : null}
      </label>
    </Dialog>
  );
}
