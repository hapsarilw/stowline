import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AccountMenu } from '@/app/AccountMenu';
import { isApiError } from '@/api/errors';
import type { ActivityEntry, PlanListResponse, PlanSummary } from '@/api/types';
import {
  approveState,
  canExport,
  canReturn,
  canRevise,
  canSendForReview,
  roleInfo,
  type PlanStatus,
} from '@/domain';
import { ToastHost } from '@/features/workspace/ToastHost';
import { ReturnDialog } from '@/features/workspace/Dialogs';
import { api, request } from '@/state/api';
import { exportPlanFile } from '@/state/export';
import { statusToast } from '@/state/workflow';
import { useSessionStore } from '@/state/session-store';
import { useViewStore } from '@/state/view-store';
import { StatusBadge } from '@/ui/Badges';
import { Button, IconButton } from '@/ui/Button';
import { cn } from '@/ui/cn';
import {
  IconCheckCircle,
  IconError,
  IconInfo,
  IconLock,
  IconMoon,
  IconSearch,
  IconSun,
  IconWarning,
} from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { NewPlanDialog } from './NewPlanDialog';
import {
  activityTime,
  dueText,
  formatEtd,
  initials,
  percent,
  stabilityCards,
  STATE_TEXT,
  updatedText,
  violationsText,
} from './model';

// The plans list (FR-01 to FR-05), design 07: filters, search, sort by ETD, and the preview.

type Tab = 'all' | PlanStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
];
const COLS =
  'grid grid-cols-[minmax(170px,1.4fr)_64px_70px_118px_minmax(120px,1fr)_104px_104px_120px_64px] items-center gap-2.5 px-5';
const toggle = (on: boolean) =>
  cn(
    'h-7 cursor-pointer rounded border px-2 text-[12px]',
    on
      ? 'border-accent bg-accentbg text-text'
      : 'border-border2 bg-transparent text-text2 hover:text-text',
  );
const LABEL = 'text-[10.5px] font-semibold tracking-[0.06em] text-text3 uppercase';

function Violations({ p }: { p: PlanSummary }) {
  const v = violationsText(p);
  const Icon =
    v.tone === 'error' ? IconError : v.tone === 'warning' ? IconWarning : IconCheckCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] font-mono text-[12px]',
        v.tone === 'error' ? 'text-err' : v.tone === 'warning' ? 'text-warn' : 'text-ok',
      )}
    >
      <Icon size={13} strokeWidth={1.6} />
      {v.text}
    </span>
  );
}

function Preview({ plan, onChanged }: { plan: PlanSummary; onChanged: () => void }) {
  const role = useSessionStore((s) => s.role);
  const navigate = useNavigate();
  const [log, setLog] = useState<ActivityEntry[] | null>(null);
  const [returning, setReturning] = useState(false);
  // The log is read again when the plan, its version or its status changes.
  const key = `${plan.id}:${plan.version}:${plan.status}`;
  useEffect(() => {
    let cancelled = false;
    void (async function run() {
      const r = await request(
        () => api.getActivity(plan.id),
        () => void run(),
      );
      if (r.ok && !cancelled) setLog(r.data);
    })();
    return () => {
      cancelled = true;
    };
    // key stands for the plan's id, version and status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const change = async (to: PlanStatus, comment?: string) => {
    const r = await request(
      () => api.setStatus(plan.id, { to, comment }),
      () => void change(to, comment),
      (e) => isApiError(e) && [403, 409, 422].includes(e.status),
    );
    const view = useViewStore.getState();
    if (r.ok) {
      view.showToast({
        kind: 'ok',
        ...statusToast(to, plan.status === 'approved', r.data.version, plan.planner, plan.id),
      });
      onChanged();
    } else if (isApiError(r.error))
      view.showToast({ kind: 'err', title: "Can't change the status", message: r.error.message });
  };

  const approval = approveState(role, plan.status, plan.errors);
  // The note under the buttons (design 15): what opening the plan means for this role.
  const note =
    approval === 'disabled'
      ? `${plan.errors === 1 ? '1 error remains' : `${plan.errors} errors remain`}: fix them to approve`
      : !plan.openable
        ? null
        : !roleInfo(role).canEdit
          ? 'Opens read only'
          : plan.status === 'in_review' && role === 'planner'
            ? 'Opens read only until returned'
            : null;
  const s = plan.preview;
  const newest = log?.[0]?.at ?? '';
  return (
    <aside
      aria-label="Plan preview"
      className="flex min-h-0 flex-col overflow-auto border-l border-border bg-surface"
    >
      <div className="flex flex-col gap-1.5 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <span className={LABEL}>Plan preview</span>
          <div className="flex-1" />
          <StatusBadge status={plan.status} />
        </div>
        <span className="text-[16px] font-semibold">{plan.vessel}</span>
        <span className="font-mono text-[12px] text-text2">
          Voy {plan.voyage} · {plan.port} · ETD {formatEtd(plan.etd)}
        </span>
      </div>
      {!plan.openable ? (
        <p
          id="cannot-open"
          role="note"
          className="m-0 flex items-start gap-2 border-b border-border px-4 py-3 text-[12px] text-text2"
        >
          <span className="mt-px grid flex-none">
            <IconInfo size={14} />
          </span>
          This voyage has no vessel geometry in the demo, so it cannot be opened.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-text2">Bay fill, bow to stern</span>
          <span className="font-mono">
            {plan.planned.toLocaleString('en-US')} / {plan.total.toLocaleString('en-US')}
          </span>
        </div>
        <div
          role="img"
          aria-label="Bay fill profile"
          className="flex h-12 items-end gap-0.5 rounded border border-border bg-bg p-1"
        >
          {s.bayFill.map((b, i) => {
            const c = s.errorBays.includes(i) ? 'var(--err)' : 'var(--text3)';
            return (
              <span key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
                <span style={{ height: `${(b.deck * 48).toFixed(0)}%`, background: c }} />
                <span className="h-px bg-text3" />
                <span style={{ height: `${(b.hold * 48).toFixed(0)}%`, background: c }} />
              </span>
            );
          })}
        </div>
        <div className="flex justify-between font-mono text-[10px] text-text3">
          <span>BOW 02</span>
          <span>86 STERN</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 border-b border-border px-4 py-3.5">
        {stabilityCards(s.stability).map((g) => (
          <div key={g.k} className="flex flex-col gap-0.5 rounded border border-border bg-bg p-2">
            <span className="text-[11px] text-text2">{g.k}</span>
            <span className="font-mono text-[14px] font-semibold">{g.v}</span>
            <span
              className={cn(
                'flex items-center gap-1 text-[10.5px] font-semibold tracking-[0.04em] uppercase',
                g.state === 'ok' ? 'text-ok' : g.state === 'check' ? 'text-warn' : 'text-err',
              )}
            >
              {g.state === 'ok' ? (
                <IconCheckCircle size={11} strokeWidth={1.8} />
              ) : g.state === 'check' ? (
                <IconWarning size={11} strokeWidth={1.8} />
              ) : (
                <IconError size={11} strokeWidth={1.8} />
              )}
              {STATE_TEXT[g.state]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 border-b border-border px-4 py-3.5">
        <span className={LABEL}>Open violations</span>
        {s.violationsByRule.map((v) => (
          <div
            key={v.label}
            className="grid min-h-[22px] grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 text-[12px]"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-[1px]"
              style={{ background: v.severity === 'error' ? 'var(--err)' : 'var(--warn)' }}
            />
            <span>{v.label}</span>
            <span className={cn('font-mono', v.severity === 'error' ? 'text-err' : 'text-warn')}>
              {v.count}
            </span>
          </div>
        ))}
        {s.violationsByRule.length === 0 ? (
          <span className="text-[12px] text-ok">All rule checks pass</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <span className={LABEL}>Activity</span>
        {log === null ? <span className="text-[12px] text-text2">Loading…</span> : null}
        {log?.slice(0, 4).map((l, i) => (
          <div
            key={`${l.at}-${i}`}
            className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 text-[12px]"
          >
            <span className="font-mono text-text3">{activityTime(l.at, newest)}</span>
            <span className="text-pretty text-text">{l.text}</span>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-surface px-4 py-3">
        <Button
          variant="primary"
          className={cn('h-8 min-w-24 flex-1', !plan.openable && 'cursor-not-allowed opacity-45')}
          aria-disabled={!plan.openable || undefined}
          aria-describedby={!plan.openable ? 'cannot-open' : undefined}
          onClick={() => plan.openable && void navigate(`/plans/${plan.id}`)}
        >
          Open plan
        </Button>
        {canSendForReview(role, plan.status) ? (
          <Button className="h-8" onClick={() => void change('in_review')}>
            Send for review
          </Button>
        ) : null}
        {canReturn(role, plan.status) ? (
          <Button className="h-8" onClick={() => setReturning(true)}>
            Return
          </Button>
        ) : null}
        {approval !== 'hidden' ? (
          <Button
            className={cn('h-8', approval === 'disabled' && 'cursor-not-allowed opacity-45')}
            aria-disabled={approval === 'disabled' || undefined}
            aria-describedby={approval === 'disabled' ? 'approve-why' : undefined}
            onClick={() => approval === 'enabled' && void change('approved')}
          >
            Approve
          </Button>
        ) : null}
        {canRevise(role, plan.status) ? (
          <Button className="h-8" onClick={() => void change('draft')}>
            Revise
          </Button>
        ) : null}
        {canExport(role, plan.status) && plan.openable ? (
          <Button className="h-8" onClick={() => void exportPlanFile(plan.id)}>
            Export
          </Button>
        ) : null}
        {note ? (
          <p
            id={approval === 'disabled' ? 'approve-why' : undefined}
            className="m-0 flex basis-full items-center gap-1.5 text-[11.5px] text-text2"
          >
            <IconLock size={11} strokeWidth={1.6} />
            {note}
          </p>
        ) : null}
      </div>
      {returning ? (
        <ReturnDialog
          onClose={() => setReturning(false)}
          onReturn={(c) => {
            setReturning(false);
            void change('draft', c);
          }}
        />
      ) : null}
    </aside>
  );
}

export function PlansPage() {
  // "Assigned to me" depends on who is signed in, so a role change loads the list again.
  const role = useSessionStore((s) => s.role);
  const theme = useViewStore((s) => s.theme);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [issues, setIssues] = useState(false);
  const [asc, setAsc] = useState(true);
  const [data, setData] = useState<PlanListResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const navigate = useNavigate();

  const load = useCallback(
    async function load() {
      const n = ++latest.current;
      const r = await request(
        () =>
          api.listPlans({
            status: tab === 'all' ? undefined : tab,
            q: q.trim() || undefined,
            mine,
            hasViolations: issues,
            sort: asc ? 'etd' : '-etd',
          }),
        () => void load(),
      );
      if (n !== latest.current) return;
      setFailed(!r.ok);
      if (r.ok) setData(r.data);
    },
    [tab, q, mine, issues, asc],
  );

  useEffect(() => {
    document.title = 'Stowage plans · Stowline';
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, q, role]);

  const plans = data?.plans ?? [];
  const current = plans.find((p) => p.id === selected) ?? plans[0] ?? null;
  const counts = data?.counts;
  const next = plans.length ? plans.reduce((a, b) => (a.etd < b.etd ? a : b)) : null;

  const onRowKey = (e: KeyboardEvent, p: PlanSummary) => {
    if (e.key === 'Enter') setSelected(p.id);
    if (e.key === ' ') {
      e.preventDefault();
      setSelected(p.id);
    }
  };
  const clear = () => {
    setQ('');
    setTab('all');
    setMine(false);
    setIssues(false);
  };

  return (
    <div className="relative grid h-full min-h-[720px] grid-cols-[minmax(0,1fr)_360px] grid-rows-[48px_minmax(0,1fr)] overflow-hidden bg-bg text-text">
      <header className="col-span-full flex items-center gap-4 border-b border-border bg-surface px-3">
        <Link
          to="/plans"
          aria-label="Stowline"
          className="flex h-6 items-center gap-2 text-text no-underline"
        >
          <span
            aria-hidden="true"
            className="grid grid-cols-[repeat(3,6px)] grid-rows-[repeat(3,6px)] gap-px"
          >
            {[1, 0, 0, 1, 1, 0, 1, 1, 1].map((f, i) => (
              <span key={i} className={f ? 'bg-accent' : 'border border-border2'} />
            ))}
          </span>
          <span className="text-[14px] font-semibold">Stowline</span>
        </Link>
        <nav aria-label="Main" className="flex h-12 items-stretch">
          <a
            href="/plans"
            aria-current="page"
            onClick={(e) => e.preventDefault()}
            className="flex items-center border-b-2 border-accent px-2.5 font-semibold text-text no-underline"
          >
            Plans
          </a>
        </nav>
        <div className="flex-1" />
        <label className="flex h-7 w-[280px] items-center gap-1.5 rounded border border-border2 bg-bg px-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent focus-within:outline-solid">
          <span className="text-text3">
            <IconSearch size={13} strokeWidth={1.6} />
          </span>
          <input
            aria-label="Search plans"
            placeholder="Search vessel, voyage, port"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-6 min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-text outline-none"
          />
        </label>
        <span className="text-[12px] text-text2">Singapore planning desk</span>
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => useViewStore.getState().toggleTheme()}
        >
          {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
        </IconButton>
        <AccountMenu />
      </header>

      <main className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-end gap-4 px-5 pt-5 pb-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[20px] font-semibold">Stowage plans</h1>
            <span className="text-[12.5px] text-text2">
              {counts
                ? `${counts.all} voyages · ${counts.draft + counts.in_review} need work`
                : 'Loading voyages…'}
              {next ? (
                <>
                  {' · next departure '}
                  <span className="font-mono text-text">{formatEtd(next.etd)}</span>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex-1" />
          <Button variant="primary" className="h-[30px] px-3" onClick={() => setCreating(true)}>
            New plan
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <Tabs
            label="Status"
            value={tab}
            onChange={(id: Tab) => setTab(id)}
            tabs={TABS.map((t) => ({
              id: t.id,
              label: (
                <>
                  {t.label}{' '}
                  <span className="font-mono text-[11px] text-text3">
                    {counts ? (t.id === 'all' ? counts.all : counts[t.id]) : ''}
                  </span>
                </>
              ),
              name: `${t.label}${counts ? ` ${t.id === 'all' ? counts.all : counts[t.id]}` : ''}`,
            }))}
          />
          <button
            type="button"
            aria-pressed={mine}
            className={toggle(mine)}
            onClick={() => setMine(!mine)}
          >
            Assigned to me
          </button>
          <button
            type="button"
            aria-pressed={issues}
            className={toggle(issues)}
            onClick={() => setIssues(!issues)}
          >
            Has violations
          </button>
          <div className="flex-1" />
          <span className="text-[12px] text-text3">ETD next 14 days · UTC+8</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          {/* The grid holds only rows; the empty and loading states sit after it (axe). */}
          <div role="grid" aria-label="Voyages" aria-rowcount={plans.length + 1}>
            <div
              role="row"
              className={cn(
                COLS,
                'sticky top-0 z-[1] h-8 border-b border-border bg-surface text-[11.5px] text-text2',
              )}
            >
              <span role="columnheader">Vessel</span>
              <span role="columnheader">Voyage</span>
              <span role="columnheader">Port</span>
              <span role="columnheader" aria-sort={asc ? 'ascending' : 'descending'}>
                <button
                  type="button"
                  onClick={() => setAsc(!asc)}
                  className="flex h-6 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] text-text"
                >
                  ETD{' '}
                  <span aria-hidden="true" className="text-[8px]">
                    {asc ? '▲' : '▼'}
                  </span>
                </button>
              </span>
              <span role="columnheader">Progress</span>
              <span role="columnheader">Violations</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Planner</span>
              <span role="columnheader" className="text-right">
                Updated
              </span>
            </div>
            {plans.map((p, i) => {
              const sel = current?.id === p.id;
              const pct = percent(p);
              const due = dueText(p.etd);
              return (
                <div
                  key={p.id}
                  role="row"
                  tabIndex={0}
                  aria-selected={sel}
                  aria-rowindex={i + 2}
                  aria-label={`${p.vessel}, voyage ${p.voyage}, ${p.port}`}
                  data-plan={p.id}
                  onClick={() => setSelected(p.id)}
                  onDoubleClick={() => p.openable && void navigate(`/plans/${p.id}`)}
                  onKeyDown={(e) => onRowKey(e, p)}
                  className={cn(
                    COLS,
                    'h-12 cursor-pointer border-b border-border -outline-offset-2 hover:bg-hover',
                    sel && 'bg-sel shadow-[inset_2px_0_0_var(--accent)]',
                  )}
                >
                  <span role="gridcell" className="flex min-w-0 flex-col gap-px">
                    <span className="truncate font-semibold">{p.vessel}</span>
                    <span className="font-mono text-[11px] text-text2">
                      {p.teu.toLocaleString('en-US')} TEU · IMO {p.imo}
                    </span>
                  </span>
                  <span role="gridcell" className="font-mono text-[12px]">
                    {p.voyage}
                  </span>
                  <span role="gridcell" className="font-mono text-[12px]">
                    {p.port}
                  </span>
                  <span role="gridcell" className="flex flex-col gap-px">
                    <span className="font-mono text-[12px]">{formatEtd(p.etd)}</span>
                    <span className={cn('text-[11px]', due.soon ? 'text-warn' : 'text-text2')}>
                      {due.text}
                    </span>
                  </span>
                  <span role="gridcell" className="flex min-w-0 flex-col gap-1">
                    <span className="flex justify-between font-mono text-[11.5px]">
                      <span>
                        {p.planned.toLocaleString('en-US')} / {p.total.toLocaleString('en-US')}
                      </span>
                      <span className="text-text2">{pct}%</span>
                    </span>
                    <span
                      role="progressbar"
                      aria-label="Planned"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1 overflow-hidden rounded-[2px] bg-track"
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? 'var(--ok)' : 'var(--accent)',
                        }}
                      />
                    </span>
                  </span>
                  <span role="gridcell">
                    <Violations p={p} />
                  </span>
                  <span role="gridcell">
                    {/* On the surface color, so the tint of the badge does not lower its contrast. */}
                    <span className="inline-flex rounded bg-surface">
                      <StatusBadge status={p.status} />
                    </span>
                  </span>
                  <span role="gridcell" className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="grid size-5 flex-none place-items-center rounded-full border border-border2 bg-raised text-[9px] font-semibold text-text2"
                    >
                      {initials(p.planner)}
                    </span>
                    <span
                      className={cn('truncate text-[12px]', p.planner ? 'text-text' : 'text-text3')}
                    >
                      {p.planner ?? 'Unassigned'}
                    </span>
                  </span>
                  <span role="gridcell" className="text-right text-[12px] text-text2">
                    {updatedText(p.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
          {data && plans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-text2">
              <span className="font-semibold text-text">No plans match these filters</span>
              <span>Try another status, or clear the search.</span>
              <Button autoFocus onClick={clear}>
                Clear filters
              </Button>
            </div>
          ) : null}
          {!data && !failed ? (
            <div role="status" aria-busy="true" aria-label="Loading plans">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} aria-hidden="true" className={cn(COLS, 'h-12 border-b border-border')}>
                  {Array.from({ length: 7 }, (_, j) => (
                    <span
                      key={j}
                      className="h-3 rounded-[3px] bg-raised motion-safe:animate-[stw-pulse_1.4s_ease-in-out_infinite]"
                      style={{ width: j === 0 ? `${60 + ((i * 13) % 35)}%` : '70%' }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          {!data && failed ? (
            <p className="m-0 px-5 py-6 text-text2">
              The plans could not be loaded. Use Retry in the message.
            </p>
          ) : null}
        </div>
      </main>

      {current ? (
        <Preview plan={current} onChanged={() => void load()} />
      ) : (
        <aside
          aria-label="Plan preview"
          className="border-l border-border bg-surface p-4 text-text2"
        >
          Select a plan to see its preview.
        </aside>
      )}
      <ToastHost />
      {creating ? (
        <NewPlanDialog
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            setSelected(p.id);
            useViewStore.getState().showToast({
              kind: 'ok',
              title: 'Plan created',
              message: `${p.vessel} · ${p.id} · starts from the arrival condition`,
              action: { label: 'Open plan', run: () => void navigate(`/plans/${p.id}`) },
            });
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
