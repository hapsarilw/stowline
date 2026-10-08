import { describe, expect, it } from 'vitest';
import { applyCommand, calibrateStability, computeStability } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import {
  curvePath,
  draftDiagram,
  drawerStatus,
  gmDial,
  hydrostatics,
  listDial,
  strengthChart,
  trimBar,
  trimText,
} from './drawer';

const { ctx, state } = sampleSetup();
const base = calibrateStability(state, ctx);
const r = computeStability(state, ctx, base);
const L = ctx.vessel.limits;

describe('strength chart (FR-53, FR-54)', () => {
  const chart = strengthChart(r.bmCurve, r.sfCurve, ctx, 18);

  it('draws one point per station, bow on the left, 0% on the middle line', () => {
    expect(curvePath([0, 50, -100])).toBe('M0.0,110.0 L300.0,60.0 L600.0,210.0');
    const points = chart.bmPath.split(' ');
    expect(points).toHaveLength(61);
    expect(points[0]).toBe('M0.0,110.0');
    expect(points.at(-1)).toBe('L600.0,110.0');
  });

  it('keeps a curve inside the chart when it passes the limit', () => {
    expect(curvePath([0, 140, -130])).toBe('M0.0,110.0 L300.0,0.0 L600.0,220.0');
  });

  it('labels the peaks as design 05: BM 78%, SF +64% and the negative SF peak', () => {
    expect(chart.peaks.map((p) => p.text)).toEqual([
      'BM 78%',
      'SF +64%',
      expect.stringMatching(/^SF −\d+%$/) as string,
    ]);
    expect(chart.label).toBe(
      'Bending moment peaks at 78 percent, shear force at 64 percent of limit',
    );
    for (const p of chart.peaks) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThanOrEqual(100);
    }
  });

  it('shades the selected bay and labels every third bay: 02, 14, 26 … 86', () => {
    expect(chart.bays.map((b) => b.label)).toEqual([
      '02',
      '14',
      '26',
      '38',
      '50',
      '62',
      '74',
      '86',
    ]);
    const b18 = strengthChart(r.bmCurve, r.sfCurve, ctx, 18).bandX;
    const b62 = strengthChart(r.bmCurve, r.sfCurve, ctx, 62).bandX;
    expect(b18).toBeGreaterThan(0);
    expect(b62).toBeGreaterThan(b18);
    expect(b62).toBeLessThan(600);
  });

  it('follows the weight per bay (FR-54)', () => {
    const moved = applyCommand(
      state,
      ctx,
      { kind: 'move', from: '140484', to: '060488' },
      { check: false },
    );
    if (!moved.ok) throw new Error(moved.reason);
    const after = computeStability(moved.state, ctx, base);
    expect(strengthChart(after.bmCurve, after.sfCurve, ctx, 18).bmPath).not.toBe(chart.bmPath);
  });
});

describe('draft and dials', () => {
  it('reads 12.10, 12.41 and 12.72 m with 0.62 m by stern, as design 05', () => {
    expect([r.draftFwd, r.draftMean, r.draftAft].map((d) => d.toFixed(2))).toEqual([
      '12.10',
      '12.41',
      '12.72',
    ]);
    expect(trimText(r.trim)).toBe('0.62 m by stern');
    expect(trimText(-0.3)).toBe('0.30 m by head');
    const d = draftDiagram(r, 14.5);
    // By the stern: the waterline is lower at the bow (left) than at the stern, drawn 8 times larger.
    expect(Number(d.y1)).toBeGreaterThan(Number(d.y2));
    expect(Number(d.y1) - Number(d.y2)).toBeCloseTo(r.trim * 8 * 3.92, 0);
    expect(d.summerY).toBe((140 - 14.5 * 3.92).toFixed(1));
  });

  it('puts the GM needle in the green and the list needle to port', () => {
    const gm = gmDial(1.84, L);
    expect(Number(gm.needle.x)).toBeGreaterThan(100); // past half way: 1.84 of 3 m
    expect(gm.red.startsWith('M24.0,96.0')).toBe(true);
    const list = listDial(0.4, L);
    expect(Number(list.needle.x)).toBeLessThan(100); // port is on the left
    expect(Number(listDial(-0.4, L).needle.x)).toBeGreaterThan(100);
    expect(Number(listDial(9, L).needle.x)).toBeCloseTo(34, 0); // clamped at 5°: the needle is 66 long
  });

  it('gives the state lines and the trim bar of design 05', () => {
    expect(drawerStatus(r, L)).toEqual({
      gm: { state: 'ok', text: 'OK · min 1.20 m' },
      list: { state: 'check', text: 'Check · crane limit 0.3°' },
      trim: { state: 'ok', text: 'OK · limit ±1.50 m' },
    });
    const bar = trimBar(0.62, L);
    expect(bar.okLeft).toBeCloseTo(16.7, 1);
    expect(bar.okRight).toBeCloseTo(16.7, 1);
    expect(bar.mark).toBeCloseTo(70.7, 1);
  });

  it('lists the hydrostatics of design 05 for the seeded plan', () => {
    expect(hydrostatics(r, ctx.vessel.hydrostatics)).toEqual([
      { label: 'Displacement', value: '98,420 t' },
      { label: 'Deadweight', value: '71,260 t' },
      { label: 'KM', value: '17.46 m' },
      { label: 'KG (fluid)', value: '15.62 m' },
      { label: 'GM', value: '1.84 m' },
      { label: 'Summer draft', value: '14.50 m' },
    ]);
  });
});
