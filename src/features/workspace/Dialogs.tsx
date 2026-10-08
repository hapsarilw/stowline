import { useEffect, useState } from 'react';
import { plural } from '@/domain';
import { api } from '@/state/api';
import { useImportReport } from '@/state/import';
import { usePlanStore } from '@/state/plan-store';
import { rebaseOnServer, saveCurrent, useConflict, when } from '@/state/save';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { IconCheckCircle, IconError, IconInfo, IconWarning } from '@/ui/icons';

/** "Placed NSPU 1 at 180286" is a Place; the first word names the kind of change. */
export function changeKind(text: string): string {
  const first = text.split(' ')[0] ?? '';
  const kinds: Record<string, string> = {
    Placed: 'Place',
    Moved: 'Move',
    Unplaced: 'Unplace',
    Swapped: 'Swap',
    Locked: 'Lock',
    Unlocked: 'Unlock',
  };
  return kinds[first] ?? 'Change';
}

/** After a refused save (design 12): bottom centre, stays until it is acted on. */
export function ConflictBanner() {
  const conflict = useConflict((s) => s.conflict);
  const reviewing = useConflict((s) => s.reviewing);
  if (!conflict) return null;
  const n = conflict.kept.length;
  return (
    <>
      <div
        role="alert"
        className="absolute bottom-[76px] left-1/2 z-30 flex w-[560px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-[stw-in_160ms_ease-out] items-center gap-2.5 rounded border border-err bg-raised py-2 pr-1.5 pl-3 text-[12.5px] motion-reduce:animate-[stw-fade_100ms_linear]"
      >
        <span className="grid text-err">
          <IconError size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-semibold">
            {conflict.savedBy} saved version {conflict.currentVersion} at {when(conflict.savedAt)}
          </span>
          <span className="text-[12px] text-text2">
            Your {plural(n, 'change')} {n === 1 ? 'is' : 'are'} kept here and not saved.
          </span>
        </div>
        <Button
          className="h-[26px] border-border2 bg-transparent px-2.5 text-[12px] font-normal"
          onClick={() => useConflict.getState().setReviewing(true)}
        >
          Review changes
        </Button>
        <Button
          variant="ghost"
          className="h-[26px] px-2.5 text-[12px] font-normal"
          onClick={() => void saveCurrent()}
        >
          Retry
        </Button>
      </div>
      {reviewing ? <ReviewDialog /> : null}
    </>
  );
}

/** What the server holds now, and what is kept here, side by side (design 12). */
function ReviewDialog() {
  const conflict = useConflict((s) => s.conflict)!;
  const id = usePlanStore((s) => s.header.id);
  const [server, setServer] = useState<string[] | null>(null);
  const close = () => useConflict.getState().setReviewing(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getActivity(id)
      .then((log) => {
        const t = Date.parse(conflict.savedAt);
        const mine = log.filter((e) => e.user === conflict.savedBy && Date.parse(e.at) >= t - 5000);
        if (!cancelled) setServer(mine.map((e) => e.text.replace(`${e.user}: `, '')));
      })
      .catch(() => {
        if (!cancelled) setServer([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, conflict.savedAt, conflict.savedBy]);

  const row = (text: string, i: number) => (
    <li
      key={i}
      className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 border-b border-border py-1.5 text-[12px]"
    >
      <span className="text-text2">{changeKind(text)}</span>
      <span className="font-mono text-[11.5px] text-pretty">{text}</span>
    </li>
  );
  return (
    <Dialog
      title="Review changes"
      subtitle={id}
      width={760}
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-[12px] text-text2">
            Nothing is saved until you confirm.
          </span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" data-autofocus onClick={() => void rebaseOnServer()}>
            Apply my changes to version {conflict.currentVersion}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <section aria-label="On the server">
          <h3 className="m-0 mb-1 flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
            On the server
            <span className="font-mono tracking-normal normal-case">
              v{conflict.currentVersion} · {conflict.savedBy} · {when(conflict.savedAt)}
            </span>
          </h3>
          <ul className="m-0 list-none p-0">
            {server === null ? (
              <li className="py-1.5 text-text2">Loading…</li>
            ) : server.length ? (
              server.map(row)
            ) : (
              <li className="py-1.5 text-text2">{conflict.savedBy} saved the plan.</li>
            )}
          </ul>
        </section>
        <section aria-label="Your kept changes">
          <h3 className="m-0 mb-1 flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase">
            Your kept changes
            <span className="font-mono tracking-normal normal-case">
              made on v{conflict.madeOn}
            </span>
          </h3>
          <ul className="m-0 list-none p-0">{conflict.kept.map(row)}</ul>
          <p className="m-0 mt-3 flex items-start gap-2 rounded border border-border bg-raised p-2.5 text-[12px] text-text2">
            <span className="mt-px grid flex-none">
              <IconInfo size={14} />
            </span>
            Rules are re-checked after applying. A change that no longer fits is left out, and you
            are told which.
          </p>
        </section>
      </div>
    </Dialog>
  );
}

/** The result of Import load list (design 13): what was accepted, and each rejected row with its reason (FR-64). */
export function ImportReportDialog() {
  const report = useImportReport((s) => s.report);
  const port = usePlanStore((s) => s.header.port);
  const [copied, setCopied] = useState(false);
  if (!report) return null;
  const close = useImportReport.getState().close;
  const bad = report.rejected.length > 0;
  return (
    <Dialog
      title="Import load list"
      width={620}
      onClose={close}
      footer={
        <>
          <span className="mr-auto text-[12px] text-text2">
            {report.accepted} added to the {port} load list
          </span>
          {bad ? (
            <Button
              onClick={() => {
                const text = [
                  `${report.fileName}: ${report.accepted} accepted, ${report.rejected.length} rejected`,
                  ...report.rejected.map((r) => `Row ${r.row}\t${r.id}\t${r.reason}`),
                ].join('\n');
                void navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? 'Copied' : 'Copy report'}
            </Button>
          ) : null}
          <Button variant="primary" data-autofocus onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <p role="status" className="m-0 mb-3 flex items-center gap-2" data-testid="import-summary">
        <span className={bad ? 'text-warn' : 'text-ok'}>
          {bad ? <IconWarning size={15} /> : <IconCheckCircle size={15} />}
        </span>
        <span className="font-semibold">
          {plural(report.accepted, 'row')} accepted · {report.rejected.length} rejected
        </span>{' '}
        <span className="text-text2">
          from <span className="font-mono">{report.fileName}</span>
        </span>
      </p>
      {bad ? (
        <>
          <table
            className="w-full border-collapse overflow-hidden rounded border border-border text-left text-[12px]"
            aria-label="Rejected rows"
          >
            <thead>
              <tr className="text-text2">
                <th className="w-12 px-2.5 py-1.5 font-normal">Row</th>
                <th className="w-[130px] px-2.5 py-1.5 font-normal">ID</th>
                <th className="px-2.5 py-1.5 font-normal">Reason</th>
              </tr>
            </thead>
            <tbody>
              {report.rejected.map((r) => (
                <tr key={r.row} className="border-t border-border align-top">
                  <td className="px-2.5 py-1.5 font-mono">{r.row}</td>
                  <td className="px-2.5 py-1.5 font-mono break-all">{r.id || '—'}</td>
                  <td className="px-2.5 py-1.5">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-2.5 text-[12px] text-text2">
            Rejected rows are not added. Fix them in the file and import it again; accepted rows are
            not duplicated.
          </p>
        </>
      ) : (
        <p className="m-0 text-text2">Every row passed the checks.</p>
      )}
    </Dialog>
  );
}

/** Return needs a comment (FR-62, design 13). */
export function ReturnDialog({
  onClose,
  onReturn,
}: {
  onClose: () => void;
  onReturn: (comment: string) => void;
}) {
  const header = usePlanStore((s) => s.header);
  const vessel = usePlanStore((s) => s.ctx.vessel.name);
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const empty = comment.trim() === '';
  const submit = () => {
    setTried(true);
    if (!empty) onReturn(comment.trim());
  };
  return (
    <Dialog
      title="Return to Draft"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto font-mono text-[11.5px] text-text3">Ctrl+Enter to return</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Return to Draft
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3 text-text2">
        <span className="font-semibold text-text">
          {vessel} · {header.id} · v{header.version}
        </span>{' '}
        goes back to {header.planner ?? 'the planner'} as a Draft, with your comment.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">
          Comment <span className="font-normal text-text2">(required)</span>
        </span>
        <textarea
          data-autofocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          aria-invalid={tried && empty}
          aria-describedby={tried && empty ? 'return-error' : undefined}
          placeholder="What needs to change before this can be approved?"
          rows={4}
          className="rounded border border-border2 bg-bg p-2 text-[12.5px] text-text aria-[invalid=true]:border-err"
        />
        {tried && empty ? (
          <span id="return-error" role="alert" className="flex items-center gap-1.5 text-err">
            <IconError size={12} />A comment is required when a plan is returned.
          </span>
        ) : null}
      </label>
    </Dialog>
  );
}
