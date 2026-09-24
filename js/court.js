/**
 * court.js
 * ---------------------------------------------------------------------------
 * Draws the background: a brick back wall, a hardwood floor with painted court
 * lines, and the lighting on top.
 *
 * The player picks a stadium on the Customize screen (COURT_THEMES, in the
 * order the picker shows them; `price` in coins, 0 = free). Until they pick
 * one, each difficulty uses its classic court (the three free ones):
 *   Easy   = Rec Center  (light brick, maple floor, blue paint)
 *   Normal = Brick Gym   (red brick, warm floor, red paint)
 *   Hard   = Night Court (dark brick, dark floor, purple paint, spotlight)
 * A theme can also recolor the hoop (`hoop`, see hoop.js), the drifting dust
 * (`mote`, see effects.js drawMotes) and the FX color grade (`grade`).
 *
 * The floor surface is picked separately (FLOORS) and works on any stadium.
 * 'stadium' keeps the stadium's own wood.
 *
 * The background never changes during play, so main.js draws it ONCE into a
 * hidden canvas whenever the screen size, difficulty or court changes, then
 * copies that image every frame. That's why we can afford thousands of bricks
 * and planks here.
 *
 * Everything is placed in 3D world meters (see camera.js), so the floor lines
 * shrink toward the wall with real perspective.
 */
import { CONFIG, FX } from './config.js';
import { camera, project } from './camera.js';

const TAU = Math.PI * 2;

export const COURT_THEMES = {
  heatwave: {
    name: 'Heat Wave',
    price: 300,
    mote: '255, 220, 200', // "r, g, b" of the floating dust (effects.js)
    brick: [222, 118, 92],
    mortar: '#f1c7b2',
    wallPad: '#0c6a70',
    wood: [232, 186, 138],
    paint: 'rgba(0, 168, 170, 0.55)',
    lines: 'rgba(255, 255, 255, 0.92)',
    light: 'rgba(255, 190, 150, 0.36)',
    shade: 0.28,
    // Hoop colors that replace the defaults in hoop.js
    hoop: { rim: '#ff4f6d', rimDark: '#9a1c35', rimHi: 'rgba(255, 190, 200, 0.9)', boardTrim: '#0c9aa0', boardPad: '#0c6a70' },
    grade: ['rgba(255, 70, 130, 0.45)', 'rgba(255, 170, 60, 0.42)'], // FX color grade: [top, bottom]
  },
  goldrush: {
    name: 'Gold Rush',
    price: 700,
    mote: '255, 225, 150',
    brick: [88, 52, 124],
    mortar: '#39234f',
    wallPad: '#d9a200',
    wood: [214, 162, 98],
    paint: 'rgba(250, 186, 20, 0.58)',
    lines: 'rgba(255, 255, 255, 0.9)',
    light: 'rgba(255, 214, 120, 0.36)',
    shade: 0.55,
    hoop: { rim: '#f7b500', rimDark: '#7f5200', rimHi: 'rgba(255, 238, 170, 0.9)', boardTrim: '#5a2d91', boardPad: '#3b1f63' },
    grade: ['rgba(110, 50, 200, 0.55)', 'rgba(255, 170, 40, 0.4)'],
  },
  evergreen: {
    name: 'Evergreen',
    price: 450,
    mote: '230, 255, 220',
    brick: [60, 104, 74],
    mortar: '#22382a',
    wallPad: '#0e2a1a',
    wood: [206, 150, 96],
    paint: 'rgba(18, 150, 80, 0.58)',
    lines: 'rgba(255, 255, 255, 0.88)',
    light: 'rgba(220, 255, 210, 0.3)',
    shade: 0.5,
    hoop: { boardTrim: '#138a4a', boardPad: '#0e2a1a' },
    grade: ['rgba(20, 110, 70, 0.5)', 'rgba(255, 150, 60, 0.36)'],
  },
  icebox: {
    name: 'Ice Box',
    price: 450,
    mote: '210, 235, 255',
    brick: [192, 212, 232],
    mortar: '#eef4fa',
    wallPad: '#0b2a55',
    wood: [232, 216, 192],
    paint: 'rgba(60, 170, 255, 0.5)',
    lines: 'rgba(255, 255, 255, 0.95)',
    light: 'rgba(200, 235, 255, 0.42)',
    shade: 0.22,
    hoop: { rim: '#3fb6ff', rimDark: '#0b4f8a', rimHi: 'rgba(210, 240, 255, 0.95)', boardTrim: '#1f6fd1', boardPad: '#0b2a55' },
    grade: ['rgba(60, 140, 255, 0.5)', 'rgba(150, 210, 255, 0.32)'],
  },
  inferno: {
    name: 'Inferno',
    price: 900,
    mote: '255, 150, 60',
    brick: [46, 40, 42],
    mortar: '#141214',
    wallPad: '#a8100d',
    wood: [98, 62, 46],
    paint: 'rgba(232, 40, 20, 0.6)',
    lines: 'rgba(255, 150, 90, 0.9)',
    light: 'rgba(255, 90, 40, 0.38)',
    shade: 0.7,
    hoop: { rim: '#ff3a1a', rimDark: '#6e0d02', boardTrim: '#e02010', boardPad: '#141214' },
    grade: ['rgba(180, 20, 10, 0.5)', 'rgba(255, 110, 30, 0.45)'],
  },
  sweetswish: {
    name: 'Sweet Swish',
    price: 300,
    mote: '255, 205, 232',
    brick: [238, 168, 196],
    mortar: '#fde4ee',
    wallPad: '#c2327a',
    wood: [244, 208, 198],
    paint: 'rgba(255, 88, 170, 0.5)',
    lines: 'rgba(255, 255, 255, 0.95)',
    light: 'rgba(255, 205, 235, 0.46)',
    shade: 0.16,
    hoop: { rim: '#ff5fa8', rimDark: '#a3246a', rimHi: 'rgba(255, 215, 238, 0.95)', boardTrim: '#ff5fa8', boardPad: '#c2327a' },
    grade: ['rgba(210, 120, 255, 0.45)', 'rgba(255, 140, 190, 0.42)'],
  },
  // Outdoor courts: a painted backdrop scene instead of the brick wall
  canopy: {
    name: 'Canopy',
    price: 0, // free: the outdoor starter court
    scene: 'jungle', surface: 'stone', mote: '200, 255, 120', shine: 0.1,
    wood: [132, 140, 112], paint: 'rgba(30, 150, 90, 0.5)', lines: 'rgba(240, 255, 230, 0.85)',
    light: 'rgba(210, 255, 170, 0.32)', shade: 0.45,
    edge: { type: 'ledge', ledge: '#3b4a36', ledgeH: 0.32 },
    hoop: { boardTrim: '#1e8a50', boardPad: '#2a3a22' },
    grade: ['rgba(20, 90, 60, 0.5)', 'rgba(200, 160, 60, 0.36)'],
  },
  pinehollow: {
    name: 'Pine Hollow',
    price: 500,
    scene: 'forest', surface: 'planks', mote: '220, 240, 255', cones: false, shine: 0.16,
    wood: [150, 108, 76], paint: 'rgba(40, 110, 60, 0.58)', lines: 'rgba(255, 255, 255, 0.88)',
    light: 'rgba(255, 220, 180, 0.34)', shade: 0.15,
    edge: { type: 'rail', color: '#5a3a24', height: 0.9, rails: [0.45, 0.85], step: 1.1, thick: 1.8 },
    hoop: { boardTrim: '#2f6b3f', boardPad: '#3a2a1c' },
    grade: ['rgba(40, 90, 110, 0.5)', 'rgba(255, 150, 80, 0.36)'],
  },
  summit: {
    name: 'Summit',
    price: 650,
    scene: 'summit', surface: 'acrylic', mote: '255, 255, 255', cones: false, shine: 0.12,
    wood: [78, 140, 96], courtInner: 'rgba(40, 92, 180, 0.9)', paint: 'rgba(18, 44, 110, 0.65)', lines: 'rgba(255, 255, 255, 0.95)',
    light: 'rgba(255, 255, 255, 0.34)', shade: 0.1,
    edge: { type: 'rail', color: '#3a4150', ledge: '#6b6f78', ledgeH: 0.18, height: 1.0, rails: [0.55, 1.0], step: 0.8 },
    hoop: { boardTrim: '#1f5fb8', boardPad: '#1f5fb8' },
    grade: ['rgba(60, 120, 220, 0.4)', 'rgba(255, 200, 140, 0.3)'],
  },
  lantern: {
    name: 'Lantern Temple',
    price: 800,
    scene: 'temple', surface: 'stone', mote: '255, 190, 90', cones: false, shine: 0.14,
    wood: [172, 162, 150], paint: 'rgba(190, 30, 40, 0.58)', lines: 'rgba(255, 212, 120, 0.92)',
    light: 'rgba(255, 170, 90, 0.4)', shade: 0.3,
    edge: { type: 'rail', color: '#8e847b', ledge: '#9a8f86', ledgeH: 0.3, height: 0.75, rails: [0.75], step: 0.55, thick: 1.6 },
    hoop: { rim: '#e8b340', rimDark: '#7a4f00', rimHi: 'rgba(255, 240, 190, 0.95)', boardTrim: '#c22a2a', boardPad: '#7a1016' },
    grade: ['rgba(90, 30, 140, 0.5)', 'rgba(255, 120, 40, 0.42)'],
  },
  sunset: {
    name: 'Sunset Beach',
    price: 550,
    scene: 'beach', surface: 'acrylic', mote: '255, 230, 190', cones: false, shine: 0.14,
    wood: [58, 150, 168], courtInner: 'rgba(24, 96, 128, 0.6)', paint: 'rgba(255, 110, 90, 0.65)', lines: 'rgba(255, 255, 255, 0.95)',
    light: 'rgba(255, 190, 120, 0.4)', shade: 0.15,
    edge: { type: 'none' },
    hoop: { rim: '#ff6a5a', rimDark: '#8a2a20', rimHi: 'rgba(255, 210, 190, 0.9)', boardTrim: '#1f8aa0', boardPad: '#1f5a70' },
    grade: ['rgba(120, 40, 160, 0.45)', 'rgba(255, 150, 60, 0.42)'],
  },
  // The three classics: each difficulty's court until the player picks one
  easy: {
    name: 'Rec Center',
    price: 0, // free
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
    name: 'Brick Gym',
    price: 0, // free
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
    name: 'Night Court',
    price: 0, // free
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

/**
 * Floor surfaces (the Floors tab). Each one works on any stadium:
 *   wood  = RGB of an average plank (drawn as planks, like the stadiums' floors)
 *   solid = RGB of a one-piece sport surface (no planks)
 *   speckle = little light/dark dots (asphalt), grid = glowing tile lines (LED glass)
 * The stadium's lane paint and court lines are drawn on top of any floor.
 */
export const FLOORS = {
  stadium: { name: 'Stadium', price: 0 }, // the stadium's own floor
  maple: { name: 'Maple', price: 0, wood: [240, 206, 158] },
  cherry: { name: 'Cherry', price: 200, wood: [176, 84, 56] },
  blacktop: { name: 'Blacktop', price: 250, solid: [62, 64, 70], speckle: true },
  ebony: { name: 'Ebony', price: 350, wood: [66, 52, 50] },
  royal: { name: 'Royal Court', price: 400, solid: [36, 80, 170] },
  glass: { name: 'LED Glass', price: 800, solid: [18, 22, 40], grid: 'rgba(90, 210, 255, 0.5)' },
};

// Used when a theme doesn't set its own
const DEFAULT_MOTE = '255, 240, 220';
const DEFAULT_GRADE = ['rgba(30, 70, 140, 0.55)', 'rgba(255, 130, 50, 0.4)'];

/** The theme for a court id (unknown ids fall back to Brick Gym). */
export function courtTheme(courtId) {
  return COURT_THEMES[courtId] ?? COURT_THEMES.normal;
}

/** "r, g, b" of a court's floating dust, for effects.drawMotes(). */
export function courtMote(courtId) {
  return courtTheme(courtId).mote ?? DEFAULT_MOTE;
}

/** A court's lane paint without its transparency, e.g. for the dot next to its name. */
export function courtColor(courtId) {
  return courtTheme(courtId).paint.replace('rgba', 'rgb').replace(/,\s*[\d.]+\)$/, ')');
}

// Sizes in meters
const BRICK_W = 0.26;
const BRICK_H = 0.085;
const MORTAR = 0.012;
const PAD_HEIGHT = 0.28; // wall padding strip at the bottom
const PLANK_W = 0.11;
const LANE_HALF_WIDTH = 0.9;
const FREE_THROW_Z = 0.25; // just in front of the resting ball
const SPECKLES = 2500; // dots in a speckled (blacktop) floor
const GRID_TILE = 0.5; // size of a glass floor tile

/** A floor's color as CSS, e.g. for its dot (the stadium floor uses the stadium's wood). */
export function floorColor(floorId, courtId) {
  const floor = FLOORS[floorId] ?? FLOORS.stadium;
  return rgb(floor.solid ?? floor.wood ?? courtTheme(courtId).wood, 1);
}

/**
 * `hoop` supplies where things are (its distance changes with difficulty).
 * `floorId` is a key of FLOORS ('stadium' = the stadium's own wood).
 */
export function drawCourt(ctx, width, height, hoop, courtId = 'normal', floorId = 'stadium') {
  // A hidden page can report a 0 size: bricks would be 0 px tall and the wall loop would never end
  if (!(width > 0 && height > 0)) return;
  const theme = courtTheme(courtId);
  const floor = FLOORS[floorId] ?? FLOORS.stadium;
  const random = seededRandom(7); // same "random" bricks every time we redraw
  const floorLine = project(0, 0, hoop.wallZ).y;

  if (theme.scene) drawScene(ctx, width, height, floorLine, hoop, theme, random);
  else drawWall(ctx, width, floorLine, hoop, theme, random);
  if (FX) depthOfField(ctx, width, floorLine);
  drawFloor(ctx, width, height, floorLine, hoop, theme, floor, random);
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

function drawFloor(ctx, width, height, floorLine, hoop, theme, floor, random) {
  const far = hoop.wallZ;
  const near = camera.z + 0.2; // just in front of the camera

  if (theme.surface === 'stone') drawStone(ctx, far, near, theme, random);
  else if (theme.surface === 'acrylic') drawAcrylic(ctx, width, height, floorLine, theme, random);
  else if (floor.solid) drawSolidFloor(ctx, width, height, floorLine, far, near, floor, random);
  else drawPlanks(ctx, width, height, floorLine, far, near, floor.wood ?? theme.wood, random);

  // A two-tone hard court (outdoor acrylic surfaces): a painted rectangle
  // near the baseline, under the lane paint
  const baseZ = baselineZ(hoop);
  if (theme.courtInner) fillFloorShape(ctx, [[-2.6, baseZ], [2.6, baseZ], [2.6, near], [-2.6, near]], theme.courtInner);

  // Painted lane (the "key") from the baseline to the free throw line
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

/** Hardwood: planks that run toward the wall, all pointing at the same vanishing point. */
function drawPlanks(ctx, width, height, floorLine, far, near, wood, random) {
  // Base color first so no gaps show between planks
  ctx.fillStyle = rgb(wood, 0.85);
  ctx.fillRect(0, floorLine, width, height - floorLine);

  for (let x = -6; x < 6; x += PLANK_W) {
    const a = project(x, 0, far);
    const b = project(x + PLANK_W, 0, far);
    const c = project(x + PLANK_W, 0, near);
    const d = project(x, 0, near);
    ctx.fillStyle = rgb(wood, 0.88 + random() * 0.2);
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
}

/** A one-piece surface (blacktop, sport court, glass), with optional speckles or a glowing grid. */
function drawSolidFloor(ctx, width, height, floorLine, far, near, floor, random) {
  // Slightly darker far away, so the floor still reads as going back to the wall
  const base = ctx.createLinearGradient(0, floorLine, 0, height);
  base.addColorStop(0, rgb(floor.solid, 0.8));
  base.addColorStop(1, rgb(floor.solid, 1.05));
  ctx.fillStyle = base;
  ctx.fillRect(0, floorLine, width, height - floorLine);

  if (floor.speckle) {
    // Little stones in the asphalt: smaller and denser toward the wall
    for (let i = 0; i < SPECKLES; i++) {
      const p = project(-6 + random() * 12, 0, near + random() * (far - near));
      const size = Math.max(0.6, p.scale * 0.008);
      ctx.fillStyle = random() < 0.5 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(p.x, p.y, size, size * 0.6);
    }
  }

  if (floor.grid) {
    ctx.strokeStyle = floor.grid;
    for (let x = -6; x <= 6; x += GRID_TILE) floorPath(ctx, [[x, far], [x, near]]);
    for (let z = far; z > near; z -= GRID_TILE) floorPath(ctx, [[-6, z], [6, z]]);
  }
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
  shine.addColorStop(0, `rgba(255, 255, 255, ${theme.shine ?? 0.22})`);
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, floorLine, width, height - floorLine);

  if (FX && theme.cones !== false) drawLightCones(ctx, width, height, floorLine, theme);

  // Vignette (darker edges pull the eye to the center)
  const vignette = ctx.createRadialGradient(width / 2, height * 0.5, height * 0.3, width / 2, height * 0.5, height * 0.85);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  if (FX) colorGrade(ctx, width, height, theme);
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

/** Cinematic grade: cool shadows up top, warm floor (or the theme's own colors), heavy vignette. */
function colorGrade(ctx, width, height, theme) {
  const [top, bottom] = theme.grade ?? DEFAULT_GRADE;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const grade = ctx.createLinearGradient(0, 0, 0, height);
  grade.addColorStop(0, top);
  grade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grade.addColorStop(1, bottom);
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
// Outdoor backdrops (screen space above the floor line)
// ---------------------------------------------------------------------------

/** A painted scene (jungle, forest, mountain, temple or beach) instead of the brick wall. */
function drawScene(ctx, W, H, FL, hoop, theme, rnd) {
  const HY = Math.min(camera.horizonY, FL - 4);
  ({ summit: sceneSummit, forest: sceneForest, jungle: sceneJungle, temple: sceneTemple, beach: sceneBeach })[theme.scene](ctx, W, H, FL, HY, rnd);
  drawEdge(ctx, W, FL, hoop, theme);
  const shade = ctx.createLinearGradient(0, 0, 0, FL);
  shade.addColorStop(0, `rgba(0, 0, 0, ${theme.shade})`);
  shade.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, FL);
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function glowAt(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function peaksPath(W, base, peaks, rnd, jag) {
  const pts = [[0, base + 40]];
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * W;
    let h = 0;
    for (const p of peaks) h = Math.max(h, p.h * (1 - Math.abs(x - p.x) / p.w));
    pts.push([x, base - h + (rnd() - 0.5) * jag]);
  }
  pts.push([W, base + 40]);
  return pts;
}

function snowCaps(ctx, pts, peaks, base, rnd, color) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = color;
  for (const p of peaks) {
    const top = base - p.h, line = top + p.h * 0.34, half = p.w * 0.36;
    ctx.beginPath();
    ctx.moveTo(p.x, top - 4);
    ctx.lineTo(p.x + half, line);
    for (let i = 1; i < 8; i++) ctx.lineTo(p.x + half - (i / 8) * half * 2, line + (i % 2 ? -1 : 1) * p.h * 0.06 * (0.5 + rnd()));
    ctx.lineTo(p.x - half, line);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function sceneSummit(ctx, W, H, FL, HY, rnd) {
  ctx.fillStyle = vgrad(ctx, 0, HY, ['#3a69b3', '#7fb0e2', '#dcebf9']);
  ctx.fillRect(0, 0, W, FL);
  glowAt(ctx, W * 0.18, H * 0.08, W * 0.5, 'rgba(255, 250, 225, 0.55)');
  const far = [{ x: W * 0.1, h: H * 0.3, w: W * 0.34 }, { x: W * 0.45, h: H * 0.22, w: W * 0.3 }, { x: W * 0.82, h: H * 0.34, w: W * 0.34 }];
  const fp = peaksPath(W, HY + 6, far, rnd, 3);
  poly(ctx, fp, '#9aa9cf');
  snowCaps(ctx, fp, far, HY + 6, rnd, '#eef2ff');
  const mid = [{ x: W * -0.02, h: H * 0.22, w: W * 0.3 }, { x: W * 0.3, h: H * 0.14, w: W * 0.24 }, { x: W * 0.66, h: H * 0.18, w: W * 0.26 }, { x: W * 1.04, h: H * 0.24, w: W * 0.3 }];
  const mp = peaksPath(W, HY + 14, mid, rnd, 5);
  poly(ctx, mp, '#5a6f98');
  snowCaps(ctx, mp, mid, HY + 14, rnd, '#ffffff');
  const cloudTop = HY + (FL - HY) * 0.05;
  ctx.fillStyle = vgrad(ctx, cloudTop, FL, ['#f5f8fc', '#d3ddec']);
  ctx.fillRect(0, cloudTop, W, FL - cloudTop);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, r = W * (0.03 + rnd() * 0.05), y = cloudTop + rnd() * (FL - cloudTop) * 0.5;
    ctx.fillStyle = 'rgba(190, 204, 225, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f7f9fd';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

function pine(ctx, x, base, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - h * 0.02, base - h * 0.15, h * 0.04, h * 0.15);
  for (let t = 0; t < 4; t++) {
    const top = base - h + t * h * 0.19, bottom = top + h * 0.36, half = h * (0.12 + t * 0.055);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + half, bottom);
    ctx.lineTo(x - half, bottom);
    ctx.closePath();
    ctx.fill();
  }
}

function sceneForest(ctx, W, H, FL, HY, rnd) {
  ctx.fillStyle = vgrad(ctx, 0, HY, ['#4a7f8e', '#a9c9c4', '#ffd6a8']);
  ctx.fillRect(0, 0, W, FL);
  glowAt(ctx, W * 0.5, HY, W * 0.6, 'rgba(255, 210, 160, 0.45)');
  ctx.fillStyle = vgrad(ctx, HY, FL, ['#4d6a5e', '#1d3328']);
  ctx.fillRect(0, HY, W, FL - HY);
  const layers = [
    { base: HY + (FL - HY) * 0.12, min: 0.09, max: 0.14, n: 34, color: '#9fb8b6' },
    { base: HY + (FL - HY) * 0.45, min: 0.13, max: 0.22, n: 22, color: '#5f8279' },
    { base: FL + 2, min: 0.2, max: 0.3, n: 14, color: '#24453a', edge: true },
  ];
  layers.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const x = ((i + rnd() * 0.8) / L.n) * W * 1.1 - W * 0.05;
      const side = L.edge ? Math.pow(Math.abs(x / W - 0.5) * 2, 1.6) : 0;
      pine(ctx, x, L.base, H * (L.min + rnd() * (L.max - L.min) + side * 0.4), L.color);
    }
    if (li < 2) {
      const fogY = L.base - H * 0.02;
      ctx.fillStyle = vgrad(ctx, fogY - H * 0.06, fogY + H * 0.03, ['rgba(230, 236, 232, 0)', 'rgba(230, 236, 232, 0.5)', 'rgba(230, 236, 232, 0)']);
      ctx.fillRect(0, fogY - H * 0.06, W, H * 0.09);
    }
  });
}

function leaf(ctx, x, y, len, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(len / 2, 0, len / 2, len * 0.17, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(1, len * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.95, 0);
  ctx.stroke();
  ctx.restore();
}

function sceneJungle(ctx, W, H, FL, HY, rnd) {
  ctx.fillStyle = vgrad(ctx, 0, FL, ['#0f3322', '#4d8a5c', '#2a5a3a']);
  ctx.fillRect(0, 0, W, FL);
  glowAt(ctx, W * 0.55, HY - H * 0.1, W * 0.55, 'rgba(230, 255, 190, 0.45)');
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = HY - H * 0.12 + rnd() * H * 0.16, r = W * (0.03 + rnd() * 0.05);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(110, 165, 118, 0.7)' : 'rgba(86, 140, 100, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const x = ((i + 0.2 + rnd() * 0.6) / 8) * W, w = W * (0.015 + rnd() * 0.035), near = w > W * 0.035;
    ctx.fillStyle = near ? '#26331f' : '#46634a';
    ctx.fillRect(x - w / 2, 0, w, FL);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(x - w / 2, 0, w * 0.3, FL);
  }
  for (let i = 0; i < 32; i++) {
    const x = rnd() * W, y = rnd() * H * 0.12, r = W * (0.05 + rnd() * 0.08);
    ctx.fillStyle = rnd() > 0.5 ? '#163f28' : '#1d4a30';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const x0 = (0.08 + rnd() * 0.84) * W, len = H * (0.12 + rnd() * 0.22), dx = (rnd() - 0.5) * W * 0.08;
    ctx.strokeStyle = '#1f4a2c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.quadraticCurveTo(x0 + dx * 2, len * 0.5, x0 + dx, len);
    ctx.stroke();
    for (let k = 1; k < 6; k++) leaf(ctx, x0 + dx * (2 * (k / 6) * (1 - k / 6) * 2 + (k / 6) * (k / 6)), len * (k / 6), W * 0.03, k % 2 ? 0.6 : 2.5, '#2b6a3c');
  }
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W, y = FL - rnd() * H * 0.05, r = W * (0.03 + rnd() * 0.05);
    ctx.fillStyle = rnd() > 0.5 ? '#2f6b40' : '#255a36';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  const corner = (cx, cy, dir) => {
    for (let i = 0; i < 9; i++) leaf(ctx, cx, cy + i * H * 0.012, W * (0.2 + rnd() * 0.16), (dir > 0 ? 0.1 : Math.PI - 0.1) + dir * (i * 0.16 + rnd() * 0.1), i % 2 ? '#123a24' : '#18482c');
  };
  corner(-W * 0.04, -H * 0.02, 1);
  corner(W * 1.04, -H * 0.02, -1);
}

function roof(ctx, cx, eaveY, half, rise, lift, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - half * 1.18, eaveY - lift);
  ctx.quadraticCurveTo(cx - half * 1.02, eaveY + lift * 0.1, cx - half * 0.8, eaveY);
  ctx.lineTo(cx + half * 0.8, eaveY);
  ctx.quadraticCurveTo(cx + half * 1.02, eaveY + lift * 0.1, cx + half * 1.18, eaveY - lift);
  ctx.quadraticCurveTo(cx + half * 0.8, eaveY - rise * 0.35, cx + half * 0.62, eaveY - rise);
  ctx.lineTo(cx - half * 0.62, eaveY - rise);
  ctx.quadraticCurveTo(cx - half * 0.8, eaveY - rise * 0.35, cx - half * 1.18, eaveY - lift);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(cx - half * 0.64, eaveY - rise - 3, half * 1.28, 3);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(cx - half * 0.8, eaveY, half * 1.6, Math.max(2, rise * 0.1));
}

function sceneTemple(ctx, W, H, FL, HY, rnd) {
  ctx.fillStyle = vgrad(ctx, 0, HY, ['#1c1640', '#6b2d6b', '#f08a4b']);
  ctx.fillRect(0, 0, W, FL);
  glowAt(ctx, W * 0.5, HY, W * 0.7, 'rgba(255, 170, 90, 0.4)');
  for (const [col, amp, base] of [['#9a6a96', 0.2, HY + 4], ['#6a3f72', 0.13, HY + 10]]) {
    const pts = [[0, FL]];
    const hills = Array.from({ length: 6 }, () => ({ x: rnd() * W, w: W * (0.05 + rnd() * 0.07), h: H * amp * (0.5 + rnd() * 0.5) }));
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * W;
      let h = 0;
      for (const p of hills) h = Math.max(h, p.h * Math.exp(-(((x - p.x) / p.w) ** 2)));
      pts.push([x, base - h]);
    }
    pts.push([W, FL]);
    poly(ctx, pts, col);
  }
  ctx.fillStyle = vgrad(ctx, HY, FL, ['#6a4a52', '#3e2c32']);
  ctx.fillRect(0, HY + 8, W, FL - HY - 8);
  const cx = W / 2, plat = FL - H * 0.02, colTop = FL - H * 0.13, half = W * 0.36;
  ctx.fillStyle = '#8b7b70';
  ctx.fillRect(cx - half * 1.05, plat, half * 2.1, FL - plat);
  ctx.fillStyle = '#3a1418';
  ctx.fillRect(cx - half * 0.9, colTop, half * 1.8, plat - colTop);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(217, 164, 65, 0.35)';
    const x = cx - half * 0.8 + i * half * 0.4;
    ctx.fillRect(x + half * 0.06, colTop + H * 0.03, half * 0.28, (plat - colTop) * 0.5);
  }
  for (let i = 0; i <= 8; i++) {
    const x = cx - half * 0.9 + (i / 8) * half * 1.8, w = W * 0.016;
    ctx.fillStyle = '#b3202a';
    ctx.fillRect(x - w / 2, colTop, w, plat - colTop);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x + w * 0.15, colTop, w * 0.35, plat - colTop);
  }
  const beamH = H * 0.016;
  ctx.fillStyle = '#c22a2a';
  ctx.fillRect(cx - half * 0.95, colTop - beamH, half * 1.9, beamH);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(cx - half * 0.95, colTop - beamH * 0.55, half * 1.9, beamH * 0.2);
  roof(ctx, cx, colTop - beamH, half, H * 0.055, H * 0.03, '#1f3b3a');
  const t2 = colTop - beamH - H * 0.055, c2 = t2 - H * 0.035;
  ctx.fillStyle = '#3a1418';
  ctx.fillRect(cx - half * 0.42, c2, half * 0.84, t2 - c2);
  for (let i = 0; i <= 4; i++) {
    ctx.fillStyle = '#b3202a';
    ctx.fillRect(cx - half * 0.42 + i * half * 0.21 - 2, c2, 4, t2 - c2);
  }
  roof(ctx, cx, c2, half * 0.55, H * 0.04, H * 0.022, '#1f3b3a');
  const string = (y0, y1, sag, n) => {
    const pt = (t) => [t * W, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)];
    ctx.strokeStyle = 'rgba(40, 20, 20, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const [x, y] = pt(i / 30);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 1; i < n; i++) {
      const [x, y] = pt(i / n), rx = W * 0.022, ry = W * 0.028, ly = y + ry + 3;
      glowAt(ctx, x, ly, W * 0.09, 'rgba(255, 120, 60, 0.45)');
      const g = ctx.createRadialGradient(x - rx * 0.3, ly - ry * 0.3, 0, x, ly, ry);
      g.addColorStop(0, '#ffb070');
      g.addColorStop(0.5, '#e8322a');
      g.addColorStop(1, '#8a1010');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, ly, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(x - rx * 0.55, ly - ry - 2, rx * 1.1, 3);
      ctx.fillRect(x - rx * 0.55, ly + ry - 1, rx * 1.1, 3);
      ctx.strokeStyle = '#d9a441';
      ctx.beginPath();
      ctx.moveTo(x, ly + ry + 2);
      ctx.lineTo(x, ly + ry + ry * 0.8);
      ctx.stroke();
    }
  };
  string(H * 0.03, H * 0.06, H * 0.08, 7);
}

function palm(ctx, bx, by, tx, ty, size, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const mx = (bx + tx) / 2 + (tx - bx) * 0.4, my = (by + ty) / 2;
  for (let i = 0; i < 10; i++) {
    const t0 = i / 10, t1 = (i + 1) / 10;
    const q = (t) => [(1 - t) ** 2 * bx + 2 * t * (1 - t) * mx + t * t * tx, (1 - t) ** 2 * by + 2 * t * (1 - t) * my + t * t * ty];
    const [x0, y0] = q(t0), [x1, y1] = q(t1);
    ctx.lineWidth = size * (0.09 - t0 * 0.05);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI + (i / 7) * Math.PI + (Math.random() - 0.5) * 0.1, len = size * (0.5 + (i % 3) * 0.12);
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + len * 0.45;
    const cxp = tx + Math.cos(a) * len * 0.55, cyp = ty + Math.sin(a) * len * 0.55 - len * 0.1;
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cxp, cyp, ex, ey);
    ctx.stroke();
    ctx.lineWidth = size * 0.025;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cxp, cyp + size * 0.04, ex, ey + size * 0.03);
    ctx.stroke();
  }
}

function sceneBeach(ctx, W, H, FL, HY, rnd) {
  ctx.fillStyle = vgrad(ctx, 0, HY, ['#2b1b4f', '#a8406e', '#ff8a4d', '#ffd08a']);
  ctx.fillRect(0, 0, W, FL);
  const sx = W * 0.74, sr = W * 0.075;
  glowAt(ctx, sx, HY, W * 0.55, 'rgba(255, 200, 120, 0.5)');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, HY);
  ctx.clip();
  ctx.fillStyle = '#fff0b8';
  ctx.beginPath();
  ctx.arc(sx, HY + sr * 0.25, sr, 0, TAU);
  ctx.fill();
  ctx.restore();
  const sand = FL - (FL - HY) * 0.3;
  ctx.fillStyle = vgrad(ctx, HY, sand, ['#6a3a7a', '#1f4a7a']);
  ctx.fillRect(0, HY, W, sand - HY);
  for (let i = 0; i < 70; i++) {
    const t = rnd(), y = HY + 2 + t * (sand - HY - 4), spread = W * (0.04 + t * 0.22);
    const x = sx + (rnd() - 0.5) * spread * 2, len = W * (0.01 + rnd() * 0.04) * (0.5 + t);
    ctx.fillStyle = `rgba(255, 215, 150, ${0.25 + rnd() * 0.45})`;
    ctx.fillRect(x - len / 2, y, len, Math.max(1, t * 2));
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(0, sand - 2, W, 2);
  ctx.fillStyle = vgrad(ctx, sand, FL, ['#e8b98a', '#c9956a']);
  ctx.fillRect(0, sand, W, FL - sand);
  palm(ctx, W * 0.9, FL, W * 1.0, H * 0.3, W * 0.28, '#35162e');
  palm(ctx, W * 0.06, FL, W * 0.16, H * 0.14, W * 0.42, '#2a1030');
  palm(ctx, W * 0.97, FL, W * 0.78, H * 0.16, W * 0.4, '#2a1030');
}

/** The court's edge on outdoor scenes: a ledge and/or a railing at the baseline. */
function drawEdge(ctx, W, FL, hoop, theme) {
  const e = theme.edge || { type: 'none' };
  if (e.type === 'none') return;
  const z = hoop.wallZ, s = project(0, 0, z).scale;
  if (e.ledge) {
    const top = project(0, e.ledgeH, z).y;
    ctx.fillStyle = vgrad(ctx, top, FL, [lighten(e.ledge, 0.15), e.ledge]);
    ctx.fillRect(0, top, W, FL - top);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(0, top, W, Math.max(1, s * 0.01));
  }
  if (e.type !== 'rail') return;
  const t = (e.thick || 1) * Math.max(2, s * 0.03);
  const base = e.ledge ? e.ledgeH : 0;
  ctx.fillStyle = e.color;
  for (let x = -6; x <= 6; x += e.step) {
    const b = project(x, base, z), tp = project(x, e.height, z);
    ctx.fillRect(b.x - t / 2, tp.y, t, b.y - tp.y);
  }
  for (const h of e.rails) {
    const y = project(0, h, z).y;
    ctx.fillRect(0, y - t * 0.4, W, t * 0.8);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (const h of e.rails) {
    const y = project(0, h, z).y;
    ctx.fillRect(0, y - t * 0.4, W, Math.max(1, t * 0.2));
  }
}

/** A stone/paver floor: a grid of tiles, each a slightly different shade. */
function drawStone(ctx, far, near, theme, rnd) {
  const T = 0.5;
  ctx.strokeStyle = 'rgba(30, 25, 20, 0.35)';
  ctx.lineWidth = 1;
  let row = 0;
  for (let z = near; z < far; z += T, row++) {
    const z1 = Math.min(far, z + T), off = row % 2 ? T / 2 : 0;
    for (let x = -6 - off; x < 6; x += T) {
      const a = project(x, 0, z1), b = project(x + T, 0, z1), c = project(x + T, 0, z), d = project(x, 0, z);
      if (!a || !d) continue;
      ctx.fillStyle = rgb(theme.wood, 0.82 + rnd() * 0.22);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

/** An acrylic/hard-court floor: a flat color with a subtle speckled texture. */
function drawAcrylic(ctx, W, H, FL, theme, rnd) {
  ctx.fillStyle = rgb(theme.wood, 0.95);
  ctx.fillRect(0, FL, W, H - FL);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * W, y = FL + rnd() * (H - FL);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.07)';
    ctx.fillRect(x, y, 1 + rnd(), 1 + rnd());
  }
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
