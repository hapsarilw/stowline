// Stowline sample data + rule engine (deterministic)
export const PODS = {
  LKCMB: { code: 'LKCMB', short: 'CMB', name: 'Colombo', color: '#E69F00', order: 1 },
  AEJEA: { code: 'AEJEA', short: 'JEA', name: 'Jebel Ali', color: '#56B4E9', order: 2 },
  NLRTM: { code: 'NLRTM', short: 'RTM', name: 'Rotterdam', color: '#009E73', order: 3 },
  DEHAM: { code: 'DEHAM', short: 'HAM', name: 'Hamburg', color: '#CC79A7', order: 4 },
};
export const POD_LIST = ['LKCMB', 'AEJEA', 'NLRTM', 'DEHAM'];
export const ROTATION = [
  { code: 'IDJKT', name: 'Jakarta', state: 'done', when: 'Dep 04 Oct' },
  { code: 'SGSIN', name: 'Singapore', state: 'current', when: 'ETD 08 Oct 22:00' },
  { code: 'LKCMB', name: 'Colombo', state: 'next', when: 'ETA 12 Oct' },
  { code: 'AEJEA', name: 'Jebel Ali', state: 'next', when: 'ETA 18 Oct' },
  { code: 'NLRTM', name: 'Rotterdam', state: 'next', when: 'ETA 01 Nov' },
  { code: 'DEHAM', name: 'Hamburg', state: 'next', when: 'ETA 04 Nov' },
];
export const VESSEL = { name: 'MV Nusantara Pioneer', teu: 8500, voyage: '042W' };
export const TYPES = {
  '20GP': { iso: '22G1', len: 20, h: "8'6\"", name: '20ft general purpose' },
  '40GP': { iso: '42G1', len: 40, h: "8'6\"", name: '40ft general purpose' },
  '40HC': { iso: '45G1', len: 40, h: "9'6\"", name: '40ft high cube' },
  RF: { iso: '45R1', len: 40, h: "9'6\"", name: '40ft reefer' },
  TK: { iso: '22T6', len: 20, h: "8'6\"", name: '20ft tank' },
  OT: { iso: '42U1', len: 40, h: "8'6\"", name: '40ft open top' },
};
export const LIMITS = { deck: 90.0, hold: 210.0, heavyDelta: 10 };
export const STAB = { gm: 1.84, gmMin: 1.2, trim: 0.62, trimLim: 1.5, list: 0.4, listWarn: 0.3, listLim: 2.0, mean: 12.41, summer: 14.5, bm: 78, sf: 64, disp: 98420, km: 17.46, kg: 15.62, mtc: 1150, lcf: -4 };
export const COUNTS = { total: 1240, planned: 312, unplannedT: 18374.6 };
export const DG_BAD = { '3': ['5.1', '2.1', '1.4'], '5.1': ['3', '2.1'], '2.1': ['3', '5.1'], '1.4': ['3'] };

export const pad = (n) => String(n).padStart(2, '0');
export const slotKey = (b, r, t) => pad(b) + pad(r) + pad(t);
export const parseKey = (k) => ({ bay: +k.slice(0, 2), row: +k.slice(2, 4), tier: +k.slice(4, 6) });
export const fmt1 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function rowsFor(n) { const p = [], s = []; for (let k = n / 2; k >= 1; k--) p.push(2 * k); for (let k = 1; k <= n / 2; k++) s.push(2 * k - 1); return p.concat(s); }
export const ALL_ROWS = rowsFor(16);
export const rowY = (r) => (r % 2 === 0 ? (r / 2 - 0.5) * 2.5 : -((r + 1) / 2 - 0.5) * 2.5);
export const DECK_TIERS = [82, 84, 86, 88, 90, 92];
export const HOLD_TIERS = [2, 4, 6, 8, 10, 12, 14, 16];

export const BAYS = (() => {
  const N = 22, out = []; let x = 0;
  for (let i = 0; i < N; i++) {
    const deckRows = [10, 12, 14][i] || (i >= 21 ? 14 : 16);
    const holdRows = [8, 10, 12][i] || (i >= 21 ? 10 : i >= 20 ? 12 : 14);
    const hs = [8, 6, 4][i] || 2;
    out.push({ bay: 2 + 4 * i, i, deckRows, holdRows, rows: rowsFor(deckRows), hRows: rowsFor(holdRows), deckTiers: DECK_TIERS, holdTiers: HOLD_TIERS.filter((t) => t >= hs), x });
    x -= 13.2; if (i === 13) x -= 16;
  }
  const mid = (out[0].x + out[N - 1].x) / 2; out.forEach((b) => (b.x -= mid));
  return out;
})();
export const DECKHOUSE_X = (BAYS[13].x + BAYS[14].x) / 2;
export const bayByNum = (n) => BAYS.find((b) => b.bay === n);
export function hasPlug(bay, row, tier) { const b = bayByNum(bay); if (!b) return false; if (tier >= 82) return b.i >= 3 && b.i <= 12 && tier <= 84; return b.i >= 4 && b.i <= 6 && tier <= 4; }
export function slotExists(bay, row, tier) { const b = bayByNum(bay); if (!b) return false; return tier >= 82 ? b.rows.includes(row) && b.deckTiers.includes(tier) : b.hRows.includes(row) && b.holdTiers.includes(tier); }
export const slotCode = (s) => (s.len === 20 ? pad(s.bay - 1) + pad(s.row) + pad(s.tier) : slotKey(s.bay, s.row, s.tier));
export function slotPos(key, len) {
  const { bay, row, tier } = parseKey(key); const b = bayByNum(bay);
  const z = tier >= 82 ? 1.2 + ((tier - 80) / 2 - 0.5) * 2.6 : -22 + (tier / 2 - 0.5) * 2.6;
  return { x: b.x + (len === 20 ? 3.05 : 0), y: rowY(row), z, i: b.i };
}

const PFX = ['NSPU', 'NSPU', 'NSPU', 'NSPU', 'NSPU', 'TRLU', 'KDMU', 'BXOU', 'VNRU'];
function mkId(r) { return PFX[(r() * PFX.length) | 0] + ' ' + String(100000 + ((r() * 899999) | 0)) + ' ' + ((r() * 10) | 0); }
function pickPod(r) { const v = r(); return v < 0.22 ? 'LKCMB' : v < 0.47 ? 'AEJEA' : v < 0.77 ? 'NLRTM' : 'DEHAM'; }

export function createPlan() {
  const r = rng(8500), slots = {};
  const put = (b, row, tier, deck, o) => { slots[slotKey(b.bay, row, tier)] = Object.assign({ type: '40HC', pol: 'IDJKT', rf: false, dg: null, locked: false, len: 40, bay: b.bay, row, tier, deck }, o); };
  const fill = (b, row, tiers, deck) => {
    const n = tiers.length; if (!n) return;
    const pods = []; for (let k = 0; k < n; k++) pods.push(pickPod(r));
    pods.sort((a, c) => PODS[c].order - PODS[a].order);
    const ws = []; for (let k = 0; k < n; k++) ws.push(deck ? 8 + r() * 18 : 12 + r() * 18);
    ws.sort((a, c) => c - a);
    const lim = deck ? LIMITS.deck : LIMITS.hold; let sum = 0;
    for (let k = 0; k < n; k++) {
      const w = Math.round(ws[k] * 10) / 10; if (sum + w > lim - 1.5) break; sum += w;
      const t = tiers[k], plug = hasPlug(b.bay, row, t);
      let type = plug && r() < 0.45 ? 'RF' : r() < 0.66 ? '40HC' : '40GP';
      if (k === n - 1 && type !== 'RF' && r() < 0.06) type = 'OT';
      put(b, row, t, deck, { id: mkId(r), type, w, pod: pods[k], pol: deck && b.i < 9 && r() < 0.5 ? 'SGSIN' : 'IDJKT', rf: type === 'RF', dg: r() < 0.03 ? '9' : null });
    }
  };
  BAYS.forEach((b) => {
    const f = b.i <= 13 ? 0.95 : b.i <= 16 ? 0.72 : b.i <= 18 ? 0.45 : 0.18;
    b.hRows.forEach((row) => { const L = b.holdTiers.length; let h = f > 0.9 ? L - (r() < 0.2 ? 1 : 0) : Math.round(L * f * (0.6 + r() * 0.7)); fill(b, row, b.holdTiers.slice(0, Math.max(0, Math.min(L, h))), false); });
    b.rows.forEach((row) => { let h = f > 0.9 ? 2 + ((r() * 5) | 0) : Math.round(6 * f * (0.4 + r() * 0.9)); if (f < 0.5 && r() < 0.45) h = 0; fill(b, row, DECK_TIERS.slice(0, Math.max(0, Math.min(6, h))), true); });
  });
  const S = (bay, row, deck, list) => {
    const b = bayByNum(bay), tiers = deck ? b.deckTiers : b.holdTiers;
    tiers.forEach((t) => delete slots[slotKey(bay, row, t)]);
    list.forEach((o, k) => put(b, row, tiers[k], deck, Object.assign({ id: mkId(r), pol: 'SGSIN' }, o, { rf: o.type === 'RF' })));
  };
  S(18, 4, true, [{ id: 'NSPU 730118 2', w: 26.8, pod: 'DEHAM' }, { id: 'NSPU 615540 9', w: 24.1, pod: 'NLRTM' }, { id: 'NSPU 482913 5', w: 28.4, pod: 'NLRTM' }, { id: 'NSPU 771032 1', w: 17.1, pod: 'LKCMB', type: '40GP' }]);
  S(18, 6, true, [{ w: 25.0, pod: 'DEHAM' }, { w: 24.2, pod: 'NLRTM' }, { w: 23.1, pod: 'AEJEA' }]);
  S(18, 2, true, [{ w: 24.4, pod: 'DEHAM' }, { w: 21.0, pod: 'AEJEA' }]);
  S(18, 1, true, [{ w: 22.8, pod: 'NLRTM' }, { w: 19.5, pod: 'NLRTM', type: 'RF' }, { w: 15.2, pod: 'AEJEA' }]);
  S(18, 3, true, [{ w: 26.1, pod: 'DEHAM' }, { w: 25.5, pod: 'DEHAM' }, { w: 22.9, pod: 'NLRTM' }]);
  S(18, 8, true, [{ w: 23.3, pod: 'NLRTM' }, { w: 18.6, pod: 'LKCMB' }]);
  S(18, 5, true, [{ w: 21.7, pod: 'AEJEA' }, { w: 20.2, pod: 'LKCMB' }]);
  S(22, 6, false, [{ w: 29.0, pod: 'DEHAM', pol: 'IDJKT' }, { w: 27.9, pod: 'DEHAM', pol: 'IDJKT' }, { w: 27.6, pod: 'NLRTM', pol: 'IDJKT' }, { w: 27.4, pod: 'NLRTM', pol: 'IDJKT' }, { id: 'NSPU 220417 3', w: 27.2, pod: 'NLRTM', type: 'RF', temp: '−18.0 °C' }]);
  S(14, 2, true, [{ w: 22.0, pod: 'DEHAM' }, { id: 'NSPU 309915 7', w: 19.4, pod: 'NLRTM', type: '40GP', dg: '3' }]);
  S(14, 4, true, [{ w: 21.0, pod: 'DEHAM' }, { id: 'NSPU 664201 0', w: 16.2, pod: 'NLRTM', type: '40GP', dg: '5.1' }]);
  S(10, 3, true, [{ id: 'NSPU 118377 4', w: 21.6, pod: 'LKCMB' }, { id: 'NSPU 905126 8', w: 18.3, pod: 'NLRTM' }, { id: 'NSPU 905127 3', w: 14.0, pod: 'NLRTM' }]);
  S(30, 2, true, [{ id: 'NSPU 402288 1', w: 22.4, pod: 'NLRTM' }, { id: 'NSPU 318204 6', w: 12.6, pod: 'NLRTM', type: '20GP', len: 20 }]);
  S(42, 8, true, [{ id: 'NSPU 207714 8', w: 22.5, pod: 'AEJEA' }, { id: 'NSPU 552870 6', w: 19.8, pod: 'DEHAM' }]);
  S(46, 6, false, [{ w: 29.1, pod: 'DEHAM', pol: 'IDJKT' }, { w: 27.4, pod: 'DEHAM', pol: 'IDJKT' }, { w: 25.0, pod: 'NLRTM', pol: 'IDJKT' }, { w: 21.2, pod: 'NLRTM', pol: 'IDJKT' }, { id: 'NSPU 640033 2', w: 8.4, pod: 'NLRTM', pol: 'IDJKT' }, { id: 'NSPU 813350 9', w: 30.2, pod: 'NLRTM', pol: 'IDJKT' }]);
  ['180202', '180102', '180204'].forEach((k) => { if (slots[k]) slots[k].locked = true; });
  return slots;
}

export function stacksOf(slots) {
  const m = {};
  for (const k in slots) { const s = slots[k]; const sk = s.bay + '-' + s.row + '-' + (s.deck ? 'D' : 'H'); (m[sk] = m[sk] || []).push(s); }
  for (const k in m) m[k].sort((a, b) => a.tier - b.tier);
  return m;
}
export const stackWeight = (slots, bay, row, deck) => { let s = 0; (deck ? DECK_TIERS : HOLD_TIERS).forEach((t) => { const b = slots[slotKey(bay, row, t)]; if (b) s += b.w; }); return s; };

function neighbors(s) {
  const i = ALL_ROWS.indexOf(s.row), out = [];
  [ALL_ROWS[i - 1], ALL_ROWS[i + 1]].forEach((r) => r && out.push(slotKey(s.bay, r, s.tier)));
  out.push(slotKey(s.bay, s.row, s.tier + 2), slotKey(s.bay, s.row, s.tier - 2));
  return out;
}

export function computeViolations(slots) {
  const out = [], st = stacksOf(slots);
  const P = (p) => PODS[p];
  for (const sk in st) {
    const arr = st[sk], b0 = arr[0], deck = b0.deck, lim = deck ? LIMITS.deck : LIMITS.hold;
    const sum = arr.reduce((a, x) => a + x.w, 0), top = arr[arr.length - 1];
    if (sum > lim + 1e-6) out.push({ id: 'stack:' + sk, rule: 'stack', title: 'Stack weight', sev: 'error', bay: b0.bay, slot: slotKey(top.bay, top.row, top.tier), slots: arr.map((x) => slotKey(x.bay, x.row, x.tier)), msg: `Stack ${pad(b0.bay)}-${pad(b0.row)} ${deck ? 'deck' : 'hold'}: ${fmt1(sum)} t of ${fmt1(lim)} t limit`, over: sum - lim });
    arr.forEach((x, k) => {
      const key = slotKey(x.bay, x.row, x.tier), below = arr[k - 1];
      if (x.rf && !hasPlug(x.bay, x.row, x.tier)) out.push({ id: 'reefer:' + key, rule: 'reefer', title: 'Reefer power', sev: 'error', bay: x.bay, slot: key, slots: [key], msg: `Reefer ${x.id} at ${key} has no plug` });
      if (below && x.len === 20 && below.len === 40) out.push({ id: '2040:' + key, rule: 'twenty', title: '20ft on 40ft', sev: 'error', bay: x.bay, slot: key, slots: [key, slotKey(below.bay, below.row, below.tier)], msg: `20ft ${x.id} at ${slotCode(x)} sits on 40ft stack in bay ${pad(x.bay)}` });
      if (below && x.w > below.w + LIMITS.heavyDelta) out.push({ id: 'heavy:' + key, rule: 'heavy', title: 'Heavy over light', sev: 'warning', bay: x.bay, slot: key, slots: [key, slotKey(below.bay, below.row, below.tier)], msg: `Heavy over light at ${key}: ${fmt1(x.w)} t above ${fmt1(below.w)} t` });
      const later = arr.slice(k + 1).filter((a) => P(a.pod).order > P(x.pod).order);
      if (later.length) { const n = arr.length - 1 - k; out.push({ id: 'over:' + key, rule: 'overstow', title: 'Overstow', sev: 'error', bay: x.bay, slot: key, slots: arr.slice(k).map((a) => slotKey(a.bay, a.row, a.tier)), restows: n, port: x.pod, msg: `${P(x.pod).name} box under ${P(later[0].pod).name} box at ${key}, ${n} restow move${n > 1 ? 's' : ''}` }); }
    });
  }
  const seen = {};
  for (const k in slots) {
    const x = slots[k]; if (!x.dg) continue;
    neighbors(x).forEach((nk) => {
      const y = slots[nk]; if (!y || !y.dg) return;
      if ((DG_BAD[x.dg] || []).includes(y.dg)) { const id = 'dg:' + [k, nk].sort().join('-'); if (seen[id]) return; seen[id] = 1; out.push({ id, rule: 'dg', title: 'DG segregation', sev: 'error', bay: x.bay, slot: k, slots: [k, nk], msg: `IMDG ${x.dg} next to IMDG ${y.dg} in bay ${pad(x.bay)}` }); }
    });
  }
  const ord = { stack: 1, reefer: 2, dg: 3, overstow: 4, twenty: 5, heavy: 6 };
  return out.sort((a, b) => (a.sev === b.sev ? ord[a.rule] - ord[b.rule] : a.sev === 'error' ? -1 : 1));
}

// Evaluate a candidate drop. box = container being placed, fromKey = its current slot (or null)
export function checkPlace(slots, key, box, fromKey) {
  const { bay, row, tier } = parseKey(key);
  if (!slotExists(bay, row, tier)) return { target: false };
  const get = (k) => (k === fromKey ? null : slots[k]);
  if (get(key)) return { target: false, occupied: true };
  const deck = tier >= 82, b = bayByNum(bay), tiers = deck ? b.deckTiers : b.holdTiers, idx = tiers.indexOf(tier);
  const below = idx > 0 ? get(slotKey(bay, row, tiers[idx - 1])) : null;
  if (idx > 0 && !below) return { target: false };
  const stack = tiers.map((t) => get(slotKey(bay, row, t))).filter(Boolean);
  const lim = deck ? LIMITS.deck : LIMITS.hold, sum = stack.reduce((a, x) => a + x.w, 0) + box.w;
  const errs = [], warns = [];
  if (sum > lim + 1e-6) errs.push({ rule: 'stack', text: `Stack limit: ${fmt1(sum)} t of ${fmt1(lim)} t` });
  if (box.rf && !hasPlug(bay, row, tier)) errs.push({ rule: 'reefer', text: `No reefer plug at ${key}` });
  const earlier = stack.filter((x) => PODS[x.pod].order < PODS[box.pod].order);
  if (earlier.length) errs.push({ rule: 'overstow', text: `Overstow: ${PODS[earlier[0].pod].short} box below, ${stack.length - stack.indexOf(earlier[0])} restow` });
  if (below && box.len === 20 && below.len === 40) errs.push({ rule: 'twenty', text: '20ft on 40ft stack' });
  if (below && box.len === 40 && below.len === 20) errs.push({ rule: 'twenty', text: '40ft on 20ft stack' });
  if (box.dg) neighbors({ bay, row, tier }).forEach((nk) => { const y = get(nk); if (y && y.dg && (DG_BAD[box.dg] || []).includes(y.dg)) errs.push({ rule: 'dg', text: `IMDG ${box.dg} next to IMDG ${y.dg}` }); });
  if (below && box.w > below.w + LIMITS.heavyDelta) warns.push({ rule: 'heavy', text: `Heavy over light: ${fmt1(box.w)} t over ${fmt1(below.w)} t` });
  return { target: true, ok: !errs.length, errs, warns, sum, lim, reason: (errs[0] || warns[0] || {}).text };
}

export function validTargets(slots, box, fromKey, bayNum) {
  const out = [];
  const bays = bayNum ? [bayByNum(bayNum)] : BAYS;
  bays.forEach((b) => { [[b.rows, b.deckTiers], [b.hRows, b.holdTiers]].forEach(([rows, tiers]) => rows.forEach((row) => tiers.forEach((t) => { const k = slotKey(b.bay, row, t); const c = checkPlace(slots, k, box, fromKey); if (c.target && c.ok && !c.warns.length) out.push(k); }))); });
  return out;
}

export function suggestFix(v, slots) {
  const box = slots[v.slot];
  if (v.rule === 'stack') { const t = box; const to = validTargets(slots, t, v.slot, v.bay).find((k) => k.slice(2, 4) !== v.slot.slice(2, 4) && +k.slice(4) >= 82) || validTargets(slots, t, v.slot)[0]; return to && { text: `Move ${t.id} (${fmt1(t.w)} t) to ${to}`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'reefer') { const to = validTargets(slots, box, v.slot).find((k) => { const p = parseKey(k); return hasPlug(p.bay, p.row, p.tier); }); return to && { text: `Move to plug slot ${to}`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'dg') { const k = v.slots.find((s) => slots[s] && slots[s].dg === '5.1') || v.slots[1]; const b = slots[k]; const to = validTargets(slots, b, k).find((t) => +t.slice(0, 2) >= +k.slice(0, 2) + 8 && +t.slice(4) >= 82); return to && { text: `Move IMDG ${b.dg} ${b.id} to ${to} (separated by 2 bays)`, kind: 'move', from: k, to }; }
  if (v.rule === 'overstow') { const top = slots[v.slots[v.slots.length - 1]]; return { text: `Swap with ${top.id} at ${v.slots[v.slots.length - 1]}, 0 restows`, kind: 'swap', a: v.slot, b: v.slots[v.slots.length - 1] }; }
  if (v.rule === 'twenty') { const to = Object.keys(slots).length && ['300682', '300882', '301082', '300582'].find((k) => !slots[k] && slotExists(30, +k.slice(2, 4), 82)); return to && { text: `Move to empty deck stack ${pad(29)}${to.slice(2)} (on hatch)`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'heavy') { const b = v.slots[1]; return { text: `Swap with ${slots[b].id} at ${b}, heavy box below`, kind: 'swap', a: v.slot, b }; }
  return null;
}

export function stabDelta(box, fromKey, toKey) {
  const A = fromKey ? slotPos(fromKey, box.len) : null, B = slotPos(toKey, box.len), w = box.w, D = STAB.disp;
  const zk = (p) => p.z + 24;
  const gm = A ? (-w * (zk(B) - zk(A))) / D : (-w * (zk(B) - STAB.kg)) / D;
  const trim = A ? (w * (A.x - B.x)) / (STAB.mtc * 100) : (w * (STAB.lcf - B.x)) / (STAB.mtc * 100);
  const list = (Math.atan((w * (B.y - (A ? A.y : 0))) / (D * STAB.gm)) * 180) / Math.PI;
  return { gm, trim, list };
}

export function strengthCurves() {
  const n = 60, bm = [], sf = [];
  for (let k = 0; k <= n; k++) { const x = k / n; bm.push(Math.pow(Math.sin(Math.PI * x), 1.4) * (1 + 0.12 * Math.sin(Math.PI * x * 2.2))); sf.push(Math.sin(2 * Math.PI * x) * (1 - 0.18 * x) + 0.08 * Math.sin(6 * Math.PI * x)); }
  const mb = Math.max(...bm), ms = Math.max(...sf.map(Math.abs));
  return { bm: bm.map((v) => (v / mb) * STAB.bm), sf: sf.map((v) => (v / ms) * STAB.sf) };
}

export function createLoadList(slots) {
  const r = rng(1240), list = [];
  const types = ['40HC', '40HC', '40HC', '40HC', '40GP', '40GP', '20GP', 'RF', 'TK', 'OT'];
  list.push({ id: 'NSPU 551208 4', type: '40HC', w: 24.1, pod: 'AEJEA' });
  list.push({ id: 'NSPU 337061 2', type: 'RF', w: 26.3, pod: 'NLRTM', temp: '−25.0 °C' });
  list.push({ id: 'NSPU 908442 7', type: 'TK', w: 21.8, pod: 'AEJEA', dg: '3' });
  for (let k = 0; k < 57; k++) {
    const type = types[(r() * types.length) | 0], len = TYPES[type].len;
    const w = Math.round((len === 20 ? 7 + r() * 19 : 5 + r() * 25) * 10) / 10;
    list.push({ id: mkId(r), type, w, pod: pickPod(r), dg: type === 'TK' ? ['3', '8', '6.1'][(r() * 3) | 0] : r() < 0.04 ? ['9', '2.1'][(r() * 2) | 0] : null, temp: type === 'RF' ? (r() < 0.5 ? '−18.0 °C' : '+4.0 °C') : null });
  }
  list.forEach((x) => { x.len = TYPES[x.type].len; x.rf = x.type === 'RF'; x.pol = 'SGSIN'; x.planned = false; });
  for (const k in slots) { const s = slots[k]; if (s.pol === 'SGSIN' && (s.bay === 18 || s.bay === 14 || s.bay === 10)) list.push(Object.assign({}, s, { planned: true, slot: k, ref: true })); }
  return list;
}
