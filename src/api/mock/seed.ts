import {
  calibrateStability,
  createStowContext,
  createStowState,
  generateSampleCall,
} from '@/domain';
import type { ActivityEntry, PlanPreview } from '../types';
import type { PlanRecord, VesselRecord } from './storage';

// The 12 voyages of design/Stowline Plans.dc.html. Only the first has vessel geometry and
// placements (decision D11); the others keep their numbers.

type Row = [
  string,
  number,
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  'draft' | 'in_review' | 'approved',
  string,
  number | null,
];

// vessel, TEU, voyage, port, ETD (UTC+8), planned, total, errors, warnings, status, planner, minutes since last change
const ROWS: Row[] = [
  [
    'MV Nusantara Pioneer',
    8500,
    '042W',
    'SGSIN',
    '2026-10-08T22:00',
    312,
    1240,
    6,
    1,
    'draft',
    'Rina Adiputri',
    2,
  ],
  [
    'MV Selat Meridian',
    6200,
    '118E',
    'IDJKT',
    '2026-10-09T06:00',
    1804,
    1960,
    0,
    2,
    'in_review',
    'Dimas Hartono',
    18,
  ],
  [
    'MV Arafura Dawn',
    4250,
    '077W',
    'LKCMB',
    '2026-10-10T14:30',
    940,
    940,
    0,
    0,
    'approved',
    'Priya Nair',
    60,
  ],
  [
    'MV Banda Horizon',
    8500,
    '203N',
    'SGSIN',
    '2026-10-10T23:00',
    486,
    1322,
    9,
    2,
    'draft',
    'Rina Adiputri',
    180,
  ],
  [
    'MV Sunda Voyager',
    10100,
    '015W',
    'AEJEA',
    '2026-10-11T08:00',
    2110,
    2210,
    1,
    0,
    'in_review',
    'Omar Haddad',
    300,
  ],
  [
    'MV Malacca Crest',
    13800,
    '064E',
    'NLRTM',
    '2026-10-12T18:00',
    3020,
    3020,
    0,
    0,
    'approved',
    'Lena Vos',
    1800,
  ],
  ['MV Andaman Reach', 5600, '131W', 'LKCMB', '2026-10-13T04:00', 0, 1105, 0, 0, 'draft', '', null],
  [
    'MV Coral Tern',
    2800,
    '009S',
    'SGSIN',
    '2026-10-13T20:00',
    1288,
    1410,
    3,
    1,
    'draft',
    'Kevin Lim',
    1800,
  ],
  [
    'MV Timor Lantern',
    3400,
    '052W',
    'IDJKT',
    '2026-10-14T10:00',
    760,
    760,
    0,
    0,
    'approved',
    'Dimas Hartono',
    2880,
  ],
  [
    'MV Natuna Ridge',
    9000,
    '088E',
    'DEHAM',
    '2026-10-15T12:00',
    1950,
    2480,
    2,
    1,
    'in_review',
    'Lena Vos',
    2880,
  ],
  [
    'MV Laut Biru',
    6700,
    '027W',
    'AEJEA',
    '2026-10-16T02:00',
    410,
    1630,
    0,
    0,
    'draft',
    'Rina Adiputri',
    4320,
  ],
  ['MV Riau Spirit', 4800, '140N', 'SGSIN', '2026-10-17T15:00', 0, 890, 0, 0, 'draft', '', null],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/^mv /, '')
    .replace(/[^a-z0-9]+/g, '-');

/** A fictional IMO number (decision D13): 9000000 for the sample vessel, then 9000137 and so on. */
const imoOf = (i: number) => `9${String(i * 137).padStart(6, '0')}`;

function state(g: number, t: number, l: number) {
  const gm = (v: number) => (v < 1.2 ? 'limit' : v < 1.4 ? 'check' : 'ok');
  const tr = (v: number) => (Math.abs(v) > 1.5 ? 'limit' : Math.abs(v) > 1 ? 'check' : 'ok');
  const li = (v: number) => (Math.abs(v) >= 2 ? 'limit' : Math.abs(v) > 0.3 ? 'check' : 'ok');
  return { gm: g, trim: t, list: l, gmState: gm(g), trimState: tr(t), listState: li(l) } as const;
}

/** The preview of a plan without data: the design's generator, with its seed per row. */
function syntheticPreview(
  i: number,
  planned: number,
  total: number,
  errors: number,
  warnings: number,
): PlanPreview {
  let seed = i * 7 + 3;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const prog = planned / total;
  const bayFill = Array.from({ length: 22 }, (_, k) => {
    const full = k / 22 < prog * 1.15 || prog === 1;
    const d = full ? 55 + rnd() * 40 : rnd() * 15;
    const h = full ? 90 : 20 + rnd() * 30;
    return { deck: d / 100, hold: h / 100 };
  });
  return {
    bayFill,
    errorBays: errors ? [2, 4] : [],
    stability: state(1.5 + (i % 5) * 0.21, 0.2 + (i % 4) * 0.13, 0.1 * (i % 3)),
    violationsByRule: [
      ...(errors ? [{ label: 'Errors', severity: 'error' as const, count: errors }] : []),
      ...(warnings ? [{ label: 'Warnings', severity: 'warning' as const, count: warnings }] : []),
    ],
  };
}

const at = (day: string, hhmm: string) => `2026-${day}T${hhmm}:00+08:00`;

function activityFor(i: number, planner: string): ActivityEntry[] {
  if (i === 0)
    return [
      {
        at: at('10-07', '14:32'),
        user: 'Rina Adiputri',
        text: 'Rina Adiputri validated the plan: 6 errors, 1 warning',
      },
      { at: at('10-07', '14:20'), user: 'Rina Adiputri', text: 'Moved NSPU 615540 9 to 180484' },
      {
        at: at('10-07', '13:05'),
        user: 'Rina Adiputri',
        text: 'Imported SGSIN load list, 1,240 containers',
      },
      {
        at: at('10-07', '09:12'),
        user: 'Rina Adiputri',
        text: 'Plan created from IDJKT departure BAPLIE',
      },
    ];
  const who = planner || 'Planning desk';
  return [
    {
      at: at('10-07', '12:40'),
      user: who,
      text: `${planner || 'The planning desk'} updated the plan`,
    },
    { at: at('10-07', '08:15'), user: 'Terminal', text: 'Load list revised by terminal' },
    { at: at('10-05', '09:00'), user: who, text: 'Plan created' },
  ];
}

/** The records a fresh mock starts with. `now` is when the seed is made, for "2 min ago". */
export function seedRecords(now = Date.now()): { plans: PlanRecord[]; vessels: VesselRecord[] } {
  const call = generateSampleCall();
  const ctx = createStowContext({
    vessel: call.vessel,
    containers: [...call.containers, ...call.loadList.map((x) => x.container)],
    placements: call.plan.placements,
  });
  const seedState = createStowState(call.plan.placements, call.plan.shiftCount);
  const stabilityBase = calibrateStability(seedState, ctx);

  const plans: PlanRecord[] = ROWS.map((r, i) => {
    const [
      vessel,
      teu,
      voyage,
      port,
      etd,
      planned,
      total,
      errors,
      warnings,
      status,
      planner,
      minutes,
    ] = r;
    const base = {
      id: `${voyage}-${port}`,
      vesselId: i === 0 ? call.vessel.id : slug(vessel),
      vessel,
      teu,
      imo: i === 0 ? call.vessel.imo : imoOf(i),
      voyage,
      port,
      etd: `${etd}:00+08:00`,
      status,
      version: i === 0 ? call.plan.version : 3 + (i % 9),
      planner: planner || null,
      updatedAt: minutes === null ? null : new Date(now - minutes * 60_000).toISOString(),
      updatedBy: planner || null,
      activity: activityFor(i, planner),
    };
    if (i === 0)
      return {
        ...base,
        data: {
          placements: call.plan.placements,
          shiftCount: call.plan.shiftCount,
          containers: call.containers,
          loadList: call.loadList.map((x) => x.container),
          stabilityBase,
        },
        fixed: null,
      };
    return {
      ...base,
      data: null,
      fixed: {
        planned,
        total,
        errors,
        warnings,
        preview: syntheticPreview(i, planned, total, errors, warnings),
      },
    };
  });

  const arrivalPlacements = call.plan.placements.filter((p) => p.origin === 'onboard');
  const onboardIds = new Set(arrivalPlacements.map((p) => p.containerId));
  const vessels: VesselRecord[] = [
    {
      id: call.vessel.id,
      vessel: call.vessel,
      stabilityBase,
      arrival: {
        containers: call.containers.filter((c) => onboardIds.has(c.id)),
        placements: arrivalPlacements,
      },
    },
  ];
  return { plans, vessels };
}
