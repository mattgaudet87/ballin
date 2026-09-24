/**
 * ball-textures.js
 * ---------------------------------------------------------------------------
 * Real surface textures for the novelty balls in js/wallet.js BALL_STYLES
 * (Pickleball, Bowling Ball, Meatball, Disco Ball, Chrome, Moon, 8-Ball,
 * Beach Ball, Watermelon, Eyeball, Golf Ball).
 *
 * Each texture is a tiny function of a point on the unit ball, in ball space:
 *   texture(x, y, z, o, frame, nx, ny, nz)
 * (x, y, z) is where that pixel lands on the sphere once the ball's spin is
 * undone. `o` is the output: { c: [r,g,b], gloss, bump, flat } — set o.c (and
 * optionally o.gloss/o.bump/o.flat) and the lighting step below does the rest.
 * Chrome also reads the screen-space normal (nx, ny, nz) to fake a reflection.
 *
 * Ball.draw() in ball.js calls textureFrame(id, size, frameIndex) to get a
 * <canvas> it can drawImage() straight onto the ball — see the frame cache below.
 */
import { BALL_STYLES } from './wallet.js';

const TAU = Math.PI * 2;
// Must match VIEW_YAW in ball.js so textures and seams line up.
const VIEW_YAW = 0.4;

// ---------------------------------------------------------------------------
// Noise: a small value-noise + fractal Brownian motion, and a helper that
// finds the nearest cell on a latitude/longitude grid around the spin (x)
// axis — used for dimples, holes, mirror tiles and craters.
// ---------------------------------------------------------------------------
function hash(i, j, k) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z, oct = 3) {
  let a = 0.5, s = 0, f = 1;
  for (let o = 0; o < oct; o++) { s += a * vnoise(x * f + 17.1 * o, y * f, z * f); f *= 2; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}
function grid(x, y, z, step) {
  const lat = Math.asin(Math.max(-1, Math.min(1, x))), lon = Math.atan2(z, y);
  const i0 = Math.round(lat / step);
  let best = 9, id = 0, dLat = 0, dLon = 0;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    const lc = i * step;
    if (Math.abs(lc) > Math.PI / 2) continue;
    const n = Math.max(1, Math.round((TAU * Math.cos(lc)) / step)), ls = TAU / n, j0 = Math.round(lon / ls);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const oc = j * ls, cl = Math.cos(lc);
      const cx = Math.sin(lc), cyy = cl * Math.cos(oc), cz = cl * Math.sin(oc);
      const d = (x - cx) ** 2 + (y - cyy) ** 2 + (z - cz) ** 2;
      if (d < best) { best = d; id = (i + 50) * 1000 + ((j % n) + n) % n; dLat = lat - lc; dLon = (lon - oc) * Math.cos(lat); }
    }
  }
  return { d: Math.sqrt(best), id, dLat, dLon };
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const C = (h) => hex(h);

// ---- palette
const P = {
  pickle: C('#dfe83a'), pickleHole: C('#5c6810'), pickleRim: C('#c3cc2a'),
  bowlA: C('#1a1560'), bowlB: C('#4a2ad8'), bowlC: C('#b04ae0'), bowlHole: C('#07060f'), bowlRim: C('#8a86a8'),
  meatA: C('#5a2e16'), meatB: C('#9a5a32'), crisp: C('#351708'), sauce: C('#b8261a'), sauceHi: C('#e0472c'), herb: C('#3f8a2a'),
  tile: C('#d8dde6'), gap: C('#1c1e24'),
  moon: C('#bdbdb6'), mare: C('#77766f'), crater: C('#8f8e87'), rim: C('#e2e2da'),
  black: C('#141416'), white: C('#f5f3ec'),
  beach: ['#e8322a', '#f5f5f0', '#2a6fe0', '#ffd23f', '#f5f5f0', '#2fbf5a'].map(C),
  melon: C('#4a9a3e'), melonDark: C('#1c4d1f'), melonLight: C('#9bd07e'),
  sclera: C('#f4f0e8'), vein: C('#c8322a'), irisA: C('#1f5fa8'), irisB: C('#5fb0f0'), pupil: C('#060608'),
  golf: C('#f2f2ee'), dimple: C('#c9c9c2'),
  sky: C('#ffffff'), skyLow: C('#b4bfd2'), horizon: C('#3a404d'), ground: C('#5a6272'), groundFar: C('#1c2028'),
};
const HOLES = [[0.3, 0.22, -0.93, 0.105], [0.05, 0.3, -0.95, 0.105], [0.16, -0.08, -0.98, 0.13]].map(([x, y, z, r]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l, r]; });

export const TEXTURES = {
  pickleball(x, y, z, o) {
    const g = grid(x, y, z, 0.52);
    o.c = g.d < 0.1 ? mix(P.pickleHole, P.pickle, clamp01((g.d - 0.02) / 0.08) * 0.6) : g.d < 0.125 ? P.pickleRim : P.pickle;
    if (Math.abs(x) < 0.012) o.c = mix(o.c, P.pickleHole, 0.35);
    o.gloss = 0.2;
  },
  bowling(x, y, z, o) {
    const w = fbm(x * 2 + 3, y * 2, z * 2) * 1.6;
    const t = fbm(x * 2.2 + w, y * 2.2 - w, z * 2.2 + w);
    o.c = t < 0.5 ? mix(P.bowlA, P.bowlB, t * 2) : mix(P.bowlB, P.bowlC, (t - 0.5) * 2);
    o.gloss = 1;
    for (const [hx, hy, hz, r] of HOLES) {
      const d = Math.hypot(x - hx, y - hy, z - hz);
      if (d < r) { o.c = d < r * 0.82 ? mix(P.bowlHole, P.bowlA, (d / r) * 0.4) : P.bowlRim; o.gloss = d < r * 0.82 ? 0 : 0.6; }
    }
  },
  meatball(x, y, z, o) {
    const n = fbm(x * 5, y * 5, z * 5);
    o.c = mix(P.meatA, P.meatB, n);
    if (fbm(x * 11 + 5, y * 11, z * 11) > 0.66) o.c = P.crisp;
    o.bump = 0.65 + 0.7 * fbm(x * 8 + 9, y * 8, z * 8);
    o.gloss = 0.15;
    const s = y + (fbm(x * 4 + 2, y * 4, z * 4) - 0.5) * 0.6;
    if (s > 0.62) { o.c = mix(P.sauce, P.sauceHi, clamp01(fbm(x * 6, y * 6 + 4, z * 6) * 1.4 - 0.4)); o.gloss = 0.85; o.bump = 0.95; }
    const h = grid(x, y, z, 0.28);
    if (h.d < 0.032 && hash(h.id, 7, 3) < 0.55) { o.c = P.herb; o.gloss = 0.1; }
  },
  disco(x, y, z, o, frame) {
    const g = grid(x, y, z, 0.17);
    if (Math.max(Math.abs(g.dLat), Math.abs(g.dLon)) > 0.17 * 0.42) { o.c = P.gap; o.gloss = 0; return; }
    const k = 0.45 + 0.55 * hash(g.id, 1, 2);
    o.c = [P.tile[0] * k, P.tile[1] * k, P.tile[2] * (k * 0.95 + 0.05)];
    if (hash(g.id, frame, 9) > 0.965) o.c = [255, 255, 255];
    o.gloss = 1;
  },
  chrome(x, y, z, o, frame, nx, ny, nz) {
    const dot = nz, ry = -2 * dot * ny;
    o.c = ry > 0.03 ? mix(P.skyLow, P.sky, Math.sqrt(clamp01(ry))) : ry > -0.03 ? P.horizon : mix(P.ground, P.groundFar, clamp01(-ry));
    o.gloss = 1; o.bump = 1.25; o.flat = true;
  },
  moon(x, y, z, o) {
    const m = fbm(x * 1.6 + 8, y * 1.6, z * 1.6);
    o.c = mix(P.moon, P.mare, clamp01((m - 0.52) * 4));
    o.c = mix(o.c, P.moon, 0.2 * fbm(x * 9, y * 9, z * 9));
    const g = grid(x, y, z, 0.5);
    if (hash(g.id, 4, 4) < 0.65) {
      const r = 0.5 * (0.16 + 0.26 * hash(g.id, 5, 5));
      if (g.d < r * 0.86) { o.c = mix(o.c, P.crater, 0.8); o.bump = 0.8 + 0.3 * (g.dLat / r); }
      else if (g.d < r) o.c = P.rim;
    }
    o.gloss = 0.05;
  },
  eightball(x, y, z, o) {
    o.c = P.black; o.gloss = 1;
    const a = -z;
    if (a > Math.cos(0.4)) {
      o.c = P.white; o.gloss = 0.7;
      const u = x, v = y;
      const r1 = Math.hypot(u, v - 0.085), r2 = Math.hypot(u, v + 0.092);
      if (Math.abs(r1 - 0.066) < 0.024 || Math.abs(r2 - 0.08) < 0.027) o.c = P.black;
    }
  },
  beach(x, y, z, o) {
    if (Math.abs(x) > 0.93) { o.c = Math.abs(x) > 0.975 ? P.beach[3] : P.beach[1]; o.gloss = 0.6; return; }
    const phi = Math.atan2(z, y) + Math.PI;
    o.c = P.beach[Math.min(5, Math.floor((phi / TAU) * 6))];
    o.gloss = 0.65;
  },
  watermelon(x, y, z, o) {
    const phi = Math.atan2(z, y);
    const s = Math.sin(phi * 7 + 1.3 * Math.sin(x * 6 + phi * 2) + (fbm(x * 3, y * 3, z * 3) - 0.5) * 2.2);
    o.c = s > 0.2 ? mix(P.melonDark, P.melon, clamp01((0.6 - s) * 1.2)) : mix(P.melon, P.melonLight, fbm(x * 7 + 1, y * 7, z * 7) * 0.5);
    o.gloss = 0.45;
  },
  eyeball(x, y, z, o) {
    const a = -z;
    o.c = P.sclera; o.gloss = 0.9;
    if (a < 0.86) {
      const n = fbm(x * 3.5 + 1, y * 3.5, z * 3.5);
      if (a < 0.55 && Math.abs(n - 0.5) < 0.006 + 0.008 * (0.55 - a)) o.c = mix(P.sclera, P.vein, 0.85);
      else o.c = mix(P.sclera, [238, 196, 188], clamp01((0.2 - a) * 0.8));
    }
    if (a > Math.cos(0.46)) {
      const ang = Math.atan2(y, x), rr = Math.acos(Math.min(1, a)) / 0.46;
      const streak = 0.5 + 0.5 * Math.sin(ang * 22 + fbm(x * 9, y * 9, z * 9) * 6);
      o.c = mix(P.irisA, P.irisB, streak * (1 - rr * 0.6));
      if (rr > 0.86) o.c = mix(o.c, [10, 30, 60], 0.7);
      if (rr < 0.42) o.c = P.pupil;
    }
  },
  golf(x, y, z, o) {
    const g = grid(x, y, z, 0.15);
    o.c = P.golf; o.gloss = 0.55;
    if (g.d < 0.058) { o.c = mix(P.dimple, P.golf, (g.d / 0.058) ** 2); o.bump = 0.85 + 0.35 * (g.dLat / 0.058); }
  },
};

// ---------------------------------------------------------------------------
// Lighting: one fixed light, worked out once per pixel size (it doesn't
// depend on spin, so it's shared by every textured ball at that size).
// ---------------------------------------------------------------------------
const L = (() => { const v = [-0.42, 0.55, -0.72], l = Math.hypot(...v); return v.map((c) => c / l); })();
const Hh = (() => { const v = [L[0], L[1], L[2] - 1], l = Math.hypot(...v); return v.map((c) => c / l); })();
const lightCache = new Map();
function lighting(S) {
  if (lightCache.has(S)) return lightCache.get(S);
  const n = S * S, nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n), dif = new Float32Array(n), spec = new Float32Array(n), a = new Float32Array(n);
  const h = S / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * S + i, x = (i + 0.5 - h) / h, y = -(j + 0.5 - h) / h, d2 = x * x + y * y;
    a[k] = clamp01((1 - Math.sqrt(d2)) * h + 0.5);
    if (a[k] <= 0) continue;
    const z = -Math.sqrt(Math.max(0, 1 - d2));
    nx[k] = x; ny[k] = y; nz[k] = z;
    dif[k] = Math.max(0, x * L[0] + y * L[1] + z * L[2]);
    spec[k] = Math.pow(Math.max(0, x * Hh[0] + y * Hh[1] + z * Hh[2]), 56);
  }
  const res = { nx, ny, nz, dif, spec, a };
  lightCache.set(S, res);
  return res;
}

// ---------------------------------------------------------------------------
// Frame cache: each textured ball is pre-rendered into FRAMES cached canvases
// (one per 1/36th of a turn), keyed by "style id | pixel size". A frame costs
// roughly 5-20ms at 150px to build, but only the first time it's asked for.
// The inverse rotation here matches drawSeams() in ball.js exactly (spin
// around x, then VIEW_YAW around y), so textures and seams stay lined up.
// ---------------------------------------------------------------------------
export const FRAMES = 36;
const frameCache = new Map();
export function textureFrame(id, S, frame) {
  const key = id + '|' + S;
  let frames = frameCache.get(key);
  if (!frames) { frames = []; frameCache.set(key, frames); }
  if (frames[frame]) return frames[frame];
  const tex = TEXTURES[BALL_STYLES[id].texture], Lg = lighting(S);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const spin = -(frame / FRAMES) * TAU, cs = Math.cos(spin), ss = Math.sin(spin), cy = Math.cos(VIEW_YAW), sy = Math.sin(VIEW_YAW);
  const o = { c: [0, 0, 0], gloss: 0, bump: 1, flat: false };
  for (let k = 0; k < S * S; k++) {
    const al = Lg.a[k];
    if (al <= 0) continue;
    const x2 = Lg.nx[k], y1 = Lg.ny[k], z2 = Lg.nz[k];
    const x0 = x2 * cy - z2 * sy, z1 = x2 * sy + z2 * cy;
    const y0 = y1 * cs + z1 * ss, z0 = -y1 * ss + z1 * cs;
    o.gloss = 0; o.bump = 1; o.flat = false;
    tex(x0, y0, z0, o, frame, x2, y1, z2);
    const lit = o.flat ? 0.85 * o.bump : 0.34 + 0.78 * Lg.dif[k] * o.bump;
    const sp = 255 * o.gloss * Lg.spec[k];
    const p = k * 4;
    d[p] = Math.min(255, o.c[0] * lit + sp); d[p + 1] = Math.min(255, o.c[1] * lit + sp); d[p + 2] = Math.min(255, o.c[2] * lit + sp);
    d[p + 3] = al * 255;
  }
  g.putImageData(img, 0, 0);
  frames[frame] = c;
  return c;
}
