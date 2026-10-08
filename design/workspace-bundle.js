// Stowline workspace bundle (data + renderer + view-model), generated for standalone export
const S = (() => {
// Stowline sample data + rule engine (deterministic)
const PODS = {
  LKCMB: { code: 'LKCMB', short: 'CMB', name: 'Colombo', color: '#E69F00', order: 1 },
  AEJEA: { code: 'AEJEA', short: 'JEA', name: 'Jebel Ali', color: '#56B4E9', order: 2 },
  NLRTM: { code: 'NLRTM', short: 'RTM', name: 'Rotterdam', color: '#009E73', order: 3 },
  DEHAM: { code: 'DEHAM', short: 'HAM', name: 'Hamburg', color: '#CC79A7', order: 4 },
};
const POD_LIST = ['LKCMB', 'AEJEA', 'NLRTM', 'DEHAM'];
const ROTATION = [
  { code: 'IDJKT', name: 'Jakarta', state: 'done', when: 'Dep 04 Oct' },
  { code: 'SGSIN', name: 'Singapore', state: 'current', when: 'ETD 08 Oct 22:00' },
  { code: 'LKCMB', name: 'Colombo', state: 'next', when: 'ETA 12 Oct' },
  { code: 'AEJEA', name: 'Jebel Ali', state: 'next', when: 'ETA 18 Oct' },
  { code: 'NLRTM', name: 'Rotterdam', state: 'next', when: 'ETA 01 Nov' },
  { code: 'DEHAM', name: 'Hamburg', state: 'next', when: 'ETA 04 Nov' },
];
const VESSEL = { name: 'MV Nusantara Pioneer', teu: 8500, voyage: '042W' };
const TYPES = {
  '20GP': { iso: '22G1', len: 20, h: "8'6\"", name: '20ft general purpose' },
  '40GP': { iso: '42G1', len: 40, h: "8'6\"", name: '40ft general purpose' },
  '40HC': { iso: '45G1', len: 40, h: "9'6\"", name: '40ft high cube' },
  RF: { iso: '45R1', len: 40, h: "9'6\"", name: '40ft reefer' },
  TK: { iso: '22T6', len: 20, h: "8'6\"", name: '20ft tank' },
  OT: { iso: '42U1', len: 40, h: "8'6\"", name: '40ft open top' },
};
const LIMITS = { deck: 90.0, hold: 210.0, heavyDelta: 10 };
const STAB = { gm: 1.84, gmMin: 1.2, trim: 0.62, trimLim: 1.5, list: 0.4, listWarn: 0.3, listLim: 2.0, mean: 12.41, summer: 14.5, bm: 78, sf: 64, disp: 98420, km: 17.46, kg: 15.62, mtc: 1150, lcf: -4 };
const COUNTS = { total: 1240, planned: 312, unplannedT: 18374.6 };
const DG_BAD = { '3': ['5.1', '2.1', '1.4'], '5.1': ['3', '2.1'], '2.1': ['3', '5.1'], '1.4': ['3'] };

const pad = (n) => String(n).padStart(2, '0');
const slotKey = (b, r, t) => pad(b) + pad(r) + pad(t);
const parseKey = (k) => ({ bay: +k.slice(0, 2), row: +k.slice(2, 4), tier: +k.slice(4, 6) });
const fmt1 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rowsFor(n) { const p = [], s = []; for (let k = n / 2; k >= 1; k--) p.push(2 * k); for (let k = 1; k <= n / 2; k++) s.push(2 * k - 1); return p.concat(s); }
const ALL_ROWS = rowsFor(16);
const rowY = (r) => (r % 2 === 0 ? (r / 2 - 0.5) * 2.5 : -((r + 1) / 2 - 0.5) * 2.5);
const DECK_TIERS = [82, 84, 86, 88, 90, 92];
const HOLD_TIERS = [2, 4, 6, 8, 10, 12, 14, 16];

const BAYS = (() => {
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
const DECKHOUSE_X = (BAYS[13].x + BAYS[14].x) / 2;
const bayByNum = (n) => BAYS.find((b) => b.bay === n);
function hasPlug(bay, row, tier) { const b = bayByNum(bay); if (!b) return false; if (tier >= 82) return b.i >= 3 && b.i <= 12 && tier <= 84; return b.i >= 4 && b.i <= 6 && tier <= 4; }
function slotExists(bay, row, tier) { const b = bayByNum(bay); if (!b) return false; return tier >= 82 ? b.rows.includes(row) && b.deckTiers.includes(tier) : b.hRows.includes(row) && b.holdTiers.includes(tier); }
const slotCode = (s) => (s.len === 20 ? pad(s.bay - 1) + pad(s.row) + pad(s.tier) : slotKey(s.bay, s.row, s.tier));
function slotPos(key, len) {
  const { bay, row, tier } = parseKey(key); const b = bayByNum(bay);
  const z = tier >= 82 ? 1.2 + ((tier - 80) / 2 - 0.5) * 2.6 : -22 + (tier / 2 - 0.5) * 2.6;
  return { x: b.x + (len === 20 ? 3.05 : 0), y: rowY(row), z, i: b.i };
}

const PFX = ['NSPU', 'NSPU', 'NSPU', 'NSPU', 'NSPU', 'TRLU', 'KDMU', 'BXOU', 'VNRU'];
function mkId(r) { return PFX[(r() * PFX.length) | 0] + ' ' + String(100000 + ((r() * 899999) | 0)) + ' ' + ((r() * 10) | 0); }
function pickPod(r) { const v = r(); return v < 0.22 ? 'LKCMB' : v < 0.47 ? 'AEJEA' : v < 0.77 ? 'NLRTM' : 'DEHAM'; }

function createPlan() {
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

function stacksOf(slots) {
  const m = {};
  for (const k in slots) { const s = slots[k]; const sk = s.bay + '-' + s.row + '-' + (s.deck ? 'D' : 'H'); (m[sk] = m[sk] || []).push(s); }
  for (const k in m) m[k].sort((a, b) => a.tier - b.tier);
  return m;
}
const stackWeight = (slots, bay, row, deck) => { let s = 0; (deck ? DECK_TIERS : HOLD_TIERS).forEach((t) => { const b = slots[slotKey(bay, row, t)]; if (b) s += b.w; }); return s; };

function neighbors(s) {
  const i = ALL_ROWS.indexOf(s.row), out = [];
  [ALL_ROWS[i - 1], ALL_ROWS[i + 1]].forEach((r) => r && out.push(slotKey(s.bay, r, s.tier)));
  out.push(slotKey(s.bay, s.row, s.tier + 2), slotKey(s.bay, s.row, s.tier - 2));
  return out;
}

function computeViolations(slots) {
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
function checkPlace(slots, key, box, fromKey) {
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

function validTargets(slots, box, fromKey, bayNum) {
  const out = [];
  const bays = bayNum ? [bayByNum(bayNum)] : BAYS;
  bays.forEach((b) => { [[b.rows, b.deckTiers], [b.hRows, b.holdTiers]].forEach(([rows, tiers]) => rows.forEach((row) => tiers.forEach((t) => { const k = slotKey(b.bay, row, t); const c = checkPlace(slots, k, box, fromKey); if (c.target && c.ok && !c.warns.length) out.push(k); }))); });
  return out;
}

function suggestFix(v, slots) {
  const box = slots[v.slot];
  if (v.rule === 'stack') { const t = box; const to = validTargets(slots, t, v.slot, v.bay).find((k) => k.slice(2, 4) !== v.slot.slice(2, 4) && +k.slice(4) >= 82) || validTargets(slots, t, v.slot)[0]; return to && { text: `Move ${t.id} (${fmt1(t.w)} t) to ${to}`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'reefer') { const to = validTargets(slots, box, v.slot).find((k) => { const p = parseKey(k); return hasPlug(p.bay, p.row, p.tier); }); return to && { text: `Move to plug slot ${to}`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'dg') { const k = v.slots.find((s) => slots[s] && slots[s].dg === '5.1') || v.slots[1]; const b = slots[k]; const to = validTargets(slots, b, k).find((t) => +t.slice(0, 2) >= +k.slice(0, 2) + 8 && +t.slice(4) >= 82); return to && { text: `Move IMDG ${b.dg} ${b.id} to ${to} (separated by 2 bays)`, kind: 'move', from: k, to }; }
  if (v.rule === 'overstow') { const top = slots[v.slots[v.slots.length - 1]]; return { text: `Swap with ${top.id} at ${v.slots[v.slots.length - 1]}, 0 restows`, kind: 'swap', a: v.slot, b: v.slots[v.slots.length - 1] }; }
  if (v.rule === 'twenty') { const to = Object.keys(slots).length && ['300682', '300882', '301082', '300582'].find((k) => !slots[k] && slotExists(30, +k.slice(2, 4), 82)); return to && { text: `Move to empty deck stack ${pad(29)}${to.slice(2)} (on hatch)`, kind: 'move', from: v.slot, to }; }
  if (v.rule === 'heavy') { const b = v.slots[1]; return { text: `Swap with ${slots[b].id} at ${b}, heavy box below`, kind: 'swap', a: v.slot, b }; }
  return null;
}

function stabDelta(box, fromKey, toKey) {
  const A = fromKey ? slotPos(fromKey, box.len) : null, B = slotPos(toKey, box.len), w = box.w, D = STAB.disp;
  const zk = (p) => p.z + 24;
  const gm = A ? (-w * (zk(B) - zk(A))) / D : (-w * (zk(B) - STAB.kg)) / D;
  const trim = A ? (w * (A.x - B.x)) / (STAB.mtc * 100) : (w * (STAB.lcf - B.x)) / (STAB.mtc * 100);
  const list = (Math.atan((w * (B.y - (A ? A.y : 0))) / (D * STAB.gm)) * 180) / Math.PI;
  return { gm, trim, list };
}

function strengthCurves() {
  const n = 60, bm = [], sf = [];
  for (let k = 0; k <= n; k++) { const x = k / n; bm.push(Math.pow(Math.sin(Math.PI * x), 1.4) * (1 + 0.12 * Math.sin(Math.PI * x * 2.2))); sf.push(Math.sin(2 * Math.PI * x) * (1 - 0.18 * x) + 0.08 * Math.sin(6 * Math.PI * x)); }
  const mb = Math.max(...bm), ms = Math.max(...sf.map(Math.abs));
  return { bm: bm.map((v) => (v / mb) * STAB.bm), sf: sf.map((v) => (v / ms) * STAB.sf) };
}

function createLoadList(slots) {
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

return { PODS, POD_LIST, ROTATION, VESSEL, TYPES, LIMITS, STAB, COUNTS, DG_BAD, pad, slotKey, parseKey, fmt1, rowsFor, ALL_ROWS, rowY, DECK_TIERS, HOLD_TIERS, BAYS, DECKHOUSE_X, bayByNum, hasPlug, slotExists, slotCode, slotPos, createPlan, stacksOf, stackWeight, computeViolations, checkPlace, validTargets, suggestFix, stabDelta, strengthCurves, createLoadList };
})();
const { PRESETS, Stow3D, toBoxes } = (() => {
// Isometric canvas stand-in for the future R3F Viewport3D
const rad = (d) => (d * Math.PI) / 180;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const shadeCache = {};
function shades(hex) {
  if (shadeCache[hex]) return shadeCache[hex];
  const h = hex.replace('#', ''), c = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  const f = (k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  return (shadeCache[hex] = [f(1), f(0.8), f(0.62)]);
}
const HULL = [[-162, 17, 8, -12], [-152, 20, 14, -21], [-132, 21.6, 19, -24], [92, 21.6, 19, -24], [120, 20.5, 13, -24], [140, 18, 8, -23], [154, 13.5, 4, -19], [166, 5, 1, -12], [172, 0.5, 0.5, -8]];
const DECKZ = 1.0;
const PRESETS = { iso: { yaw: 204, pitch: 27, zoom: 1, tx: 0, ty: 0, tz: -4 }, port: { yaw: 180, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 }, stbd: { yaw: 0, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 }, top: { yaw: 180, pitch: 89, zoom: 1, tx: 0, ty: 0, tz: -4 }, bow: { yaw: 270, pitch: 16, zoom: 1, tx: 0, ty: 0, tz: -4 } };
const WEIGHT = [[8, '#22406E'], [14, '#38699A'], [20, '#5B97C0'], [26, '#A9CBDD'], [99, '#F2D35B']];
const TYPEC = { '40HC': '#7D8CA8', '40GP': '#56647D', '20GP': '#9AA9BF', RF: '#CFEAF6', TK: '#E3B25A', OT: '#B7997A' };

class Stow3D {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.o = { boxes: [] }; this.cam = Object.assign({}, PRESETS.iso); this.gaps = {}; this.anims = []; this.hits = []; this.raf = 0; this.dpr = window.devicePixelRatio || 1; }
  resize(w, h) { this.w = w; this.h = h; this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px'; this.draw(); }
  set(o) { const liftChanged = o.lift && (!this.o.lift || o.lift.pod !== this.o.lift.pod); Object.assign(this.o, o); if (liftChanged) { this.liftT0 = performance.now(); this.prepLift(); } if (this.o.lift && !this.o.reduced) this.kick(); else this.draw(); }
  anim(dur, fn) { if (this.o.reduced) { fn(1); this.draw(); return; } this.anims.push({ dur, fn, t0: performance.now() }); this.kick(); }
  kick() { if (this.raf) return; const step = () => { const now = performance.now(); this.anims = this.anims.filter((a) => { const t = Math.min(1, (now - a.t0) / a.dur); a.fn(t); return t < 1; }); this.draw(); this.raf = this.anims.length || (this.o.lift && !this.o.reduced) ? requestAnimationFrame(step) : 0; }; this.raf = requestAnimationFrame(step); }
  fly(target, dur = 600) {
    const from = Object.assign({}, this.cam), to = Object.assign({}, this.cam, target);
    let dy = to.yaw - from.yaw; if (dy > 180) to.yaw -= 360; if (dy < -180) to.yaw += 360;
    this.anim(dur, (t) => { const e = easeIO(t); for (const k in to) this.cam[k] = from[k] + (to[k] - from[k]) * e; if (t === 1) this.cam.yaw = ((this.cam.yaw % 360) + 360) % 360; });
  }
  setGap(i) {
    if (this.gapI === i) return; this.gapI = i;
    const from = Object.assign({}, this.gaps);
    this.anim(400, (t) => { const e = easeIO(t); const g = {}; for (const k in from) if (+k !== i) g[k] = from[k] * (1 - e); g[i] = (from[i] || 0) + (1 - (from[i] || 0)) * e; this.gaps = g; });
  }
  orbit(dx, dy) { this.cam.yaw = (this.cam.yaw - dx * 0.4 + 360) % 360; this.cam.pitch = Math.max(2, Math.min(89, this.cam.pitch + dy * 0.3)); this.draw(); }
  zoomBy(f) { this.cam.zoom = Math.max(0.6, Math.min(6, this.cam.zoom * f)); this.draw(); }
  prepLift() { const L = this.o.lift; if (!L) return; const list = this.o.boxes.filter((b) => b.pod === L.pod).sort((a, b) => (b.deck - a.deck) || (b.x - a.x) || (b.z - a.z)); list.forEach((b, k) => (b._lk = k)); this.liftN = list.length; }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; }
  hit(px, py) { for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; for (const poly of h.p) if (inPoly(px, py, poly)) return h.b; } return null; }

  draw() {
    const o = this.o, ctx = this.ctx, W = this.w, H = this.h; if (!W || !H || !o.theme) return;
    const th = o.theme, cam = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    const ya = rad(cam.yaw), pa = rad(cam.pitch), cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const x of [-172, 172]) for (const y of [-22, 22]) for (const z of [-24, 20]) { const X = x * cy - y * sy, Y = x * sy + y * cy, sY = z * cp + Y * sp; mnx = Math.min(mnx, X); mxx = Math.max(mxx, X); mny = Math.min(mny, sY); mxy = Math.max(mxy, sY); }
    const s = Math.min((W * 0.9) / (mxx - mnx), (H * 0.8) / (mxy - mny)) * cam.zoom;
    const ox = W / 2, oy = H / 2 + (o.padY || 0);
    const P = (x, y, z) => { x -= cam.tx; y -= cam.ty; z -= cam.tz; const X = x * cy - y * sy, Y = x * sy + y * cy; return [ox + X * s, oy - (z * cp + Y * sp) * s]; };
    const V = [-sy * cp, -cy * cp, sp];
    const D = (x, y, z) => -(x * sy + y * cy) * cp + z * sp;
    const poly = (pts, fill, stroke, lw) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 0.5; ctx.stroke(); } };

    // hull faces
    const faces = [];
    for (let k = 0; k < HULL.length - 1; k++) {
      const [x0, d0, b0, z0] = HULL[k], [x1, d1, b1, z1] = HULL[k + 1];
      faces.push([[x1, b1, z1], [x0, b0, z0], [x0, d0, DECKZ], [x1, d1, DECKZ]]);
      faces.push([[x1, -d1, DECKZ], [x0, -d0, DECKZ], [x0, -b0, z0], [x1, -b1, z1]]);
      faces.push([[x0, b0, z0], [x1, b1, z1], [x1, -b1, z1], [x0, -b0, z0]]);
    }
    const [sx0, sd0, sb0, sz0] = HULL[0]; faces.push([[sx0, -sd0, DECKZ], [sx0, sd0, DECKZ], [sx0, sb0, sz0], [sx0, -sb0, sz0]]);
    const near = [], far = [];
    faces.forEach((f) => { const a = f[0], b = f[1], c = f[2]; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const cx = (a[0] + c[0]) / 2, cyy = (a[1] + c[1]) / 2, cz = (a[2] + c[2]) / 2; const out = [cx > 150 ? 1 : cx < -158 ? -1 : 0, cyy, cz + 10]; if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((q) => -q); const dep = D(cx, cyy, cz); (n[0] * V[0] + n[1] * V[1] + n[2] * V[2] > 0 ? near : far).push({ f, dep }); });
    far.sort((a, b) => a.dep - b.dep); near.sort((a, b) => a.dep - b.dep);
    const transparent = o.hullTransparent;
    far.forEach(({ f }) => poly(f.map((p) => P(...p)), th.hullIn, th.hullLine, 0.6));

    const gapOf = (i) => { let d = 0; for (const k in this.gaps) { const g = +k, a = this.gaps[k]; if (i < g) d += 3.2 * a; else if (i > g) d -= 3.2 * a; } return d; };
    const focus = o.focus && o.focus.size ? o.focus : null;
    const now = performance.now(), L = o.lift;
    const el = L ? (now - (this.liftT0 || now)) % ((this.liftN || 1) * 20 + 2200) : 0;
    const drawn = [];
    const boxes = o.boxes;
    const layer = (deck) => {
      const arr = [];
      for (const b of boxes) {
        if (b.deck !== deck) continue;
        let dz = 0, alpha = 1;
        if (L) { const ord = L.order[b.pod]; if (ord < L.port) continue; if (ord === L.port) { const p = o.reduced ? 1 : Math.max(0, Math.min(1, (el - b._lk * 20) / 500)); dz = 30 * easeOut(p); alpha = 1 - p * 0.9; if (alpha < 0.05) continue; } }
        const x = b.x + gapOf(b.i);
        arr.push({ b, x, y: b.y, z: b.z + dz, alpha, d: D(x, b.y, b.z + dz) });
      }
      if (deck) { const hx = (o.houseX || 0); arr.push({ house: 1, x: hx, y: 0, z: 17.5, hx: 5.6, hy: 17, hz: 16.5, d: D(hx, 0, 17.5) }, { house: 2, x: hx, y: 0, z: 35, hx: 6.2, hy: 21.4, hz: 1.1, d: D(hx, 0, 35) }); }
      arr.sort((a, b) => a.d - b.d);
      const xf = sy < 0 ? 1 : -1, yf = cy < 0 ? 1 : -1;
      for (const it of arr) {
        const b = it.b, hx = it.house ? it.hx : b.hx, hy = it.house ? it.hy : b.hy, hz = it.house ? it.hz : b.hz;
        const X0 = it.x - hx, X1 = it.x + hx, Y0 = it.y - hy, Y1 = it.y + hy, Z0 = it.z - hz, Z1 = it.z + hz, xs = xf > 0 ? X1 : X0, ys = yf > 0 ? Y1 : Y0;
        const top = [P(X0, Y0, Z1), P(X1, Y0, Z1), P(X1, Y1, Z1), P(X0, Y1, Z1)], end = [P(xs, Y0, Z0), P(xs, Y1, Z0), P(xs, Y1, Z1), P(xs, Y0, Z1)], side = [P(X0, ys, Z0), P(X1, ys, Z0), P(X1, ys, Z1), P(X0, ys, Z1)];
        let col, a = 1, dim = false;
        if (it.house) col = th.house;
        else {
          dim = (focus && !focus.has(b.key)) || (o.onlyPod && b.pod !== o.onlyPod);
          const m = o.colorMode;
          col = dim ? th.dim : m === 'weight' ? WEIGHT.find((q) => b.w < q[0])[1] : m === 'type' ? TYPEC[b.type] || th.dim : m === 'viol' ? (b.viol === 'error' ? th.err : b.viol === 'warning' ? th.warn : th.neutral) : o.pods[b.pod].color;
          a = (dim ? 0.55 : 1) * it.alpha;
        }
        const sh = shades(col);
        ctx.globalAlpha = a;
        if (sp > 0.02) poly(top, sh[0], th.edge, 0.5);
        poly(end, sh[2], th.edge, 0.5); poly(side, sh[1], th.edge, 0.5);
        ctx.globalAlpha = 1;
        if (!it.house) { drawn.push({ b, p: [top, end, side] }); if (focus && !dim) poly(sp > 0.02 ? hullOf(top, end, side) : side, null, b.viol === 'warning' ? th.warn : th.err, 1.5); }
        if (it.house === 1) { ctx.fillStyle = th.edge; for (let w = 0; w < 4; w++) { const z = Z1 - 3 - w * 3.6; const pA = P(xs, Y0 + 2, z), pB = P(xs, Y1 - 2, z); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.strokeStyle = th.hullLine; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; } }
      }
    };
    layer(false);
    const deckPts = []; HULL.forEach(([x, d]) => deckPts.push(P(x, d, DECKZ))); HULL.slice().reverse().forEach(([x, d]) => deckPts.push(P(x, -d, DECKZ)));
    ctx.globalAlpha = transparent ? 0.45 : 1; poly(deckPts, th.deck, th.hullLine, 0.8); ctx.globalAlpha = 1;
    layer(true);
    ctx.globalAlpha = transparent ? 0.2 : 0.97;
    near.forEach(({ f }) => poly(f.map((p) => P(...p)), th.hull, null));
    ctx.globalAlpha = 1;
    near.forEach(({ f }) => poly(f.map((p) => P(...p)), null, th.hullLine, 0.8));
    // waterline on visible side
    const side = cy < 0 ? 1 : -1; ctx.setLineDash([4, 3]); ctx.strokeStyle = th.water; ctx.lineWidth = 1.2; ctx.beginPath();
    HULL.forEach(([x, d, b, z], k) => { const draft = 12.1 + ((150 - x) / 300) * 0.62, zw = -24 + draft; const f = Math.max(0, Math.min(1, (zw - z) / (DECKZ - z))); const hb = b + (d - b) * f; const p = P(x, side * hb, Math.max(z, zw)); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke(); ctx.setLineDash([]);
    this.hits = drawn;

    const outline = (key, color, lw, dash) => { const h = drawn.find((d) => d.b.key === key); if (!h) return; if (dash) ctx.setLineDash(dash); poly(hullOf(...h.p), null, color, lw); ctx.setLineDash([]); };
    if (o.hover) outline(o.hover, th.text, 1.5);
    if (o.selected) outline(o.selected, th.accent, 2);
    if (o.ghost) {
      const g = o.ghost, X0 = g.x - 6.1, X1 = g.x + 6.1, Y0 = g.y - 1.22, Y1 = g.y + 1.22, Z0 = g.z - 1.3, Z1 = g.z + 1.3, xf = sy < 0 ? X1 : X0, yf = cy < 0 ? Y1 : Y0;
      const pts = hullOf([P(X0, Y0, Z1), P(X1, Y0, Z1), P(X1, Y1, Z1), P(X0, Y1, Z1)], [P(xf, Y0, Z0), P(xf, Y1, Z0), P(xf, Y1, Z1), P(xf, Y0, Z1)], [P(X0, yf, Z0), P(X1, yf, Z0), P(X1, yf, Z1), P(X0, yf, Z1)]);
      ctx.globalAlpha = 0.35; poly(pts, g.ok ? th.ok : th.err); ctx.globalAlpha = 1; ctx.setLineDash([3, 2]); poly(pts, null, g.ok ? th.ok : th.err, 1.5); ctx.setLineDash([]);
    }
    ctx.font = "500 10px 'IBM Plex Mono', monospace"; ctx.fillStyle = th.text2; ctx.textAlign = 'center';
    const bow = P(176, 0, 4), stern = P(-170, 0, 4);
    ctx.fillText('BOW', bow[0], bow[1]); ctx.fillText('STERN', stern[0], stern[1]);
    if (o.bayLabel) { const p = P(o.bayLabel.x + gapOf(o.bayLabel.i), 0, 22); const t = o.bayLabel.text; ctx.font = "600 11px 'IBM Plex Mono', monospace"; const w = ctx.measureText(t).width + 12; ctx.fillStyle = th.accent; ctx.fillRect(p[0] - w / 2, p[1] - 18, w, 18); ctx.fillStyle = th.onAccent; ctx.fillText(t, p[0], p[1] - 5); ctx.fillStyle = th.accent; ctx.fillRect(p[0] - 0.5, p[1], 1, 8); }
  }
}
function hullOf(...polys) {
  const pts = polys.flat().map((p) => [p[0], p[1]]); pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }

function toBoxes(slots, viol, slotPos) {
  const vmap = {}; viol.forEach((v) => v.slots.forEach((k) => { if (!vmap[k] || v.sev === 'error') vmap[k] = v.sev; }));
  const out = [];
  for (const k in slots) { const s = slots[k], p = slotPos(k, s.len); out.push({ key: k, i: p.i, x: p.x, y: p.y, z: p.z, hx: s.len === 20 ? 2.95 : 6.05, hy: 1.2, hz: s.type === '40HC' || s.type === 'RF' ? 1.33 : 1.2, pod: s.pod, w: s.w, type: s.type, deck: s.deck, viol: vmap[k] }); }
  return out;
}

return { PRESETS, Stow3D, toBoxes };
})();
// View-model + actions for Stowline Workspace.dc.html


export { S };

export const THEMES = {
  dark: {
    vars: { '--bg': '#0B1220', '--surface': '#111A2B', '--raised': '#18233A', '--border': '#26334D', '--border2': '#33415E', '--text': '#E6EDF7', '--text2': '#9FB0C8', '--text3': '#8193AD', '--accent': '#3B9EFF', '--accentbg': 'rgba(59,158,255,0.14)', '--onaccent': '#06111F', '--err': '#FF5D5D', '--errbg': 'rgba(255,93,93,0.12)', '--onerr': '#0B1220', '--warn': '#FFB020', '--warnbg': 'rgba(255,176,32,0.12)', '--ok': '#2FD08A', '--okbg': 'rgba(47,208,138,0.14)', '--hover': '#162238', '--sel': '#132B49', '--track': '#22304A' },
    g: { bg: '#0B1220', hull: '#1A2640', hullIn: '#0E1626', hullLine: '#3A4B6B', deck: '#1C2943', house: '#C3CCDA', edge: 'rgba(8,13,24,0.6)', dim: '#2A3650', neutral: '#43506A', text: '#E6EDF7', text2: '#9FB0C8', accent: '#3B9EFF', onAccent: '#06111F', err: '#FF5D5D', warn: '#FFB020', ok: '#2FD08A', water: 'rgba(59,158,255,0.75)' },
  },
  light: {
    vars: { '--bg': '#EDF1F6', '--surface': '#FFFFFF', '--raised': '#F5F7FA', '--border': '#D3DBE6', '--border2': '#BCC7D6', '--text': '#0E1726', '--text2': '#3F4F67', '--text3': '#56667E', '--accent': '#0B6BD3', '--accentbg': 'rgba(11,107,211,0.10)', '--onaccent': '#FFFFFF', '--err': '#C42B2B', '--errbg': 'rgba(196,43,43,0.08)', '--onerr': '#FFFFFF', '--warn': '#9A5800', '--warnbg': 'rgba(176,108,0,0.10)', '--ok': '#0A7A4A', '--okbg': 'rgba(10,122,74,0.10)', '--hover': '#F0F4F9', '--sel': '#E3EEFB', '--track': '#E2E8F0' },
    g: { bg: '#EDF1F6', hull: '#C9D3E1', hullIn: '#DCE3EC', hullLine: '#8E9CB2', deck: '#D5DDE8', house: '#FFFFFF', edge: 'rgba(14,23,38,0.45)', dim: '#C3CCD9', neutral: '#9AA7BA', text: '#0E1726', text2: '#3F4F67', accent: '#0B6BD3', onAccent: '#FFFFFF', err: '#C42B2B', warn: '#B06C00', ok: '#0A7A4A', water: 'rgba(11,107,211,0.8)' },
  },
};
const RULES = [['stack', 'Stack weight'], ['reefer', 'Reefer power'], ['dg', 'DG segregation'], ['overstow', 'Overstow'], ['twenty', '20/40 stacking'], ['heavy', 'Weight order']];
const CAM = [['iso', 'Iso', 'Three-quarter view'], ['port', 'Port', 'From port side'], ['stbd', 'Stbd', 'From starboard'], ['top', 'Top', 'Plan view'], ['bow', 'Bow', 'From ahead']];
const MODES = [['pod', 'POD'], ['weight', 'Weight'], ['type', 'Type'], ['viol', 'Violations']];
const f1 = S.fmt1, f2 = (n) => n.toFixed(2);
const sgn = (n, d = 2) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
const PODC = (p) => S.PODS[p].color;

export function initState(scene) {
  const slots = S.createPlan(), list = S.createLoadList(slots);
  const st = { ready: true, slots, list, hist: [], fut: [], centerTab: 'split', rightTab: 'inspector', leftOpen: true, rightOpen: true, bay: 18, sel: '180486', focus: '180486', checked: {}, q: '', fPod: null, fType: null, fRf: false, fDg: false, fUn: true, sortK: 'w', sortD: -1, colorMode: 'pod', cam: 'iso', hullT: true, onlyPod: '', hover: null, selViol: null, vFilter: 'all', drawer: false, play: null, drag: null, over: null, held: null, gridFocused: false, toast: null, announce: 'Bay grid: arrow keys move between slots. Enter picks up a container.', srText: '', planned: S.COUNTS.planned, stab: { gm: S.STAB.gm, trim: S.STAB.trim, list: S.STAB.list }, newV: null, shake: null, settle: null, swapFrom: null };
  st.stabShown = Object.assign({}, st.stab);
  list.filter((x) => !x.planned).slice(3, 6).forEach((x) => (st.checked[x.id] = true));
  if (scene === 'drag') Object.assign(st, { drag: { box: list[0], from: null }, over: '180688', sel: null });
  if (scene === 'bay') {
    const held = { key: '180488', box: slots['180488'] };
    const tg = S.validTargets(slots, held.box, held.key, 18);
    const focus = tg.find((k) => k.slice(2, 4) === '02') || tg[0];
    Object.assign(st, { centerTab: 'bay', leftOpen: false, rightOpen: false, held, focus, sel: '180284', gridFocused: true, announce: `Picked up ${held.box.id} from 180488. ${tg.length} valid targets in bay 18. Focus ${focus}: valid target, stack ${f1(S.stackWeight(slots, 18, 2, true) + held.box.w)} t of 90.0 t.` });
  }
  if (scene === 'violations') Object.assign(st, { rightTab: 'violations', selViol: 'stack:18-4-D', sel: '180488', focus: '180488' });
  if (scene === 'stability') st.drawer = true;
  if (scene === 'playback') Object.assign(st, { centerTab: '3d', play: { port: 1, playing: true }, sel: '100382', focus: '100382', bay: 10 });
  return st;
}

export function makeActions(c) {
  const A = {};
  const st = () => c.state;
  A.viol = (slots = st().slots) => { if (c._vs !== slots) { c._vs = slots; c._v = S.computeViolations(slots); } return c._v; };
  A.fixes = () => { const slots = st().slots; if (c._fs !== slots) { c._fs = slots; c._f = {}; A.viol().forEach((v) => (c._f[v.id] = S.suggestFix(v, slots))); } return c._f; };
  A.toastLater = () => { clearTimeout(c._tt); c._tt = setTimeout(() => c.setState({ toast: null }), 5200); };
  A.toast = (t) => { c.setState({ toast: t, srText: t.title + '. ' + (t.msg || '') }); A.toastLater(); };
  A.stabTo = (d) => {
    const from = Object.assign({}, st().stabShown), to = { gm: st().stab.gm + d.gm, trim: st().stab.trim + d.trim, list: st().stab.list + d.list };
    c.setState({ stab: to });
    if (c.props.reducedMotion) { c.setState({ stabShown: to }); return; }
    const t0 = performance.now(); cancelAnimationFrame(c._cr);
    const step = () => { const t = Math.min(1, (performance.now() - t0) / 300), e = 1 - Math.pow(1 - t, 3); c.setState({ stabShown: { gm: from.gm + (to.gm - from.gm) * e, trim: from.trim + (to.trim - from.trim) * e, list: from.list + (to.list - from.list) * e } }); if (t < 1) c._cr = requestAnimationFrame(step); };
    c._cr = requestAnimationFrame(step);
  };
  A.apply = (op, opts = {}) => {
    const s0 = st(), slots = Object.assign({}, s0.slots); let list = s0.list, planned = s0.planned; const d = { gm: 0, trim: 0, list: 0 };
    const add = (x, k = 1) => { d.gm += x.gm * k; d.trim += x.trim * k; d.list += x.list * k; };
    const at = (b, key) => { const p = S.parseKey(key); return Object.assign({}, b, { bay: p.bay, row: p.row, tier: p.tier, deck: p.tier >= 82 }); };
    let title = 'Plan updated', msg = '';
    if (op.kind === 'move') { const b = slots[op.from]; delete slots[op.from]; slots[op.to] = at(b, op.to); add(S.stabDelta(b, op.from, op.to)); title = 'Moved ' + b.id; msg = `${op.from} → ${op.to}`; }
    if (op.kind === 'place') { const it = list.find((x) => x.id === op.id); const b = at({ id: it.id, type: it.type, w: it.w, pod: it.pod, pol: 'SGSIN', rf: it.rf, dg: it.dg, temp: it.temp, locked: false, len: it.len }, op.to); slots[op.to] = b; list = list.map((x) => (x.id === op.id ? Object.assign({}, x, { planned: true, slot: op.to }) : x)); planned++; add(S.stabDelta(b, null, op.to)); title = 'Placed ' + b.id; msg = 'Slot ' + op.to; }
    if (op.kind === 'unplace') { const b = slots[op.from]; delete slots[op.from]; const ex = list.find((x) => x.id === b.id); list = ex ? list.map((x) => (x.id === b.id ? Object.assign({}, x, { planned: false, slot: null }) : x)) : [Object.assign({}, b, { planned: false, slot: null })].concat(list); planned--; add(S.stabDelta(b, null, op.from), -1); title = 'Unplaced ' + b.id; msg = 'Returned to load list'; }
    if (op.kind === 'swap') { const a = slots[op.a], b = slots[op.b]; slots[op.a] = at(b, op.a); slots[op.b] = at(a, op.b); add(S.stabDelta(a, op.a, op.b)); add(S.stabDelta(b, op.b, op.a)); title = 'Swapped'; msg = `${op.a} ↔ ${op.b}`; }
    if (op.kind === 'lock') { slots[op.key] = Object.assign({}, slots[op.key], { locked: !slots[op.key].locked }); title = slots[op.key].locked ? 'Locked ' + op.key : 'Unlocked ' + op.key; }
    const before = A.viol(s0.slots), after = S.computeViolations(slots);
    c._vs = slots; c._v = after;
    const bI = new Set(before.map((v) => v.id)), aI = new Set(after.map((v) => v.id));
    const added = after.filter((v) => !bI.has(v.id)), resolved = before.filter((v) => !aI.has(v.id));
    const toast = added.length ? { kind: 'warn', title: 'New violation · ' + added[0].title, msg: added[0].msg, undo: true } : resolved.length ? { kind: 'ok', title: 'Resolved · ' + resolved[0].title, msg: resolved[0].msg, undo: true } : { kind: 'ok', title, msg, undo: true };
    const hist = s0.hist.concat([{ op, slots: s0.slots, list: s0.list, planned: s0.planned, d }]);
    const settle = op.to || op.b || null;
    c.setState({ slots, list, planned, hist, fut: opts.redo ? s0.fut : [], newV: added.map((v) => v.id), settle, toast, srText: toast.title + '. ' + toast.msg, held: null, drag: null, over: null, swapFrom: null, sel: op.to || op.key || op.a || s0.sel, focus: op.to || s0.focus }, () => A.stabTo(d));
    A.toastLater(); clearTimeout(c._st); c._st = setTimeout(() => c.setState({ settle: null, newV: null }), 400);
  };
  A.undo = () => { const s0 = st(); if (!s0.hist.length) return; const h = s0.hist[s0.hist.length - 1]; c.setState({ slots: h.slots, list: h.list, planned: h.planned, hist: s0.hist.slice(0, -1), fut: s0.fut.concat([h.op]) }, () => A.stabTo({ gm: -h.d.gm, trim: -h.d.trim, list: -h.d.list })); A.toast({ kind: 'info', title: 'Undone', msg: '' }); };
  A.redo = () => { const s0 = st(); if (!s0.fut.length) return; const op = s0.fut[s0.fut.length - 1]; c.setState({ fut: s0.fut.slice(0, -1) }, () => A.apply(op, { redo: true })); };
  A.reject = (key, reason, box) => { c.setState({ shake: key }); setTimeout(() => c.setState({ shake: null }), 260); A.toast({ kind: 'err', title: `Can't place ${box.id} at ${key}`, msg: reason || 'Not a valid slot' }); };
  A.tryPlace = (key, box, fromKey, listId) => {
    if (c.props.mode && c.props.mode !== 'edit') { c.setState({ drag: null, over: null }); return false; }
    const chk = S.checkPlace(st().slots, key, box, fromKey);
    if (!chk.target || !chk.ok) { A.reject(key, chk.reason || (chk.occupied ? 'Slot is occupied' : 'No container below this slot'), box); c.setState({ drag: null, over: null }); return false; }
    A.apply(listId ? { kind: 'place', id: listId, to: key } : { kind: 'move', from: fromKey, to: key });
    return true;
  };
  A.showViol = (v) => {
    const b = S.bayByNum(v.bay);
    c.setState({ selViol: v.id, bay: v.bay, sel: v.slot, focus: v.slot, rightTab: 'violations', rightOpen: true, centerTab: st().centerTab === 'bay' ? 'split' : st().centerTab });
    c.r && c.r.fly({ yaw: 214, pitch: 30, zoom: 2.7, tx: b.x - 6, ty: 0, tz: 4 }, 600);
  };
  A.clearFocus = () => { c.setState({ selViol: null }); c.r && c.r.fly(PRESETS[st().cam], 600); };
  A.setCam = (k) => { c.setState({ cam: k }); c.r && c.r.fly(PRESETS[k], 600); };
  A.setBay = (n) => { const s0 = st(); const B = S.bayByNum(n); const top = Object.keys(s0.slots).filter((k) => +k.slice(0, 2) === n).sort()[0]; c.setState({ bay: n, focus: s0.held ? s0.focus.replace(/^\d\d/, S.pad(n)) : top || S.slotKey(n, B.rows[0], 82) }); };
  A.stepBay = (d) => { const i = S.bayByNum(st().bay).i + d; if (i >= 0 && i < S.BAYS.length) A.setBay(S.BAYS[i].bay); };
  A.cellDesc = (k) => {
    const s0 = st(), b = s0.slots[k], v = A.viol().find((x) => x.slots.includes(k));
    let t = `${k}: ${b ? `${b.id}, ${S.PODS[b.pod].name}, ${f1(b.w)} t${b.locked ? ', locked' : ''}` : 'empty'}`;
    const p = S.parseKey(k); if (S.hasPlug(p.bay, p.row, p.tier)) t += ', reefer plug';
    if (v) t += `. ${v.sev === 'error' ? 'Error' : 'Warning'}: ${v.msg}`;
    const mv = s0.held || (s0.drag && { box: s0.drag.box, key: s0.drag.from });
    if (mv) { const ch = S.checkPlace(s0.slots, k, mv.box, mv.key); if (ch.target) t += ch.ok ? (ch.warns.length ? `. Valid with warning: ${ch.warns[0].text}` : `. Valid target, stack ${f1(ch.sum)} t of ${f1(ch.lim)} t`) : `. Invalid: ${ch.reason}`; }
    return t;
  };
  A.moveFocus = (dr, dt) => {
    const s0 = st(), B = S.bayByNum(s0.bay), tiers = B.deckTiers.slice().reverse().concat(B.holdTiers.slice().reverse());
    const p = S.parseKey(s0.focus); let ri = S.ALL_ROWS.indexOf(p.row), ti = tiers.indexOf(p.tier); if (ti < 0) ti = 0;
    for (let n = 0; n < 20; n++) { ri += dr; ti += dt; if (ri < 0 || ri > 15 || ti < 0 || ti >= tiers.length) return; const r = S.ALL_ROWS[ri], t = tiers[ti]; if (S.slotExists(B.bay, r, t)) { const k = S.slotKey(B.bay, r, t); c.setState({ focus: k, sel: s0.held ? s0.sel : k, announce: A.cellDesc(k) }); return; } }
  };
  A.isTop = (k) => { const s0 = st(), p = S.parseKey(k), tiers = p.tier >= 82 ? S.DECK_TIERS : S.HOLD_TIERS; return tiers.filter((t) => t > p.tier).every((t) => !s0.slots[S.slotKey(p.bay, p.row, t)]); };
  A.enter = () => {
    const s0 = st(), k = s0.focus;
    if (c.props.mode && c.props.mode !== 'edit') return c.setState({ announce: `${A.cellDesc(k)}. ${c.props.mode === 'approved' ? 'This plan is approved and read only.' : 'Your role cannot change plans.'}` });
    if (s0.held) { if (A.tryPlace(k, s0.held.box, s0.held.key)) c.setState({ announce: `Placed ${s0.held.box.id} at ${k}.` }); else c.setState({ announce: `Cannot place at ${k}. ${S.checkPlace(s0.slots, k, s0.held.box, s0.held.key).reason || 'Not a valid slot'}. Still holding ${s0.held.box.id}.` }); return; }
    const b = s0.slots[k];
    if (!b) return c.setState({ announce: `${k} is empty. Nothing to pick up.` });
    if (b.locked) return c.setState({ announce: `${b.id} at ${k} is locked. Unlock it in the Inspector first.` });
    if (!A.isTop(k)) return c.setState({ announce: `${b.id} is under other containers. Only the top of a stack can be picked up.` });
    const n = S.validTargets(s0.slots, b, k, s0.bay).length;
    c.setState({ held: { key: k, box: b }, announce: `Picked up ${b.id} from ${k}. ${n} valid targets in bay ${S.pad(s0.bay)}. Arrow keys to move, Enter to place, Esc to cancel.` });
  };
  A.cancel = () => { const s0 = st(); if (s0.held || s0.drag || s0.swapFrom) c.setState({ held: null, drag: null, over: null, swapFrom: null, announce: 'Cancelled. Container returned to its slot.' }); else if (s0.selViol) A.clearFocus(); else if (s0.drawer) c.setState({ drawer: false }); };
  A.cellClick = (k) => {
    const s0 = st();
    if (s0.swapFrom) { if (s0.slots[k] && k !== s0.swapFrom) A.apply({ kind: 'swap', a: s0.swapFrom, b: k }); else c.setState({ swapFrom: null }); return; }
    if (s0.held || s0.drag) { const mv = s0.held || { key: s0.drag.from, box: s0.drag.box }; A.tryPlace(k, mv.box, mv.key, s0.drag && !s0.drag.from ? s0.drag.box.id : null); return; }
    c.setState({ focus: k, sel: s0.slots[k] ? k : s0.sel, announce: A.cellDesc(k) });
  };
  A.playStep = (d) => { const p = st().play; if (!p) return; let n = p.port + d; if (n > 4) n = 1; if (n < 1) n = 4; c.setState({ play: Object.assign({}, p, { port: n }) }); };
  A.playToggle = () => { const p = st().play; c.setState({ play: Object.assign({}, p, { playing: !p.playing }) }); };
  A.validate = () => { const v = A.viol(); const e = v.filter((x) => x.sev === 'error').length; c.setState({ rightTab: 'violations', rightOpen: true, lastRun: new Date() }); A.toast({ kind: e ? 'err' : 'ok', title: `Validation complete · ${v.length} issue${v.length === 1 ? '' : 's'}`, msg: `${e} error${e === 1 ? '' : 's'}, ${v.length - e} warning${v.length - e === 1 ? '' : 's'}. Plan can't be approved while errors remain.` }); };
  A.save = () => A.toast({ kind: 'ok', title: 'Draft saved', msg: `Plan 042W-SGSIN · ${st().planned} of 1,240 planned · version 14` });
  return A;
}

export function createRenderer(c) {
  const cv = c.canvasRef.current, pane = c.paneRef.current; if (!cv || !pane) return null;
  const r = new Stow3D(cv);
  c.ro = new ResizeObserver(() => { const b = pane.getBoundingClientRect(); if (b.width && b.height) r.resize(b.width, b.height); });
  c.ro.observe(pane);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); r.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  const sc = c.props.scene;
  if (sc === 'violations') { const b = S.bayByNum(18); Object.assign(r.cam, { yaw: 214, pitch: 30, zoom: 2.7, tx: b.x - 6, ty: 0, tz: 4 }); }
  return r;
}

export function syncRenderer(c) {
  const r = c.r, s = c.state, A = c.A; if (!r || !s.ready) return;
  if (c._bs !== s.slots) { c._bs = s.slots; c._boxes = toBoxes(s.slots, A.viol(), S.slotPos); r._liftKey = null; }
  const v = s.selViol && A.viol().find((x) => x.id === s.selViol);
  const B = S.bayByNum(s.bay);
  let ghost = null;
  if (s.drag && s.over) { const p = S.slotPos(s.over, 40); const ch = S.checkPlace(s.slots, s.over, s.drag.box, s.drag.from); ghost = Object.assign(p, { ok: ch.target && ch.ok }); }
  const th = THEMES[c.props.theme === 'light' ? 'light' : 'dark'].g;
  const order = {}; S.POD_LIST.forEach((p) => (order[p] = S.PODS[p].order));
  r.set({ houseX: S.DECKHOUSE_X, boxes: c._boxes, theme: th, colorMode: s.colorMode, hullTransparent: s.hullT, onlyPod: s.onlyPod || null, focus: v ? new Set(v.slots) : null, selected: s.sel, hover: s.hover && s.hover.key, ghost, pods: S.PODS, reduced: !!c.props.reducedMotion, lift: s.play ? { pod: S.POD_LIST[s.play.port - 1], port: s.play.port, order } : null, bayLabel: s.play ? null : { x: B.x, i: B.i, text: 'BAY ' + S.pad(s.bay) }, padY: s.play ? -40 : 0 });
  if (!s.play) r.setGap(B.i); else if (r.gapI !== -1) r.setGap(-1);
}

function mkCell(c, s, B, r, t, big, vmap, mv, prev) {
  const k = S.slotKey(B.bay, r, t), ex = S.slotExists(B.bay, r, t);
  if (!ex) return { key: k, domId: 'x' + k, vis: 'hidden', bg: 'transparent', img: 'none', bd: '0', sh: 'none', ol: 'none', fg: 'inherit', anim: 'none', z: 0 };
  const b = s.slots[k], origin = mv && mv.key === k, show = b && !origin, v = vmap[k];
  const plug = S.hasPlug(B.bay, r, t);
  const ch = mv ? S.checkPlace(s.slots, k, mv.box, mv.key) : null;
  const tgt = ch && ch.target && !origin, valid = tgt && ch.ok && !ch.warns.length, warnT = tgt && ch.ok && ch.warns.length, invalid = tgt && !ch.ok;
  const focused = k === s.focus && (s.gridFocused || s.held), selected = k === s.sel && show;
  let bg = show ? PODC(b.pod) : valid ? 'var(--okbg)' : warnT ? 'var(--warnbg)' : 'transparent';
  let img = 'none';
  if (show && b.locked) img = 'repeating-linear-gradient(135deg, rgba(11,18,32,0.30) 0 2px, transparent 2px 6px)';
  if (invalid) img = 'repeating-linear-gradient(135deg, rgba(255,93,93,0.42) 0 2px, transparent 2px 6px)';
  const bd = invalid ? '1px solid var(--err)' : valid ? '1px solid var(--ok)' : warnT ? '1px solid var(--warn)' : origin ? '1px dashed var(--accent)' : show ? '1px solid rgba(11,18,32,0.35)' : '1px solid var(--border)';
  const sh = [selected ? '0 0 0 2px var(--text)' : '', show && v ? 'inset 0 0 0 2px ' + (v.sev === 'error' ? '#B3141B' : '#8A5A00') : ''].filter(Boolean).join(', ') || 'none';
  const isOver = s.drag && s.over === k;
  const box = show ? b : null;
  const aria = A_desc(s, k, b, v, plug, ch, origin);
  return {
    key: k, domId: 'c' + c._uid + k, vis: 'visible', bg, img, bd, sh, ol: focused ? '2px solid var(--accent)' : 'none', fg: show ? '#0B1220' : 'var(--text3)', z: isOver || focused ? 3 : 1,
    anim: s.shake === k ? 'stw-shake 220ms' : s.settle === k ? 'stw-settle 180ms ease-out' : 'none',
    big: !!(big && box), small: !!(!big && box), l4: box ? box.id.slice(-8, -2).slice(-4) : '', pod: box ? S.PODS[box.pod].short : '', wt: box ? f1(box.w) : '',
    lock: !!(big && box && box.locked), plug: !!(big && plug && !(box && box.rf)), rf: !!(big && box && box.rf), dg: !!(big && box && box.dg), dgTxt: box && box.dg ? box.dg : '',
    iconFg: box ? '#0B1220' : 'var(--text3)', vx: !!(box && v), vxBg: v && v.sev === 'error' ? '#FF5D5D' : '#FFB020',
    ghost: !!(s.held && focused && !b), gColor: s.held ? PODC(s.held.box.pod) : '', gL4: s.held ? s.held.box.id.slice(-6, -2) : '', gPod: s.held ? S.PODS[s.held.box.pod].short : '',
    dragGhost: !!isOver, dgColor: s.drag ? PODC(s.drag.box.pod) : '', dgL4: s.drag ? s.drag.box.id.slice(-6, -2) : '', dgPod: s.drag ? S.PODS[s.drag.box.pod].short : '', dgW: s.drag ? f1(s.drag.box.w) : '',
    tip: !!(isOver && ch && ch.target), tipErr: !!(invalid), tipOk: !!(valid || warnT), tipBd: invalid ? 'var(--err)' : valid ? 'var(--ok)' : 'var(--warn)', tipFg: invalid ? 'var(--err)' : valid ? 'var(--ok)' : 'var(--warn)', tipTitle: ch && ch.target ? ch.reason || `Valid · stack ${f1(ch.sum)} t of ${f1(ch.lim)} t` : '', tipSub: invalid ? `Drop disabled at ${k}` : `Drop to place at ${k}${prev ? ' · ' + prev : ''}`,
    aria, ariaSel: selected ? 'true' : 'false', draggable: !!(box && !box.locked && c.A.isTop(k)),
    onClick: () => c.A.cellClick(k),
    onDragStart: (e) => { e.dataTransfer.setData('text/plain', k); e.dataTransfer.effectAllowed = 'move'; c.setState({ drag: { box: b, from: k } }); },
    onDragOver: (e) => { if (!c.state.drag) return; e.preventDefault(); if (c.state.over !== k) c.setState({ over: k }); },
    onDrop: (e) => { e.preventDefault(); const d = c.state.drag; if (!d) return; c.A.tryPlace(k, d.box, d.from, d.from ? null : d.box.id); },
  };
}
function A_desc(s, k, b, v, plug, ch, origin) {
  let t = k + ', ' + (b && !origin ? `${b.id}, ${S.PODS[b.pod].name}, ${f1(b.w)} tonnes` : 'empty');
  if (plug) t += ', reefer plug'; if (b && b.locked) t += ', locked'; if (v) t += `, ${v.sev}: ${v.msg}`;
  if (ch && ch.target) t += ch.ok ? ', valid target' : ', invalid target: ' + ch.reason;
  return t;
}

export function buildVM(c) {
  const s = c.state, A = c.A;
  const viol = A.viol(), fixes = A.fixes();
  const errs = viol.filter((v) => v.sev === 'error'), warns = viol.filter((v) => v.sev === 'warning');
  const vmap = {}; viol.forEach((v) => v.slots.forEach((k) => { if (!vmap[k] || v.sev === 'error') vmap[k] = v; }));
  const B = S.bayByNum(s.bay), big = s.centerTab === 'bay';
  const mv = s.held || (s.drag ? { key: s.drag.from, box: s.drag.box } : null);
  // preview delta
  let pd = null, pTarget = s.drag ? s.over : s.held ? s.focus : null;
  if (mv && pTarget) { const ch = S.checkPlace(s.slots, pTarget, mv.box, mv.key); if (ch.target) pd = S.stabDelta(mv.box, mv.key, pTarget); }
  const prevTxt = pd ? `Trim ${sgn(pd.trim)} m` : '';
  const vals = {};

  // ---------- TopBar
  vals.rotation = S.ROTATION.map((p, i) => ({ code: p.code, title: `${p.name} · ${p.when}`, notFirst: i > 0, done: p.state === 'done', current: p.state === 'current', swatch: !!S.PODS[p.code], color: S.PODS[p.code] ? PODC(p.code) : 'transparent', ariaCurrent: p.state === 'current' ? 'step' : 'false', bd: p.state === 'current' ? 'var(--accent)' : 'var(--border)', bg: p.state === 'current' ? 'var(--accentbg)' : 'transparent', fg: p.state === 'done' ? 'var(--text3)' : 'var(--text)', fw: p.state === 'current' ? 600 : 500 }));
  vals.plannedTxt = s.planned.toLocaleString('en-US'); vals.plannedPct = ((s.planned / S.COUNTS.total) * 100).toFixed(1);
  vals.undoDisabled = !s.hist.length; vals.redoDisabled = !s.fut.length; vals.undoOp = s.hist.length ? 1 : 0.4; vals.redoOp = s.fut.length ? 1 : 0.4;
  vals.violCount = viol.length;

  // ---------- LoadList
  const q = s.q.trim().toLowerCase();
  let rows = s.list.filter((x) => (!s.fUn || !x.planned) && (!s.fPod || x.pod === s.fPod) && (!s.fType || x.type === s.fType) && (!s.fRf || x.rf) && (!s.fDg || x.dg) && (!q || (x.id + ' ' + x.pod + ' ' + x.type + ' ' + S.PODS[x.pod].name + ' ' + (x.slot || '')).toLowerCase().includes(q)));
  const key = s.sortK; rows = rows.slice().sort((a, b) => { const va = key === 'pod' ? S.PODS[a.pod].order : a[key], vb = key === 'pod' ? S.PODS[b.pod].order : b[key]; return (va > vb ? 1 : va < vb ? -1 : 0) * s.sortD; });
  const cyc = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];
  vals.chips = [
    { label: s.fPod ? 'POD: ' + S.PODS[s.fPod].short : 'POD', caret: true, swatch: !!s.fPod, color: s.fPod ? PODC(s.fPod) : '', on: !!s.fPod, onClick: () => c.setState({ fPod: cyc([null].concat(S.POD_LIST), s.fPod) }) },
    { label: s.fType ? 'Type: ' + s.fType : 'Type', caret: true, on: !!s.fType, onClick: () => c.setState({ fType: cyc([null, '40HC', '40GP', '20GP', 'RF', 'TK', 'OT'], s.fType) }) },
    { label: 'Reefer', on: s.fRf, onClick: () => c.setState({ fRf: !s.fRf }) },
    { label: 'DG', on: s.fDg, onClick: () => c.setState({ fDg: !s.fDg }) },
    { label: 'Unplanned only', on: s.fUn, onClick: () => c.setState({ fUn: !s.fUn }) },
  ].map((x) => Object.assign(x, { pressed: x.on ? 'true' : 'false', bd: x.on ? 'var(--accent)' : 'var(--border2)', bg: x.on ? 'var(--accentbg)' : 'transparent', fg: x.on ? 'var(--text)' : 'var(--text2)', swatch: !!x.swatch, caret: !!x.caret }));
  const sortH = (k, label, right) => ({ label, right: !!right, arrow: s.sortK === k ? (s.sortD > 0 ? '▲' : '▼') : '', ariaSort: s.sortK === k ? (s.sortD > 0 ? 'ascending' : 'descending') : 'none', fg: s.sortK === k ? 'var(--text)' : 'var(--text2)', onClick: () => c.setState({ sortK: k, sortD: s.sortK === k ? -s.sortD : k === 'w' ? -1 : 1 }) });
  vals.sortCols = [sortH('id', 'Container'), sortH('type', 'Type'), sortH('w', 't', true), sortH('pod', 'POD'), { label: 'Flags', arrow: '', ariaSort: 'none', fg: 'var(--text2)', onClick: null, right: true }].map((h) => Object.assign(h, { just: h.right ? 'flex-end' : 'flex-start' }));
  vals.rows = rows.map((x) => {
    const sel = !!s.checked[x.id], dragging = s.drag && s.drag.box.id === x.id;
    return { id: x.id, type: x.type, wt: f1(x.w), pod: S.PODS[x.pod].short, podColor: PODC(x.pod), rf: !!x.rf, temp: x.temp || '', dg: !!x.dg, dgTxt: x.dg || '', planned: !!x.planned, slot: x.slot || '', checked: sel, ariaSel: sel ? 'true' : 'false', ariaChecked: sel ? 'true' : 'false', cbBd: sel ? 'var(--accent)' : 'var(--border2)', cbBg: sel ? 'var(--accent)' : 'transparent', bg: dragging ? 'var(--accentbg)' : sel ? 'var(--sel)' : 'transparent', op: dragging ? 0.55 : 1, idFg: x.planned ? 'var(--text2)' : 'var(--text)', outline: dragging ? '1px dashed var(--accent)' : 'none', draggable: !x.planned,
      onCheck: (e) => { e.stopPropagation(); const ch = Object.assign({}, c.state.checked); ch[x.id] ? delete ch[x.id] : (ch[x.id] = true); c.setState({ checked: ch }); },
      onClick: () => { if (x.planned && x.slot) { c.setState({ sel: x.slot, bay: +x.slot.slice(0, 2), focus: x.slot }); } else { const ch = Object.assign({}, c.state.checked); ch[x.id] ? delete ch[x.id] : (ch[x.id] = true); c.setState({ checked: ch }); } },
      onDragStart: (e) => { e.dataTransfer.setData('text/plain', x.id); e.dataTransfer.effectAllowed = 'move'; c.setState({ drag: { box: x, from: null } }); },
      onKey: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); const ch = Object.assign({}, c.state.checked); ch[x.id] ? delete ch[x.id] : (ch[x.id] = true); c.setState({ checked: ch }); } },
    };
  });
  vals.listEmpty = rows.length === 0; vals.listHas = rows.length > 0; vals.qTxt = s.q;
  const checkedList = s.list.filter((x) => s.checked[x.id]);
  vals.selCount = checkedList.length; vals.selWeight = f1(checkedList.reduce((a, x) => a + x.w, 0));
  vals.shownCount = rows.length; vals.unplannedTxt = (S.COUNTS.total - s.planned).toLocaleString('en-US');
  vals.listCount = (S.COUNTS.total).toLocaleString('en-US');

  // ---------- Center tabs
  vals.viewTabs = [['3d', '3D'], ['bay', 'Bay'], ['split', 'Split']].map(([k, l]) => ({ label: l, sel: s.centerTab === k ? 'true' : 'false', bg: s.centerTab === k ? 'var(--raised)' : 'transparent', fg: s.centerTab === k ? 'var(--text)' : 'var(--text2)', bd: s.centerTab === k ? 'var(--border2)' : 'transparent', onClick: () => c.setState({ centerTab: k }) }));
  vals.show3d = s.centerTab === 'bay' ? 'none' : 'block'; vals.flex3d = s.centerTab === 'split' ? '3 1 0' : '1 1 0';
  vals.showBay = s.centerTab === '3d' ? 'none' : 'flex'; vals.flexBay = s.centerTab === 'split' ? '2 1 0' : '1 1 0';
  vals.split = s.centerTab === 'split';
  vals.bayTxt = S.pad(s.bay);
  vals.bayInfo = `40ft · bays ${S.pad(s.bay - 1)} + ${S.pad(s.bay + 1)} · ${B.deckRows} rows deck, ${B.holdRows} hold`;
  const bayBoxes = Object.keys(s.slots).filter((k) => +k.slice(0, 2) === s.bay).length;
  const bayCap = B.rows.length * 6 + B.hRows.length * B.holdTiers.length;
  vals.bayFill = `${bayBoxes} / ${bayCap} slots`;
  vals.bayViol = viol.filter((v) => v.bay === s.bay).length;
  vals.hasBayViol = vals.bayViol > 0;

  // ---------- 3D overlays
  vals.camBtns = CAM.map(([k, l, t]) => ({ label: l, title: t, sel: s.cam === k ? 'true' : 'false', bg: s.cam === k ? 'var(--accentbg)' : 'transparent', fg: s.cam === k ? 'var(--accent)' : 'var(--text2)', onClick: () => A.setCam(k) }));
  vals.modeBtns = MODES.map(([k, l]) => ({ label: l, sel: s.colorMode === k ? 'true' : 'false', bg: s.colorMode === k ? 'var(--accentbg)' : 'transparent', fg: s.colorMode === k ? 'var(--accent)' : 'var(--text2)', onClick: () => c.setState({ colorMode: k }) }));
  vals.hullPressed = s.hullT ? 'true' : 'false'; vals.hullTxt = s.hullT ? '20%' : 'Solid'; vals.hullBg = s.hullT ? 'var(--accentbg)' : 'var(--surface)'; vals.hullFg = s.hullT ? 'var(--accent)' : 'var(--text2)';
  vals.onlyPod = s.onlyPod;
  const podCount = {}; S.POD_LIST.forEach((p) => (podCount[p] = 0)); for (const k in s.slots) podCount[s.slots[k].pod]++;
  const LEG = {
    pod: ['Port of discharge', S.POD_LIST.map((p) => ({ color: PODC(p), label: S.PODS[p].short, count: podCount[p].toLocaleString('en-US') }))],
    weight: ['VGM, tonnes', [['#22406E', '<8'], ['#38699A', '8–14'], ['#5B97C0', '14–20'], ['#A9CBDD', '20–26'], ['#F2D35B', '≥26']].map(([cc, l]) => ({ color: cc, label: l, count: '' }))],
    type: ['Container type', [['#7D8CA8', '40HC'], ['#56647D', '40GP'], ['#9AA9BF', '20GP'], ['#CFEAF6', 'RF'], ['#E3B25A', 'TK'], ['#B7997A', 'OT']].map(([cc, l]) => ({ color: cc, label: l, count: '' }))],
    viol: ['Rule status', [{ color: '#FF5D5D', label: 'Error', count: String(errs.length) }, { color: '#FFB020', label: 'Warning', count: String(warns.length) }, { color: '#43506A', label: 'Clear', count: '' }]],
  }[s.colorMode];
  vals.legendTitle = LEG[0]; vals.legend = LEG[1];
  vals.legendBottom = s.play ? 112 : 8;
  vals.totalBoxes = Object.keys(s.slots).length.toLocaleString('en-US');
  const hv = s.hover && s.slots[s.hover.key];
  vals.hoverTip = !!hv;
  if (hv) { const vv = vmap[s.hover.key]; vals.tip = { id: hv.id, slot: S.slotCode(hv), type: hv.type, wt: f1(hv.w), pod: S.PODS[hv.pod].short, podColor: PODC(hv.pod), podName: S.PODS[hv.pod].name, viol: !!vv, violMsg: vv ? vv.msg : '' }; vals.tipX = Math.min(s.hover.x, (c.r && c.r.w ? c.r.w : 800) - 220); vals.tipY = Math.min(s.hover.y, (c.r && c.r.h ? c.r.h : 400) - 100); }
  else { vals.tip = {}; vals.tipX = 0; vals.tipY = 0; }
  const fv = s.selViol && viol.find((v) => v.id === s.selViol);
  vals.focusBanner = !!fv; vals.focusCount = fv ? fv.slots.length : 0; vals.focusTitle = fv ? fv.title + ' · ' + fv.slot : '';

  // ---------- Bay grid
  vals.rowHdr = S.ALL_ROWS.map(S.pad);
  const mkTier = (t) => ({ label: S.pad(t), cells: S.ALL_ROWS.map((r) => mkCell(c, s, B, r, t, big, vmap, mv, prevTxt)) });
  vals.deckTiers = B.deckTiers.slice().reverse().map(mkTier);
  vals.holdTiers = B.holdTiers.slice().reverse().map(mkTier);
  const tot = (deck) => S.ALL_ROWS.map((r) => {
    const exists = deck ? B.rows.includes(r) : B.hRows.includes(r); if (!exists) return { vis: 'hidden', txt: '', pct: 0, col: 'transparent', fg: 'inherit', fw: 400, title: '' };
    const lim = deck ? S.LIMITS.deck : S.LIMITS.hold; let sum = S.stackWeight(s.slots, B.bay, r, deck);
    if (mv && mv.key && +mv.key.slice(2, 4) === r && (+mv.key.slice(4) >= 82) === deck) sum -= mv.box.w;
    let preview = false;
    if (s.drag && s.over && +s.over.slice(2, 4) === r && (+s.over.slice(4) >= 82) === deck) { sum += s.drag.box.w; preview = true; }
    const pct = Math.min(100, (sum / lim) * 100), over = sum > lim + 1e-6;
    return { vis: 'visible', txt: f1(sum), pct: pct.toFixed(1), col: over ? 'var(--err)' : pct > 90 ? 'var(--warn)' : preview ? 'var(--accent)' : 'var(--text3)', fg: over ? 'var(--err)' : preview ? 'var(--accent)' : 'var(--text2)', fw: over || preview ? 600 : 400, title: `Stack ${S.pad(B.bay)}-${S.pad(r)} ${deck ? 'deck' : 'hold'}: ${f1(sum)} t of ${f1(lim)} t` };
  });
  vals.deckTot = tot(true); vals.holdTot = tot(false);
  vals.big = big; vals.gGap = big ? 3 : 1; vals.totH = big ? 24 : 16;
  vals.activeDesc = 'c' + c._uid + s.focus;
  vals.gridLabel = `Bay ${S.pad(s.bay)} cross section, looking forward. Port on the left, starboard on the right.`;
  vals.announce = s.announce; vals.heldOn = !!s.held;
  vals.legendCells = [
    { label: 'Empty', bg: 'transparent', bd: '1px solid var(--border)', img: 'none', sh: 'none', ol: 'none' },
    { label: 'Occupied', bg: '#009E73', bd: '1px solid rgba(11,18,32,.35)', img: 'none', sh: 'none', ol: 'none' },
    { label: 'Selected', bg: '#009E73', bd: '1px solid rgba(11,18,32,.35)', img: 'none', sh: '0 0 0 2px var(--text)', ol: 'none' },
    { label: 'Focus', bg: 'transparent', bd: '1px solid var(--border)', img: 'none', sh: 'none', ol: '2px solid var(--accent)' },
    { label: 'Valid', bg: 'var(--okbg)', bd: '1px solid var(--ok)', img: 'none', sh: 'none', ol: 'none' },
    { label: 'Invalid', bg: 'transparent', bd: '1px solid var(--err)', img: 'repeating-linear-gradient(135deg, rgba(255,93,93,0.42) 0 2px, transparent 2px 5px)', sh: 'none', ol: 'none' },
    { label: 'Locked', bg: '#56B4E9', bd: '1px solid rgba(11,18,32,.35)', img: 'repeating-linear-gradient(135deg, rgba(11,18,32,0.30) 0 2px, transparent 2px 5px)', sh: 'none', ol: 'none' },
    { label: 'Violation', bg: '#E69F00', bd: '1px solid rgba(11,18,32,.35)', img: 'none', sh: 'inset 0 0 0 2px #B3141B', ol: 'none' },
  ];

  // ---------- Inspector
  vals.tabIns = s.rightTab === 'inspector'; vals.tabVio = s.rightTab === 'violations';
  vals.tabInsSel = vals.tabIns ? 'true' : 'false'; vals.tabVioSel = vals.tabVio ? 'true' : 'false';
  vals.tabInsBd = vals.tabIns ? 'var(--accent)' : 'transparent'; vals.tabVioBd = vals.tabVio ? 'var(--accent)' : 'transparent';
  vals.tabInsFg = vals.tabIns ? 'var(--text)' : 'var(--text2)'; vals.tabVioFg = vals.tabVio ? 'var(--text)' : 'var(--text2)';
  let mode = null, box = null, sk = null, ch = null;
  if (s.drag) { mode = 'Placing'; box = s.drag.box; sk = s.over; ch = sk ? S.checkPlace(s.slots, sk, box, s.drag.from) : null; }
  else if (s.held) { mode = 'Picked up'; box = s.held.box; sk = s.focus; ch = S.checkPlace(s.slots, sk, box, s.held.key); }
  else if (s.sel && s.slots[s.sel]) { mode = 'Container'; box = s.slots[s.sel]; sk = s.sel; }
  vals.insHas = !!box; vals.insEmpty = !box;
  if (box) {
    const T = S.TYPES[box.type], P = S.PODS[box.pod], p = sk ? S.parseKey(sk) : null, deck = p && p.tier >= 82;
    const vs = mode === 'Container' ? viol.filter((v) => v.slots.includes(sk)) : [];
    const lim = deck ? S.LIMITS.deck : S.LIMITS.hold;
    let sum = p ? (ch ? ch.sum || 0 : S.stackWeight(s.slots, p.bay, p.row, deck)) : 0;
    const checks = RULES.map(([r, name]) => {
      let st = 'ok', txt = 'OK';
      if (mode === 'Container') {
        const v = vs.find((x) => x.rule === r);
        if (v) { st = v.sev === 'error' ? 'err' : 'warn'; txt = r === 'stack' ? `${f1(sum)} / ${f1(lim)} t` : r === 'overstow' ? `${v.restows} restow${v.restows > 1 ? 's' : ''}` : r === 'heavy' ? `+${f1(box.w - s.slots[v.slots[1]].w)} t` : r === 'reefer' ? 'No plug' : r === 'dg' ? 'Too close' : 'On 40ft'; }
        else if (r === 'reefer' && !box.rf) { st = 'na'; txt = 'n/a'; } else if (r === 'dg' && !box.dg) { st = 'na'; txt = 'n/a'; } else if (r === 'stack') txt = `${f1(sum)} / ${f1(lim)} t`; else if (r === 'reefer') txt = 'Plug OK';
      } else if (ch && ch.target) {
        const e = ch.errs.find((x) => x.rule === r), w = ch.warns.find((x) => x.rule === r);
        if (e) { st = 'err'; txt = r === 'stack' ? `${f1(ch.sum)} / ${f1(ch.lim)} t` : 'Fails'; } else if (w) { st = 'warn'; txt = 'Warning'; } else if ((r === 'reefer' && !box.rf) || (r === 'dg' && !box.dg)) { st = 'na'; txt = 'n/a'; } else if (r === 'stack') txt = `${f1(ch.sum)} / ${f1(ch.lim)} t`;
      } else { st = 'na'; txt = '—'; }
      return { name, txt, err: st === 'err', warn: st === 'warn', ok: st === 'ok', na: st === 'na', fg: st === 'err' ? 'var(--err)' : st === 'warn' ? 'var(--warn)' : st === 'ok' ? 'var(--ok)' : 'var(--text3)' };
    });
    const ne = checks.filter((x) => x.err).length, nw = checks.filter((x) => x.warn).length;
    const mx = Math.max(lim * 1.15, sum);
    vals.ins = {
      mode, id: box.id, color: PODC(box.pod), podShort: P.short, podName: P.name, iso: T.iso, wt: f1(box.w), locked: !!box.locked,
      status: ne ? `${ne} error${ne > 1 ? 's' : ''}` : nw ? `${nw} warning` : mode === 'Container' ? 'All checks pass' : ch && ch.target ? 'Valid target' : 'No target',
      stFg: ne ? 'var(--err)' : nw ? 'var(--warn)' : 'var(--ok)',
      fields: [['Type', `${box.type} · ${T.h}`], ['ISO code', T.iso], ['VGM', f1(box.w) + ' t'], ['POL', box.pol || 'SGSIN'], ['POD', `${P.code} · ${P.name}`], ['Reefer', box.rf ? box.temp || 'Set −18.0 °C' : 'No'], ['Dangerous goods', box.dg ? 'IMDG ' + box.dg : 'None'], ['Status', mode === 'Container' ? (box.pol === 'IDJKT' ? 'Onboard from IDJKT' : 'Planned this call') : 'Unplanned']].map(([k, v]) => ({ k, v })),
      hasSlot: !!p, slotParts: p ? [{ v: S.pad(p.bay), k: 'Bay · 40ft' }, { v: S.pad(p.row), k: 'Row · ' + (p.row % 2 ? 'Stbd' : 'Port') }, { v: S.pad(p.tier), k: 'Tier · ' + (deck ? 'Deck' : 'Hold') }] : [],
      slotTitle: sk ? (mode === 'Container' ? 'Slot ' + S.slotCode(box) : 'Target ' + sk) : 'No target',
      slotNote: p ? (S.hasPlug(p.bay, p.row, p.tier) ? 'Reefer plug' : 'No plug') : '',
      stackLbl: p ? `Stack ${S.pad(p.bay)}-${S.pad(p.row)} ${deck ? 'deck' : 'hold'}` : '', stackTxt: p ? `${f1(sum)} / ${f1(lim)} t` : '',
      stackPct: ((sum / mx) * 100).toFixed(1), limPct: ((lim / mx) * 100).toFixed(1), stackCol: sum > lim ? 'var(--err)' : sum > lim * 0.9 ? 'var(--warn)' : 'var(--accent)', stackFg: sum > lim ? 'var(--err)' : 'var(--text)',
      checks,
      actions: mode === 'Container' ? [
        { label: 'Unplace', key: 'U', disabled: !!box.locked || !A.isTop(sk), onClick: () => A.apply({ kind: 'unplace', from: sk }) },
        { label: box.locked ? 'Unlock' : 'Lock', key: 'L', disabled: false, onClick: () => A.apply({ kind: 'lock', key: sk }) },
        { label: s.swapFrom ? 'Pick target' : 'Swap', key: 'S', disabled: !!box.locked, onClick: () => c.setState({ swapFrom: sk, announce: `Swap: select the container to swap with ${box.id}.` }) },
      ] : [
        { label: 'Cancel', key: 'Esc', disabled: false, onClick: () => A.cancel() },
        { label: 'Place', key: '↵', disabled: !(ch && ch.target && ch.ok), onClick: () => sk && A.tryPlace(sk, box, s.held ? s.held.key : s.drag.from, s.drag && !s.drag.from ? box.id : null) },
      ],
      actCols: mode === 'Container' ? 'repeat(3, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))',
    };
    vals.ins.actions.forEach((a) => (a.op = a.disabled ? 0.45 : 1));
  } else vals.ins = { fields: [], slotParts: [], checks: [], actions: [] };

  // ---------- Violations
  const vf = s.vFilter;
  vals.vFilters = [['all', 'All', viol.length], ['error', 'Errors', errs.length], ['warning', 'Warnings', warns.length]].map(([k, l, n]) => ({ label: l, n, sel: vf === k ? 'true' : 'false', bg: vf === k ? 'var(--raised)' : 'transparent', fg: vf === k ? 'var(--text)' : 'var(--text2)', bd: vf === k ? 'var(--border2)' : 'transparent', onClick: () => c.setState({ vFilter: k }) }));
  const item = (v) => {
    const sel = v.id === s.selViol, fx = fixes[v.id], isNew = s.newV && s.newV.includes(v.id);
    return { id: v.id, sevTxt: v.sev === 'error' ? 'Error' : 'Warning', title: v.title, msg: v.msg, slot: v.slot, err: v.sev === 'error', warn: v.sev !== 'error', fg: v.sev === 'error' ? 'var(--err)' : 'var(--warn)', selected: sel, bg: sel ? 'var(--sel)' : 'transparent', sh: sel ? 'inset 0 0 0 1px var(--accent)' : 'none', anim: isNew ? 'stw-in 160ms ease-out' : 'none',
      aria: `${v.sev}: ${v.msg}`, fix: fx ? fx.text : 'Review manually', canFix: !!fx,
      inv: v.slots.map((k) => { const b = s.slots[k]; return b ? { slot: k, id: b.id, wt: f1(b.w), pod: S.PODS[b.pod].short, podColor: PODC(b.pod) } : null; }).filter(Boolean),
      onSelect: () => A.showViol(v), onShow: (e) => { e.stopPropagation(); A.showViol(v); },
      onFix: (e) => { e.stopPropagation(); if (!fx) return; if (fx.kind === 'move') A.apply({ kind: 'move', from: fx.from, to: fx.to }); else A.apply({ kind: 'swap', a: fx.a, b: fx.b }); c.setState({ selViol: null }); },
    };
  };
  vals.vGroups = [['error', 'Errors', errs], ['warning', 'Warnings', warns]].filter(([k, , arr]) => (vf === 'all' || vf === k) && arr.length).map(([k, l, arr]) => ({ label: l, count: arr.length, fg: k === 'error' ? 'var(--err)' : 'var(--warn)', err: k === 'error', warn: k !== 'error', items: arr.map(item) }));
  vals.vEmpty = viol.length === 0;
  const lr = s.lastRun || new Date(2026, 9, 7, 14, 32, 8);
  vals.violSummary = `${errs.length} errors block approval · checked ${lr.toTimeString().slice(0, 8)} · re-checks on every move`;

  // ---------- Bay navigator
  const cnt = {}; for (const k in s.slots) { const x = s.slots[k]; const o = (cnt[x.bay] = cnt[x.bay] || { d: 0, h: 0 }); x.deck ? o.d++ : o.h++; }
  vals.navBays = S.BAYS.map((b) => {
    const o = cnt[b.bay] || { d: 0, h: 0 }, dc = b.rows.length * 6, hc = b.hRows.length * b.holdTiers.length, nv = viol.filter((v) => v.bay === b.bay).length, cur = b.bay === s.bay;
    return { label: S.pad(b.bay), dh: ((o.d / dc) * 100).toFixed(0), hh: ((o.h / hc) * 100).toFixed(0), vtxt: nv ? '▲' + nv : '', vfg: 'var(--err)', cur: cur ? 'true' : 'false', bd: cur ? 'var(--accent)' : 'transparent', bg: cur ? 'var(--accentbg)' : 'transparent', fill: cur ? 'var(--accent)' : nv ? 'var(--text2)' : 'var(--text3)', lfg: cur ? 'var(--text)' : 'var(--text3)', fw: cur ? 600 : 400, house: b.i === 13,
      aria: `Bay ${S.pad(b.bay)}: deck ${((o.d / dc) * 100).toFixed(0)}% full, hold ${((o.h / hc) * 100).toFixed(0)}% full${nv ? `, ${nv} violation${nv > 1 ? 's' : ''}` : ''}`, onClick: () => A.setBay(b.bay) };
  });

  // ---------- Stability strip
  const sh = s.stabShown, ST = S.STAB;
  const gState = (k, v) => k === 'gm' ? (v < ST.gmMin ? 'err' : v < ST.gmMin + 0.2 ? 'warn' : 'ok') : k === 'trim' ? (Math.abs(v) > ST.trimLim ? 'err' : Math.abs(v) > 1.0 ? 'warn' : 'ok') : k === 'list' ? (Math.abs(v) >= ST.listLim ? 'err' : Math.abs(v) > ST.listWarn ? 'warn' : 'ok') : v > 100 ? 'err' : v > 85 ? 'warn' : 'ok';
  const mkG = (k, label, val, unit, mark, zones, delta, raw) => { const st = gState(k, raw); return { label, val, unit, mark: Math.max(0, Math.min(100, mark)).toFixed(1), zones, delta: delta || '', hasDelta: !!delta, st, stTxt: st === 'ok' ? 'OK' : st === 'warn' ? 'Check' : 'Limit', fg: st === 'ok' ? 'var(--ok)' : st === 'warn' ? 'var(--warn)' : 'var(--err)', ok: st === 'ok', warn: st === 'warn', err: st === 'err' }; };
  vals.gauges = [
    mkG('gm', 'GM', f2(sh.gm), 'm · min 1.20', (sh.gm / 3) * 100, [{ l: 0, w: 40, c: 'var(--err)' }], pd ? `${sgn(pd.gm, 3)}` : '', sh.gm),
    mkG('trim', 'Trim', f2(Math.abs(sh.trim)), 'm ' + (sh.trim >= 0 ? 'by stern' : 'by head'), ((sh.trim + 1.5) / 3) * 100, [{ l: 0, w: 0.8, c: 'var(--err)' }, { l: 99.2, w: 0.8, c: 'var(--err)' }], pd ? `${sgn(pd.trim)} m` : '', sh.trim),
    mkG('list', 'List', Math.abs(sh.list).toFixed(1), '° to ' + (sh.list >= 0 ? 'port' : 'stbd'), 50 - (sh.list / 2) * 50, [{ l: 42.5, w: 15, c: 'var(--ok)' }], pd ? `${sgn(pd.list)}°` : '', sh.list),
    mkG('bm', 'BM / SF', `${ST.bm} / ${ST.sf}`, '% of limit', ST.bm, [{ l: 85, w: 15, c: 'var(--warn)' }], '', ST.bm),
  ];
  vals.drawer = s.drawer; vals.drawerExp = s.drawer ? 'true' : 'false'; vals.drawerBtnBg = s.drawer ? 'var(--accentbg)' : 'transparent'; vals.drawerBtnFg = s.drawer ? 'var(--accent)' : 'var(--text2)';
  vals.drawerUp = !s.drawer; vals.drawerDown = s.drawer;

  // ---------- Drawer charts
  if (s.drawer) {
    const cv = S.strengthCurves(), n = cv.bm.length - 1;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${((i / n) * 600).toFixed(1)},${(110 - v).toFixed(1)}`).join(' ');
    vals.bmPath = path(cv.bm); vals.sfPath = path(cv.sf);
    const bi = S.bayByNum(s.bay).i; vals.bayBandX = ((bi + 0.5) / 22 * 600 - 12).toFixed(1);
    const pk = cv.bm.indexOf(Math.max(...cv.bm)), ps = cv.sf.indexOf(Math.max(...cv.sf)), pn = cv.sf.indexOf(Math.min(...cv.sf));
    vals.peaks = [{ l: (pk / n) * 100, t: (110 - cv.bm[pk]) / 2.2, txt: `BM ${ST.bm}%`, fg: 'var(--accent)' }, { l: (ps / n) * 100, t: (110 - cv.sf[ps]) / 2.2, txt: `SF +${ST.sf}%`, fg: 'var(--text)' }, { l: (pn / n) * 100, t: (110 - cv.sf[pn]) / 2.2 + 8, txt: `SF −${Math.round(-cv.sf[pn])}%`, fg: 'var(--text)' }].map((x) => ({ l: x.l.toFixed(1), t: x.t.toFixed(1), txt: x.txt, fg: x.fg }));
    vals.chartBays = S.BAYS.filter((b, i) => i % 3 === 0).map((b) => ({ label: S.pad(b.bay), l: (((b.i + 0.5) / 22) * 100).toFixed(1) }));
    const mean = (ST.mean), dF = mean - sh.trim / 2, dA = mean + sh.trim / 2, px = 3.92, ex = 8;
    const yM = 140 - mean * px, yF = yM + ((sh.trim * ex) / 2) * px, yA = yM - ((sh.trim * ex) / 2) * px;
    vals.wl = { x1: 0, y1: yF.toFixed(1), x2: 340, y2: yA.toFixed(1), poly: `0,${yF.toFixed(1)} 340,${yA.toFixed(1)} 340,170 0,170`, summerY: (140 - ST.summer * px).toFixed(1) };
    vals.drafts = [{ k: 'Fwd', v: f2(dF), x: 30 }, { k: 'Mid', v: f2(mean), x: 170 }, { k: 'Aft', v: f2(dA), x: 310 }];
    vals.draftFwd = f2(dF); vals.draftAft = f2(dA); vals.draftMid = f2(mean);
    vals.trimTxt = `${f2(Math.abs(sh.trim))} m by ${sh.trim >= 0 ? 'stern' : 'head'}`;
    const arc = (cx, cy, r, a0, a1) => { const p0 = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy - r * Math.sin(a1)]; return `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`; };
    const PI = Math.PI, gmA = (v) => PI - (Math.min(3, v) / 3) * PI;
    const nd = (a, r) => ({ x: (100 + r * Math.cos(a)).toFixed(1), y: (96 - r * Math.sin(a)).toFixed(1) });
    vals.gmArcRed = arc(100, 96, 76, PI, gmA(1.2)); vals.gmArcOk = arc(100, 96, 76, gmA(1.2), 0); vals.gmNeedle = nd(gmA(sh.gm), 66); vals.gmMinTick = { a: nd(gmA(1.2), 86), b: nd(gmA(1.2), 66) };
    const lA = (v) => PI / 2 + (Math.max(-5, Math.min(5, v)) / 5) * (PI / 2);
    vals.lsWarnL = arc(100, 96, 76, PI, lA(ST.listWarn)); vals.lsOk = arc(100, 96, 76, lA(ST.listWarn), lA(-ST.listWarn)); vals.lsWarnR = arc(100, 96, 76, lA(-ST.listWarn), 0);
    vals.lsErrL = arc(100, 96, 76, PI, lA(ST.listLim)); vals.lsErrR = arc(100, 96, 76, lA(-ST.listLim), 0);
    vals.lsNeedle = nd(lA(sh.list), 66);
    vals.gmBig = f2(sh.gm); vals.listBig = Math.abs(sh.list).toFixed(1); vals.listSide = sh.list >= 0 ? 'to port' : 'to starboard';
    vals.trimMark = (((sh.trim + 1.5) / 3) * 100).toFixed(1); vals.trimBig = f2(Math.abs(sh.trim));
    vals.hydro = [['Displacement', '98,420 t'], ['Deadweight', '71,260 t'], ['KM', '17.46 m'], ['KG (fluid)', '15.62 m'], ['GM', f2(sh.gm) + ' m'], ['Summer draft', '14.50 m']].map(([k, v]) => ({ k, v }));
  }

  // ---------- Playback
  vals.playing = !!s.play;
  if (s.play) {
    const restow = {}; viol.filter((v) => v.rule === 'overstow').forEach((v) => (restow[v.port] = (restow[v.port] || 0) + v.restows));
    const stops = [{ code: 'SGSIN', name: 'Singapore', sub: 'Departure', n: '' }].concat(S.POD_LIST.map((p) => ({ code: p, name: S.PODS[p].name, sub: S.ROTATION.find((r) => r.code === p).when, n: '−' + podCount[p].toLocaleString('en-US'), rs: restow[p] || 0 })));
    vals.stops = stops.map((x, i) => ({ code: x.code, name: x.name, sub: x.sub, n: x.n, hasN: !!x.n, rs: x.rs ? `${x.rs} restow${x.rs > 1 ? 's' : ''}` : '', hasRs: !!x.rs, l: ((i / 4) * 100).toFixed(1), cur: i === s.play.port, past: i < s.play.port, dot: i === s.play.port ? 'var(--accent)' : i < s.play.port ? 'var(--text2)' : 'var(--surface)', dotBd: i <= s.play.port ? (i === s.play.port ? 'var(--accent)' : 'var(--text2)') : 'var(--border2)', fg: i === s.play.port ? 'var(--text)' : i < s.play.port ? 'var(--text2)' : 'var(--text3)', color: S.PODS[x.code] ? PODC(x.code) : 'var(--text3)', onClick: () => i > 0 && c.setState({ play: Object.assign({}, s.play, { port: i }) }) }));
    vals.playPct = ((s.play.port / 4) * 100).toFixed(1);
    const cp = S.POD_LIST[s.play.port - 1];
    vals.playNow = `${S.PODS[cp].name} · discharging ${podCount[cp].toLocaleString('en-US')} boxes${restow[cp] ? ` · ${restow[cp]} restow moves` : ' · no restows'}`;
    vals.playIsOn = s.play.playing; vals.playIsOff = !s.play.playing; vals.playLabel = s.play.playing ? 'Pause' : 'Play';
  } else vals.stops = [];

  // ---------- Toast
  vals.toastOn = !!s.toast;
  if (s.toast) { const k = s.toast.kind; vals.toastTitle = s.toast.title; vals.toastMsg = s.toast.msg; vals.toastUndo = !!s.toast.undo; vals.toastErr = k === 'err'; vals.toastWarn = k === 'warn'; vals.toastOk = k === 'ok' || k === 'info'; vals.toastFg = k === 'err' ? 'var(--err)' : k === 'warn' ? 'var(--warn)' : 'var(--ok)'; vals.toastBd = k === 'err' ? 'var(--err)' : k === 'warn' ? 'var(--warn)' : 'var(--border2)'; }
  vals.srText = s.srText;
  vals.cols = `${s.leftOpen ? '320px' : '40px'} minmax(0,1fr) ${s.rightOpen ? '320px' : '40px'}`;
  vals.leftOpen = s.leftOpen; vals.leftClosed = !s.leftOpen; vals.rightOpen = s.rightOpen; vals.rightClosed = !s.rightOpen;
  vals.cvCursor = s.hover ? 'pointer' : 'grab';
  vals.swapping = !!s.swapFrom;
  const wsMode = c.props.mode || 'edit', ro = wsMode !== 'edit';
  Object.assign(vals, { ro, notRo: !ro, roApproved: wsMode === 'approved', roRole: wsMode === 'role', saveDisabled: ro, saveOp: ro ? 0.45 : 1, importDisabled: ro, importOp: ro ? 0.45 : 1,
    roMsg: wsMode === 'approved' ? 'This plan is approved and read only. Revise it to make changes.' : 'Your role cannot change plans.',
    roWho: wsMode === 'approved' ? 'Approved by Lena Vos · 07 Oct 16:05' : 'Terminal planner · Read only' });
  if (ro) {
    Object.assign(vals, { undoDisabled: true, redoDisabled: true, undoOp: 0.4, redoOp: 0.4 });
    vals.rows.forEach((r) => (r.draggable = false));
    vals.deckTiers.concat(vals.holdTiers).forEach((t) => t.cells.forEach((cl) => (cl.draggable = false)));
    vals.vGroups.forEach((g) => g.items.forEach((i) => { i.fixLocked = i.canFix; i.canFix = false; i.lockMsg = vals.roMsg; }));
    const R = vals.rotation, k = R.findIndex((p) => p.current);
    vals.rotation = [Object.assign({}, R[k], { notFirst: false }), R[k + 1], { code: '+3', title: 'Jebel Ali · Rotterdam · Hamburg', notFirst: true, done: false, current: false, swatch: false, color: 'transparent', ariaCurrent: 'false', bd: 'var(--border)', bg: 'transparent', fg: 'var(--text2)', fw: 500 }];
  }
  return vals;
}
