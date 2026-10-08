import { Link } from 'react-router';
import { AccountMenu } from './AccountMenu';

/** The header of the pages that show no workspace yet: the logo, "All plans / id" and the account (design 14). */
export function PageHeader({ planId }: { planId: string }) {
  return (
    <header className="flex h-12 flex-none items-center gap-3 border-b border-border bg-surface px-3">
      <Link
        to="/plans"
        aria-label="Stowline, all plans"
        className="flex items-center gap-2 text-text no-underline"
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
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px]">
        <Link to="/plans" className="text-accent no-underline hover:underline">
          All plans
        </Link>
        <span aria-hidden="true" className="text-text3">
          /
        </span>
        <span className="font-mono" aria-current="page">
          {planId}
        </span>
      </nav>
      <div className="flex-1" />
      <AccountMenu />
    </header>
  );
}
