import { describe, expect, it } from 'vitest';
import {
  activityTime,
  dueText,
  formatEtd,
  initials,
  percent,
  stabilityCards,
  updatedText,
  violationsText,
} from './model';

describe('plans list model (FR-01)', () => {
  it('prints the ETD in UTC+8, whatever the zone of the string', () => {
    expect(formatEtd('2026-10-08T22:00:00+08:00')).toBe('08 Oct 22:00');
    expect(formatEtd('2026-10-08T14:00:00Z')).toBe('08 Oct 22:00');
    expect(formatEtd('2026-10-09T06:00:00+08:00')).toBe('09 Oct 06:00');
  });

  it('counts the days from the design day, as its column does', () => {
    const days = [
      '2026-10-08T22:00',
      '2026-10-09T06:00',
      '2026-10-10T14:30',
      '2026-10-10T23:00',
      '2026-10-11T08:00',
      '2026-10-12T18:00',
      '2026-10-13T04:00',
      '2026-10-13T20:00',
      '2026-10-14T10:00',
      '2026-10-15T12:00',
      '2026-10-16T02:00',
      '2026-10-17T15:00',
    ];
    expect(days.map((d) => dueText(`${d}:00+08:00`).text)).toEqual([
      'Tomorrow',
      'in 2 days',
      'in 3 days',
      'in 3 days',
      'in 4 days',
      'in 5 days',
      'in 6 days',
      'in 6 days',
      'in 7 days',
      'in 8 days',
      'in 9 days',
      'in 10 days',
    ]);
    expect(dueText('2026-10-08T22:00:00+08:00').soon).toBe(true);
    expect(dueText('2026-10-12T22:00:00+08:00').soon).toBe(false);
    expect(dueText('2026-10-07T10:00:00+08:00').text).toBe('Today');
    expect(dueText('2026-10-05T10:00:00+08:00').text).toBe('2 days ago');
  });

  it('words the violation counts, progress and planner as the design', () => {
    expect(violationsText({ errors: 6, warnings: 1 })).toEqual({
      text: '6 err · 1 w',
      tone: 'error',
    });
    expect(violationsText({ errors: 9, warnings: 0 })).toEqual({ text: '9 err', tone: 'error' });
    expect(violationsText({ errors: 0, warnings: 2 })).toEqual({ text: '2 warn', tone: 'warning' });
    expect(violationsText({ errors: 0, warnings: 0 })).toEqual({ text: 'Clear', tone: 'ok' });
    expect(percent({ planned: 312, total: 1240 })).toBe(25);
    expect(percent({ planned: 0, total: 0 })).toBe(0);
    expect(initials('Rina Adiputri')).toBe('RA');
    expect(initials(null)).toBe('—');
  });

  it('words the time since the last change', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    const ago = (min: number) => new Date(now - min * 60_000).toISOString();
    expect([2, 18, 60, 180, 1800, 2880, 4320].map((m) => updatedText(ago(m), now))).toEqual([
      '2 min',
      '18 min',
      '1 h',
      '3 h',
      'Yesterday',
      '2 d',
      '3 d',
    ]);
    expect(updatedText(null, now)).toBe('—');
    expect(updatedText(ago(0), now)).toBe('Just now');
  });

  it('prints the stability cards of the preview', () => {
    expect(
      stabilityCards({
        gm: 1.84,
        trim: 0.62,
        list: 0.4,
        gmState: 'ok',
        trimState: 'ok',
        listState: 'check',
      }),
    ).toEqual([
      { k: 'GM', v: '1.84 m', state: 'ok' },
      { k: 'Trim', v: '0.62 m S', state: 'ok' },
      { k: 'List', v: '0.4° P', state: 'check' },
    ]);
    expect(
      stabilityCards({
        gm: 1.5,
        trim: -0.3,
        list: -0.2,
        gmState: 'ok',
        trimState: 'ok',
        listState: 'ok',
      })[1]!.v,
    ).toBe('0.30 m H');
  });

  it('prints the activity time, or the weekday for an earlier day', () => {
    expect(activityTime('2026-10-07T14:20:00+08:00', '2026-10-07T14:32:00+08:00')).toBe('14:20');
    expect(activityTime('2026-10-05T09:00:00+08:00', '2026-10-07T12:40:00+08:00')).toBe('Mon');
  });
});
