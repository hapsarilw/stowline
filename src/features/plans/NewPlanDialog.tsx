import { useEffect, useState } from 'react';
import { isApiError } from '@/api/errors';
import type { PlanSummary, VesselSummary } from '@/api/types';
import { ROTATION } from '@/domain';
import { api, request } from '@/state/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

/** New plan (FR-05): a Draft for a vessel, voyage and port, from the vessel's arrival condition. */
export function NewPlanDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: PlanSummary) => void;
}) {
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [vesselId, setVesselId] = useState('');
  const [voyage, setVoyage] = useState('');
  const [port, setPort] = useState('LKCMB');
  const [etd, setEtd] = useState('2026-10-20T10:00');
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

  const field = 'h-8 rounded border border-border2 bg-bg px-2 text-[12.5px] text-text';
  const err = (k: string) =>
    errors[k] ? (
      <span id={`np-${k}`} role="alert" className="text-err">
        {errors[k]}
      </span>
    ) : null;
  const props = (k: string) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `np-${k}` : undefined,
  });
  return (
    <Dialog
      title="New plan"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !vesselId} onClick={() => void submit()}>
            Create plan
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Vessel</span>
          <select
            className={field}
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
            className={field}
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
            className={field}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            {...props('port')}
          >
            {ROTATION.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          {err('port')}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">ETD (UTC+8)</span>
          <input
            className={field}
            type="datetime-local"
            value={etd}
            onChange={(e) => setEtd(e.target.value)}
            {...props('etd')}
          />
          {err('etd')}
        </label>
        <p className="m-0 text-text2">
          The plan starts from the vessel's arrival condition: the containers already on board from
          earlier ports.
        </p>
      </form>
    </Dialog>
  );
}
