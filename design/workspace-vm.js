// View-model + actions for Stowline Workspace.dc.html
import * as S from './stowline-data.js';
import { Stow3D, PRESETS, toBoxes } from './stow3d.js';
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
  return vals;
}
