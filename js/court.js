/**
 * court.js
 * ---------------------------------------------------------------------------
 * Draws the background: a brick back wall, a hardwood floor with painted court
 * lines, and the lighting on top.
 *
 * Each difficulty has its own court (COURT_THEMES) so the three feel different:
 *   Easy   = Rec Center  (light brick, maple floor, blue paint)
 *   Normal = Brick Gym   (red brick, warm floor, red paint)
 *   Hard   = Night Court (dark brick, dark floor, purple paint, spotlight)
 *
 * The background never changes during play, so main.js draws it ONCE into a
 * hidden canvas whenever the screen size or difficulty changes, then copies
 * that image every frame. That's why we can afford thousands of bricks and
 * planks here.
 *
 * Everything is placed in 3D world meters (see camera.js), so the floor lines
 * shrink toward the wall with real perspective.
 */
import { CONFIG, FX } from './config.js';
import { camera, project } from './camera.js';

export const COURT_THEMES = {
  easy: {
    brick: [214, 178, 140], // RGB of an average brick
    mortar: '#e9dcc8',
    wallPad: '#2c5aa0', // padding along the bottom of the wall
    wood: [226, 184, 132], // RGB of an average floor plank
    paint: 'rgba(52, 120, 220, 0.55)', // the painted lane
    lines: 'rgba(255, 255, 255, 0.9)',
    light: 'rgba(255, 245, 225, 0.35)', // spotlight glow on the wall
    shade: 0.25, // how dark the top of the wall gets (0–1)
  },
  normal: {
    brick: [168, 70, 48],
    mortar: '#c9a58f',
    wallPad: '#1d2340',
    wood: [205, 128, 84],
    paint: 'rgba(200, 40, 40, 0.5)',
    lines: 'rgba(255, 255, 255, 0.88)',
    light: 'rgba(255, 220, 180, 0.28)',
    shade: 0.4,
  },
  hard: {
    brick: [70, 64, 78],
    mortar: '#2a2733',
    wallPad: '#16121f',
    wood: [120, 78, 52],
    paint: 'rgba(130, 70, 220, 0.5)',
    lines: 'rgba(255, 255, 255, 0.8)',
    light: 'rgba(170, 150, 255, 0.35)',
    shade: 0.65,
  },
};

// Sizes in meters
const BRICK_W = 0.26;
const BRICK_H = 0.085;
const MORTAR = 0.012;
const PAD_HEIGHT = 0.28; // wall padding strip at the bottom
const PLANK_W = 0.11;
const LANE_HALF_WIDTH = 0.9;
const FREE_THROW_Z = 0.25; // just in front of the resting ball

/** `hoop` supplies where things are (its distance changes with difficulty). */
export function drawCourt(ctx, width, height, hoop, difficultyId = 'normal') {
  const theme = COURT_THEMES[difficultyId] ?? COURT_THEMES.normal;
  const random = seededRandom(7); // same "random" bricks every time we redraw
  const floorLine = project(0, 0, hoop.wallZ).y;

  drawWall(ctx, width, floorLine, hoop, theme, random);
  if (FX) depthOfField(ctx, width, floorLine);
  drawFloor(ctx, width, height, floorLine, hoop, theme, random);
  drawLines(ctx, hoop, theme);
  drawLighting(ctx, width, height, floorLine, hoop, theme);
}

// ---------------------------------------------------------------------------
// Back wall
// ---------------------------------------------------------------------------

function drawWall(ctx, width, floorLine, hoop, theme, random) {
  // The wall faces the camera, so bricks are plain rectangles on screen,
  // all the same size: `s` pixels per meter.
  const s = project(0, 0, hoop.wallZ).scale;
  const left = camera.centerX - (width / 2 + 40);

  // Mortar shows through the gaps between bricks
  ctx.fillStyle = theme.mortar;
  ctx.fillRect(0, 0, width, floorLine);

  const brickW = BRICK_W * s;
  const brickH = BRICK_H * s;
  const gap = Math.max(1, MORTAR * s);
  for (let row = 0; ; row++) {
    const bottom = floorLine - row * brickH;
    if (bottom < 0) break;
    // Every other row is shifted half a brick, like a real wall
    const shift = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = left - shift; x < width + brickW; x += brickW) {
      ctx.fillStyle = brickColor(theme.brick, random);
      ctx.fillRect(x + gap / 2, bottom - brickH + gap / 2, brickW - gap, brickH - gap);
      // A lighter top edge and darker bottom edge make each brick look chunky
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(x + gap / 2, bottom - brickH + gap / 2, brickW - gap, gap);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(x + gap / 2, bottom - gap * 1.5, brickW - gap, gap);
    }
  }

  // Padding strip along the bottom of the wall
  const padTop = project(0, PAD_HEIGHT, hoop.wallZ).y;
  const pad = ctx.createLinearGradient(0, padTop, 0, floorLine);
  pad.addColorStop(0, lighten(theme.wallPad, 0.15));
  pad.addColorStop(1, theme.wallPad);
  ctx.fillStyle = pad;
  ctx.fillRect(0, padTop, width, floorLine - padTop);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, padTop, width, Math.max(1, s * 0.01));

  // Darker toward the top of the wall
  const shade = ctx.createLinearGradient(0, 0, 0, floorLine);
  shade.addColorStop(0, `rgba(0, 0, 0, ${theme.shade})`);
  shade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, floorLine);
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

function drawFloor(ctx, width, height, floorLine, hoop, theme, random) {
  const far = hoop.wallZ;
  const near = camera.z + 0.2; // just in front of the camera

  // Base color first so no gaps show between planks
  ctx.fillStyle = rgb(theme.wood, 0.85);
  ctx.fillRect(0, floorLine, width, height - floorLine);

  // Planks run toward the wall, so they all point at the same vanishing point
  for (let x = -6; x < 6; x += PLANK_W) {
    const a = project(x, 0, far);
    const b = project(x + PLANK_W, 0, far);
    const c = project(x + PLANK_W, 0, near);
    const d = project(x, 0, near);
    ctx.fillStyle = rgb(theme.wood, 0.88 + random() * 0.2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();

    // Thin dark seam between planks
    ctx.strokeStyle = 'rgba(40, 20, 10, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();

    // Where one board ends and the next begins
    for (let z = far - random() * 1.2; z > near + 0.3; z -= 0.9 + random() * 1.4) {
      const p = project(x, 0, z);
      const q = project(x + PLANK_W, 0, z);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
  }

  // Painted lane (the "key") from the baseline to the free throw line
  const baseZ = baselineZ(hoop);
  fillFloorShape(ctx, [
    [-LANE_HALF_WIDTH, baseZ],
    [LANE_HALF_WIDTH, baseZ],
    [LANE_HALF_WIDTH, FREE_THROW_Z],
    [-LANE_HALF_WIDTH, FREE_THROW_Z],
  ], theme.paint);

  // Dark shadow where the floor meets the wall
  const shadow = ctx.createLinearGradient(0, floorLine, 0, floorLine + (height - floorLine) * 0.12);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, floorLine, width, height - floorLine);
}

function baselineZ(hoop) {
  return hoop.boardZ + 0.1;
}

// ---------------------------------------------------------------------------
// Court lines
// ---------------------------------------------------------------------------

function drawLines(ctx, hoop, theme) {
  const baseZ = baselineZ(hoop);
  const hoopZ = hoop.baseZ;
  ctx.strokeStyle = theme.lines;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Baseline, lane sides and free throw line
  floorPath(ctx, [[-6, baseZ], [6, baseZ]]);
  floorPath(ctx, [[-LANE_HALF_WIDTH, baseZ], [-LANE_HALF_WIDTH, FREE_THROW_Z], [LANE_HALF_WIDTH, FREE_THROW_Z], [LANE_HALF_WIDTH, baseZ]]);

  // Free throw circle: solid on the far side, dashed on the near side
  floorPath(ctx, arcPoints(0, FREE_THROW_Z, LANE_HALF_WIDTH, 0, Math.PI));
  ctx.setLineDash([10, 12]);
  floorPath(ctx, arcPoints(0, FREE_THROW_Z, LANE_HALF_WIDTH, Math.PI, Math.PI * 2));
  ctx.setLineDash([]);

  // Small half circle under the hoop
  floorPath(ctx, arcPoints(0, hoopZ, 0.45, Math.PI, Math.PI * 2));

  // Three point line: straight in the corners, then an arc around the hoop
  const radius = hoopZ + 0.65;
  const corner = 1.9;
  const cornerEnd = hoopZ - Math.sqrt(Math.max(0, radius ** 2 - corner ** 2));
  // Angle of the right corner (pointing toward the camera), then sweep round to the left one
  const start = Math.atan2(cornerEnd - hoopZ, corner);
  floorPath(ctx, [[corner, baseZ], ...arcPoints(0, hoopZ, radius, start, -Math.PI - start), [-corner, baseZ]]);
}

/**
 * Points [x, z] around a circle on the floor centered at (cx, cz), from angle
 * `from` to angle `to`. Angle 0 points right, PI/2 away from you (toward the
 * wall) and -PI/2 toward you.
 */
function arcPoints(cx, cz, radius, from, to) {
  const points = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = from + (i / steps) * (to - from);
    points.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
  }
  return points;
}

/**
 * Draw a line through floor points [x, z]. The line gets thicker as it
 * comes closer, and points behind the camera are skipped.
 */
function floorPath(ctx, points) {
  let previous = null;
  for (const [x, z] of points) {
    const p = z - camera.z > 0.15 ? project(x, 0, z) : null;
    if (p && previous) {
      ctx.lineWidth = Math.max(1, 0.035 * Math.min(p.scale, previous.scale));
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    previous = p;
  }
}

function fillFloorShape(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, z], i) => {
    const p = project(x, 0, Math.max(z, camera.z + 0.2));
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

function drawLighting(ctx, width, height, floorLine, hoop, theme) {
  const rim = project(0, CONFIG.hoop.rimY, hoop.baseZ);

  // Spotlight on the wall behind the hoop
  const glow = ctx.createRadialGradient(rim.x, rim.y, 0, rim.x, rim.y, height * 0.5);
  glow.addColorStop(0, theme.light);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, floorLine);

  // Glossy floor: the lights reflect near the wall and fade toward you
  const shine = ctx.createRadialGradient(rim.x, floorLine, 0, rim.x, floorLine, width * 0.8);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, floorLine, width, height - floorLine);

  if (FX) drawLightCones(ctx, width, height, floorLine, theme);

  // Vignette (darker edges pull the eye to the center)
  const vignette = ctx.createRadialGradient(width / 2, height * 0.5, height * 0.3, width / 2, height * 0.5, height * 0.85);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  if (FX) colorGrade(ctx, width, height);
}

// ---------------------------------------------------------------------------
// FX: depth of field + arena light cones
// ---------------------------------------------------------------------------

/** Soften and dim the back wall so the hoop and ball read sharper in front of it. */
function depthOfField(ctx, width, floorLine) {
  const dpr = ctx.getTransform().a;
  const c = ctx.canvas;
  const srcH = Math.ceil(floorLine * dpr);
  ctx.save();
  ctx.filter = 'blur(2.2px) brightness(0.72) saturate(1.1)';
  ctx.drawImage(c, 0, 0, c.width, srcH, 0, 0, width, srcH / dpr);
  ctx.restore();
}

/** Four hard beams from ceiling lamps, haze at the floor line, and bright pools on the hardwood. */
function drawLightCones(ctx, width, height, floorLine, theme) {
  const bottom = floorLine + (height - floorLine) * 0.5;
  const poolY = floorLine + (height - floorLine) * 0.26;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams = [[0.12, 0.10], [0.38, 0.03], [0.62, -0.03], [0.88, -0.10]];
  for (const [f, lean] of beams) {
    const x = width * f;
    const foot = x + lean * width;
    // Beam: bright core inside a wider soft glow
    for (const [spread, alpha] of [[0.2, 0.55], [0.1, 0.8]]) {
      const beam = ctx.createLinearGradient(0, 0, 0, bottom);
      beam.addColorStop(0, theme.light);
      beam.addColorStop(0.6, theme.light.replace(/[\d.]+\)$/, '0.12)'));
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.02, 0);
      ctx.lineTo(x + width * 0.02, 0);
      ctx.lineTo(foot + width * spread, bottom);
      ctx.lineTo(foot - width * spread, bottom);
      ctx.closePath();
      ctx.fill();
    }
    // Lamp flare at the top
    const lamp = ctx.createRadialGradient(x, 0, 0, x, 0, width * 0.12);
    lamp.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    lamp.addColorStop(0.25, theme.light);
    lamp.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = lamp;
    ctx.fillRect(x - width * 0.12, 0, width * 0.24, width * 0.12);
    // Pool of light on the floor
    const r = width * 0.24;
    const pool = ctx.createRadialGradient(foot, poolY, 0, foot, poolY, r);
    pool.addColorStop(0, 'rgba(255, 250, 240, 0.34)');
    pool.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = pool;
    ctx.save();
    ctx.translate(foot, poolY);
    ctx.scale(1, 0.26);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  // Haze hanging where the floor meets the wall
  const hazeH = height * 0.14;
  const haze = ctx.createLinearGradient(0, floorLine - hazeH, 0, floorLine + hazeH);
  haze.addColorStop(0, 'rgba(0, 0, 0, 0)');
  haze.addColorStop(0.5, theme.light.replace(/[\d.]+\)$/, '0.22)'));
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, floorLine - hazeH, width, hazeH * 2);
  ctx.restore();
}

/** Cinematic grade: cool shadows up top, warm floor, heavy vignette. */
function colorGrade(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const grade = ctx.createLinearGradient(0, 0, 0, height);
  grade.addColorStop(0, 'rgba(30, 70, 140, 0.55)');
  grade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grade.addColorStop(1, 'rgba(255, 130, 50, 0.4)');
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.18, width / 2, height * 0.45, height * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** A brick color: the theme's color, randomly a bit lighter/darker/redder. */
function brickColor([r, g, b], random) {
  const light = 0.8 + random() * 0.35;
  const warm = (random() - 0.5) * 18;
  return `rgb(${clampByte(r * light + warm)}, ${clampByte(g * light)}, ${clampByte(b * light - warm / 2)})`;
}

function rgb([r, g, b], light) {
  return `rgb(${clampByte(r * light)}, ${clampByte(g * light)}, ${clampByte(b * light)})`;
}

/** Lighten a #rrggbb color by `amount` (0–1). */
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => clampByte(c + (255 - c) * amount));
  return `rgb(${parts.join(', ')})`;
}

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** A tiny random number generator that gives the same numbers every time for a seed. */
function seededRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
