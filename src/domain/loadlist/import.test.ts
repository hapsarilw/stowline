import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseLoadListFile, MAX_REASON_ID } from './import';

const opts = { port: 'SGSIN', existingIds: new Set<string>() };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'NSPU 482913 5',
  type: '40HC',
  weightT: 21.4,
  pod: 'AEJEA',
  ...over,
});
const parse = (rows: unknown, o = opts) => parseLoadListFile(JSON.stringify(rows), o);

describe('file shape', () => {
  it('is not valid JSON: an error, no rows (422)', () => {
    expect(parseLoadListFile('{nope', opts)).toEqual({
      ok: false,
      message: 'The file is not valid JSON.',
    });
    expect(parseLoadListFile('42', opts)).toMatchObject({ ok: false });
    expect(parseLoadListFile('{"rows": 3}', opts)).toMatchObject({ ok: false });
  });

  it('takes a list of rows, or an object with a containers list', () => {
    const a = parse([row()]);
    const b = parse({ containers: [row()] });
    expect(a).toMatchObject({ ok: true, accepted: [{ id: 'NSPU 482913 5' }] });
    expect(b).toEqual(a);
  });
});

describe('row checks (FR-64)', () => {
  const reason = (r: Record<string, unknown>, o = opts) => {
    const res = parse([r], o);
    return res.ok ? (res.rejected[0]?.reason ?? null) : 'file';
  };

  it('accepts a good row and fills in the container fields', () => {
    const res = parse([row({ type: 'RF', reeferSetPointC: -18, imdgClass: '3' })]);
    expect(res).toMatchObject({ ok: true, rejected: [] });
    if (!res.ok) return;
    expect(res.accepted[0]).toEqual({
      id: 'NSPU 482913 5',
      type: 'RF',
      isoCode: '45R1',
      lengthFt: 40,
      weightT: 21.4,
      pol: 'SGSIN',
      pod: 'AEJEA',
      reeferSetPointC: -18,
      imdgClass: '3',
    });
    expect(
      (parse([row({ type: '20GP' })]) as { accepted: { lengthFt: number }[] }).accepted[0]!
        .lengthFt,
    ).toBe(20);
  });

  it('checks the ID format: 4 letters, 6 digits, 1 check digit', () => {
    for (const id of [
      'NSPU 48291 5',
      'nspu 482913 5',
      'NSPU4829135',
      'NSP 482913 5',
      'NSPU 482913 55',
      42,
      null,
    ])
      expect(reason(row({ id }))).toBe('A container ID is 4 letters, 6 digits and a check digit.');
  });

  it('checks the type, the weight range 2.0 to 35.0 and the POD', () => {
    expect(reason(row({ type: '45XX' }))).toMatch(
      /^Type must be one of 20GP, 40GP, 40HC, RF, TK, OT/,
    );
    expect(reason(row({ weightT: 1.9 }))).toBe('Weight must be between 2.0 and 35.0 t.');
    expect(reason(row({ weightT: 35.1 }))).toBe('Weight must be between 2.0 and 35.0 t.');
    expect(reason(row({ weightT: '20' }))).toBe('Weight must be between 2.0 and 35.0 t.');
    expect(reason(row({ weightT: 2 }))).toBeNull();
    expect(reason(row({ weightT: 35 }))).toBeNull();
    expect(reason(row({ pod: 'SGSIN' }))).toBe('POD must be a port after SGSIN in the rotation.');
    expect(reason(row({ pod: 'IDJKT' }))).toBe('POD must be a port after SGSIN in the rotation.');
    expect(reason(row({ pod: 'DEBRV' }))).toBe('POD DEBRV is not in the rotation.');
    expect(reason(row({ pod: 7 }))).toBe('POD 7 is not in the rotation.');
    expect(reason(row({ pod: 'LKCMB' }), { ...opts, port: 'LKCMB' })).toBe(
      'POD must be a port after LKCMB in the rotation.',
    );
    expect(reason(row({ pod: 'DEHAM' }), { ...opts, port: 'LKCMB' })).toBeNull();
  });

  it('needs a set point for a reefer, and a known class for dangerous goods', () => {
    expect(reason(row({ type: 'RF' }))).toBe('A reefer needs a set point in °C.');
    expect(reason(row({ type: 'RF', reeferSetPointC: 'cold' }))).toBe(
      'A reefer needs a set point in °C.',
    );
    expect(reason(row({ imdgClass: '99' }))).toBe('IMDG class 99 is not a known class.');
    expect(reason(row({ imdgClass: '5.1' }))).toBeNull();
  });

  it('rejects a repeated ID in the file and an ID already on the plan', () => {
    const res = parse([row(), row({ weightT: 20 }), row({ id: 'NSPU 111111 1' })]);
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    expect(res.accepted.map((c) => c.id)).toEqual(['NSPU 482913 5', 'NSPU 111111 1']);
    expect(res.rejected).toEqual([
      { row: 2, id: 'NSPU 482913 5', reason: 'ID is repeated in the file.' },
    ]);
    const have = parse([row()], { ...opts, existingIds: new Set(['NSPU 482913 5']) });
    expect(have).toMatchObject({
      ok: true,
      rejected: [{ row: 1, reason: 'ID is already on this plan.' }],
    });
  });

  it('AT-10: 10 rows, 3 invalid: 7 accepted, 3 listed with a reason each', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ id: `NSPU ${String(100000 + i)} 1` }));
    rows[2] = row({ id: 'NSPU 100002 1', weightT: 99 });
    rows[5] = row({ id: 'NSPU 100005 1', type: 'ZZ' });
    rows[8] = row({ id: 'bad', pod: 'LKCMB', type: '40HC' });
    const res = parse(rows);
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    expect(res.accepted).toHaveLength(7);
    expect(res.rejected.map((r) => r.row)).toEqual([3, 6, 9]);
    for (const r of res.rejected) expect(r.reason.length).toBeGreaterThan(5);
  });
});

describe('hostile input (NFR-19)', () => {
  it('keeps markup as text and caps what it echoes', () => {
    const id = `<img src=x onerror=alert(1)>${'x'.repeat(500)}`;
    const res = parse([row({ id })]);
    expect(res).toMatchObject({ ok: true, accepted: [] });
    if (!res.ok) return;
    expect(res.rejected[0]!.id.startsWith('<img src=x')).toBe(true);
    expect(res.rejected[0]!.id.length).toBeLessThanOrEqual(MAX_REASON_ID);
  });

  it('never throws and never accepts a bad row, whatever the file holds', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const res = parseLoadListFile(JSON.stringify(value), opts);
        if (res.ok)
          for (const c of res.accepted) expect(/^[A-Z]{4} \d{6} \d$/.test(c.id)).toBe(true);
      }),
    );
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(() => parseLoadListFile(text, opts)).not.toThrow();
      }),
    );
  });

  it('ignores extra and inherited keys', () => {
    const res = parseLoadListFile(
      '[{"id":"NSPU 482913 5","type":"40HC","weightT":20,"pod":"AEJEA","__proto__":{"x":1},"constructor":"y"}]',
      opts,
    );
    expect(res).toMatchObject({ ok: true, rejected: [] });
    if (!res.ok) return;
    expect(Object.keys(res.accepted[0]!)).not.toContain('constructor');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
