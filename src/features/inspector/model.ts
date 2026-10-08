import {
  CONTAINER_TYPES,
  fmt1,
  fmtTenths,
  isTop,
  PODS,
  pad,
  parseKey,
  slot40Key,
  stackIdOf,
  stackLimitTenths,
  stackWeightTenths,
  toTenths,
  type Container,
  type PlacementCheck,
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

export type InspectorMode = 'Container' | 'Picked up' | 'Placing';

export interface InspectorModel {
  mode: InspectorMode;
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
  /** The slot of the container, or the target while it is held. */
  slotKey: SlotKey | null;
}

/** Which Inspector actions a placed container allows (FR-48): BR-03, BR-04 and D3. */
export interface ActionRules {
  unplace: boolean;
  lock: 'Lock' | 'Unlock';
  swap: boolean;
}

export function actionRules(ctx: StowContext, state: StowState, key: SlotKey): ActionRules | null {
  const p = state.placements.get(key);
  if (!p) return null;
  return {
    // BR-04 locked stays, BR-03 only the top is lifted, D3 onboard containers stay on board.
    unplace: !p.locked && p.origin !== 'onboard' && isTop(state, ctx, key),
    lock: p.locked ? 'Unlock' : 'Lock',
    // D2: swap is exempt from BR-03 but not BR-04.
    swap: !p.locked,
  };
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
    mode: 'Container',
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

/** The design says "Unplanned" while held. A container lifted from a slot keeps its own status. */
function statusOf(state: StowState, c: Container): string {
  const at = state.slotOf.get(c.id);
  const p = at ? state.placements.get(at) : undefined;
  if (!p) return 'Unplanned';
  return p.origin === 'onboard' ? `Onboard from ${c.pol}` : 'Planned this call';
}

/**
 * The Inspector while a container is in hand: the rule results of the target it is over, as in
 * the design ("Picked up" from the keyboard, "Placing" during a drag).
 */
export function buildHeldInspector(
  ctx: StowContext,
  state: StowState,
  c: Container,
  mode: Exclude<InspectorMode, 'Container'>,
  target: SlotKey | null,
  check: PlacementCheck | null,
): InspectorModel {
  const pod = PODS[c.pod as keyof typeof PODS];
  const type = CONTAINER_TYPES[c.type];
  const t = target ? parseKey(target) : null;
  const deck = t ? t.tier >= 82 : false;
  const stackId = target ? stackIdOf(target) : null;
  const limit = stackId ? stackLimitTenths(ctx, stackId) : 0;
  const sum = check?.target
    ? toTenths(check.stackWeightT)
    : stackId
      ? stackWeightTenths(state, ctx, stackId)
      : 0;
  const sumText = `${fmtTenths(sum)} / ${fmtTenths(limit)} t`;

  const checks: RuleCheck[] = RULES.map(([rule, name]) => {
    if (!check?.target) return { rule, name, tone: 'na', text: '—' };
    if (check.errors.some((e) => e.rule === rule))
      return { rule, name, tone: 'error', text: rule === 'stack' ? sumText : 'Fails' };
    if (check.warnings.some((w) => w.rule === rule))
      return { rule, name, tone: 'warning', text: 'Warning' };
    if ((rule === 'reefer' && c.type !== 'RF') || (rule === 'dg' && !c.imdgClass))
      return { rule, name, tone: 'na', text: 'n/a' };
    return { rule, name, tone: 'ok', text: rule === 'stack' ? sumText : 'OK' };
  });
  const errors = checks.filter((k) => k.tone === 'error').length;
  const warnings = checks.filter((k) => k.tone === 'warning').length;
  const mx = Math.max(limit * 1.15, sum) || 1;

  return {
    mode,
    id: c.id,
    pod: { code: c.pod, short: pod?.short ?? c.pod, name: pod?.name ?? c.pod },
    iso: type.iso,
    weight: fmt1(c.weightT),
    locked: false,
    status: errors
      ? { text: `${errors} error${errors > 1 ? 's' : ''}`, tone: 'error' }
      : warnings
        ? { text: `${warnings} warning`, tone: 'warning' }
        : check?.target
          ? { text: 'Valid target', tone: 'ok' }
          : { text: 'No target', tone: 'warning' },
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
      { label: 'Status', value: statusOf(state, c) },
    ],
    slot: {
      title: target ? `Target ${target}` : 'No target',
      note: target ? (ctx.geometry.hasPlug(target) ? 'Reefer plug' : 'No plug') : '',
      parts: t
        ? [
            { value: pad(t.bay), label: `Bay · ${c.lengthFt}ft` },
            { value: pad(t.row), label: `Row · ${t.row % 2 ? 'Stbd' : 'Port'}` },
            { value: pad(t.tier), label: `Tier · ${deck ? 'Deck' : 'Hold'}` },
          ]
        : [],
    },
    stack: {
      label:
        t && target
          ? `Stack ${pad(+slot40Key(target).slice(0, 2))}-${pad(t.row)} ${deck ? 'deck' : 'hold'}`
          : '',
      text: target ? sumText : '',
      percent: (sum / mx) * 100,
      limitPercent: (limit / mx) * 100,
      tone: sum > limit ? 'err' : sum > limit * 0.9 ? 'warn' : 'accent',
    },
    checks,
    slotKey: target,
  };
}
