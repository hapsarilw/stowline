import { useEffect, useState } from 'react';
import { isApiError } from '@/api/errors';
import type { PlanSummary, VesselSummary } from '@/api/types';
import { plural, ROTATION, roleInfo } from '@/domain';
import { api, request } from '@/state/api';
import { useSessionStore } from '@/state/session-store';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { Dialog } from '@/ui/Dialog';
import { IconError, IconInfo } from '@/ui/icons';

const two = (n: number) => String(n).padStart(2, '0');

/** A week from now at 22:00 UTC+8, as "2026-10-15T22:00", for the ETD field. */
function defaultEtd(now = Date.now()): string {
  const d = new Date(now + 7 * 86_400_000 + 8 * 3_600_000);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T22:00`;
}

/** New plan (FR-05, design 13): a Draft for a vessel, voyage and port, from the vessel's arrival condition. */
export function NewPlanDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: PlanSummary) => void;
}) {
  const role = useSessionStore((s) => s.role);
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [vesselId, setVesselId] = useState('');
  const [voyage, setVoyage] = useState('');
  const [port, setPort] = useState('LKCMB');
  const [etd, setEtd] = useState(defaultEtd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async function load() {
      const r = await request(
        () => api.listVessels(),
        () => void load(),
      );
      if (r.ok) {
        setVessels(r.data);
        setVesselId((v) => v || r.data[0]?.id || '');
      }
    })();
  }, []);

  const submit = async () => {
    setBusy(true);
    const r = await request(
      () =>
        api.createPlan({
          vesselId,
          voyage: voyage.trim().toUpperCase(),
          port,
          etd: `${etd}:00+08:00`,
        }),
      () => void submit(),
      (e) => isApiError(e) && e.status === 422,
    );
    setBusy(false);
    if (r.ok) onCreated(r.data);
    else if (isApiError(r.error))
      setErrors(
        (r.error.details?.fields as Record<string, string> | undefined) ?? {
          voyage: r.error.message,
        },
      );
  };

  const field = (k: string) =>
    cn(
      'h-8 rounded border bg-bg px-2 text-[12.5px] text-text',
      errors[k] ? 'border-err' : 'border-border2',
    );
  const err = (k: string) =>
    errors[k] ? (
      <span id={`np-${k}`} role="alert" className="flex items-center gap-1.5 text-[12px] text-err">
        <IconError size={12} />
        {errors[k]}
      </span>
    ) : null;
  const props = (k: string) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `np-${k}` : undefined,
  });
  const count = Object.keys(errors).length;
  return (
    <Dialog
      title="New plan"
      width={560}
      onClose={onClose}
      footer={
        <>
          {count ? (
            <span className="mr-auto flex items-center gap-1.5 text-[12px] text-err">
              <IconError size={12} />
              {plural(count, 'field')} {count === 1 ? 'needs' : 'need'} fixing
            </span>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !vesselId} onClick={() => void submit()}>
            Create plan
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-x-3 gap-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="col-span-2 flex flex-col gap-1">
          <span className="font-semibold">Vessel</span>
          <select
            className={field('vesselId')}
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            {...props('vesselId')}
          >
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.teu.toLocaleString('en-US')} TEU
              </option>
            ))}
          </select>
          {err('vesselId')}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Voyage</span>
          <input
            data-autofocus
            className={cn(field('voyage'), 'font-mono')}
            placeholder="043W"
            value={voyage}
            onChange={(e) => setVoyage(e.target.value)}
            {...props('voyage')}
          />
          {err('voyage')}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Port</span>
          <select
            className={field('port')}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            {...props('port')}
          >
            {ROTATION.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} · {p.code}
              </option>
            ))}
          </select>
          {err('port')}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">
            ETD <span className="font-normal text-text2">local, UTC+8</span>
          </span>
          <input
            className={cn(field('etd'), 'font-mono')}
            type="datetime-local"
            value={etd}
            onChange={(e) => setEtd(e.target.value)}
            {...props('etd')}
          />
          {err('etd')}
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Planner</span>
          <span className="flex h-8 items-center rounded border border-border bg-raised px-2 text-text2">
            {roleInfo(role).user}
          </span>
        </div>
        <p
          role="note"
          className="col-span-2 m-0 flex items-start gap-2 rounded border border-border bg-raised p-2.5 text-[12px] text-text2"
        >
          <span className="mt-px grid flex-none">
            <IconInfo size={14} />
          </span>
          The plan starts from the vessel's arrival condition: the containers already on board from
          earlier ports.
        </p>
      </form>
    </Dialog>
  );
}
