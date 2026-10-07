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
export const PRESETS = { iso: { yaw: 204, pitch: 27, zoom: 1, tx: 0, ty: 0, tz: -4 }, port: { yaw: 180, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 }, stbd: { yaw: 0, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 }, top: { yaw: 180, pitch: 89, zoom: 1, tx: 0, ty: 0, tz: -4 }, bow: { yaw: 270, pitch: 16, zoom: 1, tx: 0, ty: 0, tz: -4 } };
const WEIGHT = [[8, '#22406E'], [14, '#38699A'], [20, '#5B97C0'], [26, '#A9CBDD'], [99, '#F2D35B']];
const TYPEC = { '40HC': '#7D8CA8', '40GP': '#56647D', '20GP': '#9AA9BF', RF: '#CFEAF6', TK: '#E3B25A', OT: '#B7997A' };

export class Stow3D {
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

export function toBoxes(slots, viol, slotPos) {
  const vmap = {}; viol.forEach((v) => v.slots.forEach((k) => { if (!vmap[k] || v.sev === 'error') vmap[k] = v.sev; }));
  const out = [];
  for (const k in slots) { const s = slots[k], p = slotPos(k, s.len); out.push({ key: k, i: p.i, x: p.x, y: p.y, z: p.z, hx: s.len === 20 ? 2.95 : 6.05, hy: 1.2, hz: s.type === '40HC' || s.type === 'RF' ? 1.33 : 1.2, pod: s.pod, w: s.w, type: s.type, deck: s.deck, viol: vmap[k] }); }
  return out;
}
