import {
  CONTAINER_TYPES,
  fmt1,
  fmtTenths,
  PODS,
  pad,
  parseKey,
  slot40Key,
  stackIdOf,
  stackLimitTenths,
  stackWeightTenths,
  type SlotKey,
  type StowContext,
  type StowState,
  type Violation,
} from '@/domain';
import type { StatusTone } from '@/ui/Badges';

// What the Inspector shows for the selected container (FR-46, FR-47). Pure, so the rule
// results can be tested without a browser.

export interface RuleCheck {
  rule: string;
  name: string;
  tone: StatusTone;
  text: string;
}

export interface InspectorModel {
  id: string;
  pod: { code: string; short: string; name: string };
  iso: string;
  weight: string;
  locked: boolean;
  status: { text: string; tone: 'error' | 'warning' | 'ok' };
  fields: { label: string; value: string }[];
  slot: { title: string; note: string; parts: { value: string; label: string }[] };
  stack: {
    label: string;
    text: string;
    percent: number;
    limitPercent: number;
    tone: 'err' | 'warn' | 'accent';
  };
  checks: RuleCheck[];
  /** The 40ft slot of the container, for stack lookups. */
  slotKey: SlotKey;
}

const RULES = [
  ['stack', 'Stack weight'],
  ['reefer', 'Reefer power'],
  ['dg', 'DG segregation'],
  ['overstow', 'Overstow'],
  ['twenty', '20/40 stacking'],
  ['heavy', 'Weight order'],
] as const;

export function formatSetPoint(c: number): string {
  return `${c < 0 ? '−' : '+'}${Math.abs(c).toFixed(1)} °C`;
}

export function buildInspector(
  ctx: StowContext,
  state: StowState,
  violations: readonly Violation[],
  sel: SlotKey | null,
): InspectorModel | null {
  const placement = sel ? state.placements.get(sel) : undefined;
  if (!sel || !placement) return null;
  const c = ctx.containers.get(placement.containerId);
  if (!c) return null;

  const pod = PODS[c.pod as keyof typeof PODS];
  const type = CONTAINER_TYPES[c.type];
  const { bay, row, tier } = parseKey(sel);
  const deck = tier >= 82;
  const stackId = stackIdOf(sel);
  const sum = stackWeightTenths(state, ctx, stackId);
  const limit = stackLimitTenths(ctx, stackId);
  const mine = violations.filter((v) => v.slotKeys.includes(sel));

  const checks: RuleCheck[] = RULES.map(([rule, name]) => {
    const v = mine.find((x) => x.rule === rule);
    const sumText = `${fmtTenths(sum)} / ${fmtTenths(limit)} t`;
    if (v) {
      const tone: StatusTone = v.severity === 'error' ? 'error' : 'warning';
      let text = '';
      if (rule === 'stack') text = sumText;
      else if (rule === 'overstow')
        text = `${v.data?.restows ?? 0} restow${v.data?.restows === 1 ? '' : 's'}`;
      else if (rule === 'heavy') {
        const upper = ctx.containers.get(state.placements.get(v.slot)?.containerId ?? '');
        const lower = ctx.containers.get(
          state.placements.get(v.slotKeys[1] ?? '')?.containerId ?? '',
        );
        text = upper && lower ? `+${fmt1(upper.weightT - lower.weightT)} t` : 'Heavy';
      } else if (rule === 'reefer') text = 'No plug';
      else if (rule === 'dg') text = 'Too close';
      else text = v.message.includes('empty half') ? 'Empty half' : 'On 40ft';
      return { rule, name, tone, text };
    }
    if (rule === 'reefer')
      return c.type === 'RF'
        ? { rule, name, tone: 'ok', text: 'Plug OK' }
        : { rule, name, tone: 'na', text: 'n/a' };
    if (rule === 'dg')
      return c.imdgClass
        ? { rule, name, tone: 'ok', text: 'OK' }
        : { rule, name, tone: 'na', text: 'n/a' };
    return { rule, name, tone: 'ok', text: rule === 'stack' ? sumText : 'OK' };
  });

  const errors = checks.filter((k) => k.tone === 'error').length;
  const warnings = checks.filter((k) => k.tone === 'warning').length;
  const mx = Math.max(limit * 1.15, sum);

  return {
    id: c.id,
    pod: { code: c.pod, short: pod?.short ?? c.pod, name: pod?.name ?? c.pod },
    iso: type.iso,
    weight: fmt1(c.weightT),
    locked: placement.locked,
    status: errors
      ? { text: `${errors} error${errors > 1 ? 's' : ''}`, tone: 'error' }
      : warnings
        ? { text: `${warnings} warning`, tone: 'warning' }
        : { text: 'All checks pass', tone: 'ok' },
    fields: [
      { label: 'Type', value: `${c.type} · ${type.height}` },
      { label: 'ISO code', value: type.iso },
      { label: 'VGM', value: `${fmt1(c.weightT)} t` },
      { label: 'POL', value: c.pol },
      { label: 'POD', value: `${c.pod} · ${pod?.name ?? c.pod}` },
      {
        label: 'Reefer',
        value: c.reeferSetPointC === undefined ? 'No' : formatSetPoint(c.reeferSetPointC),
      },
      { label: 'Dangerous goods', value: c.imdgClass ? `IMDG ${c.imdgClass}` : 'None' },
      {
        label: 'Status',
        value: placement.origin === 'onboard' ? `Onboard from ${c.pol}` : 'Planned this call',
      },
    ],
    slot: {
      title: `Slot ${sel}`,
      note: ctx.geometry.hasPlug(sel) ? 'Reefer plug' : 'No plug',
      parts: [
        { value: pad(bay), label: `Bay · ${c.lengthFt}ft` },
        { value: pad(row), label: `Row · ${row % 2 ? 'Stbd' : 'Port'}` },
        { value: pad(tier), label: `Tier · ${deck ? 'Deck' : 'Hold'}` },
      ],
    },
    stack: {
      label: `Stack ${pad(+slot40Key(sel).slice(0, 2))}-${pad(row)} ${deck ? 'deck' : 'hold'}`,
      text: `${fmtTenths(sum)} / ${fmtTenths(limit)} t`,
      percent: (sum / mx) * 100,
      limitPercent: (limit / mx) * 100,
      tone: sum > limit ? 'err' : sum > limit * 0.9 ? 'warn' : 'accent',
    },
    checks,
    slotKey: sel,
  };
}
