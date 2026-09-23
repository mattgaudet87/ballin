/**
 * hoop.js
 * ---------------------------------------------------------------------------
 * The hoop: backboard, rim, net and support pole. It's drawn with
 * projectHoop() (see camera.js) so the rim looks flat and natural from our low
 * camera. Handles:
 *   - sliding side to side once the player's score is high enough
 *   - the springy net animation when a shot goes in
 *   - drawing, split into a BACK layer and a FRONT layer so the ball can
 *     appear to drop *inside* the rim (see render() in main.js)
 */
import { CONFIG } from './config.js';
import { project, projectHoop } from './camera.js';

const TAU = Math.PI * 2;
const NET_STRANDS = 12; // strings around the rim
const NET_ROWS = 4; // diamond rows from top to bottom
const RIM_SEGMENTS = 40;

const COLORS = {
  rim: '#ff5a1f',
  rimDark: '#9e2c08',
  net: 'rgba(255, 255, 255, 0.9)',
  board: '#f7f7f5', // solid white backboard
  boardShade: '#d9dbe0', // bottom of the board, a little darker
  boardTrim: '#c8261e', // red border and shooter's square
  boardEdge: '#9aa0ab',
  poleLight: '#f2f4f8',
  poleDark: '#9da4b2',
};

export class Hoop {
  constructor() {
    const H = CONFIG.hoop;
    this.x = 0; // slides left/right when moving
    this.rimY = H.rimY;
    this.radius = H.rimRadius;
    this.rimScale = 1; // grows while a White Monster is active
    this.tube = H.rimTube;
    this.netLength = H.netLength;
    this.boardThickness = 0.05;
    this.setDistance(3.6, 0.6);
    this.boardWidth = H.boardWidth;
    this.boardBottom = H.rimY - H.boardBelowRim;
    this.boardTop = this.boardBottom + H.boardHeight;

    // Movement
    this.phase = 0;
    this.speed = 0;

    // Net animation (a simple spring)
    this.netStretch = 0;
    this.netVelocity = 0;
    this.wobble = 0;
    this.time = 0;
  }

  /**
   * Place the hoop `z` meters away (depends on the difficulty) and set how
   * far it slides when moving.
   */
  setDistance(z, slideRange) {
    const H = CONFIG.hoop;
    this.baseZ = z; // rim center when the rim is its normal size
    this.z = z;
    this.range = slideRange;
    this.boardZ = z + H.rimRadius + H.boardGap;
    this.wallZ = this.boardZ + CONFIG.court.wallBehindBoard;
  }

  /** Reset position and animations (called at the start of every game). */
  reset() {
    this.x = 0;
    this.phase = 0;
    this.speed = 0;
    this.netStretch = 0;
    this.netVelocity = 0;
    this.wobble = 0;
  }

  /**
   * @param speed      how fast to slide side to side (0 = stay put).
   *                   main.js works this out from the mode's rules.
   * @param rimScale   target rim size (1 = normal, bigger with a White Monster)
   */
  update(dt, speed, rimScale = 1) {
    this.time += dt;
    this.speed = speed;

    if (speed > 0) {
      this.phase += speed * dt;
      this.x = Math.sin(this.phase) * this.range;
    } else {
      // Glide back to the middle.
      this.phase = 0;
      this.x += (0 - this.x) * Math.min(1, dt * 3);
    }

    // Smoothly grow/shrink the rim. It grows toward the player so the back of
    // the rim stays the same distance from the backboard.
    this.rimScale += (rimScale - this.rimScale) * Math.min(1, dt * 6);
    const H = CONFIG.hoop;
    this.radius = H.rimRadius * this.rimScale;
    this.z = this.baseZ - (this.radius - H.rimRadius);

    // Spring the net back to its resting length.
    const stiffness = 140;
    const damping = 9;
    this.netVelocity += (-stiffness * this.netStretch - damping * this.netVelocity) * dt;
    this.netStretch += this.netVelocity * dt;
    this.wobble = Math.max(0, this.wobble - dt * 1.5);
  }

  /**
   * Draw a glowing multiplier badge (like "3×") above the backboard.
   */
  drawBadge(ctx, text, color, time) {
    const p = projectHoop(this.x, this.boardTop + 0.18, this.boardZ);
    if (!p) return;
    const size = Math.max(18, 0.3 * p.scale);
    const pulse = 1 + Math.sin(time * 5) * 0.06;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.font = `900 ${Math.round(size)}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * 0.9;
    const h = size * 1.35;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.8;
    ctx.fillStyle = color;
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, size * 0.04);
    ctx.restore();
  }

  /** Called on a made basket: stretch the net. */
  onScore(strength = 1) {
    this.netVelocity += 5 * strength;
    this.wobble = 1;
  }

  /** Called when the ball clangs the rim: shake the net a little. */
  onRimHit(speed) {
    this.wobble = Math.min(1, this.wobble + speed * 0.15);
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  /** Everything that should appear BEHIND the ball when it's inside the hoop. */
  drawBack(ctx) {
    this.drawPole(ctx);
    this.drawBoard(ctx);
    this.drawBracket(ctx);
    this.drawRim(ctx, 'back');
    this.drawNet(ctx, 'back');
  }

  /** Everything that should appear IN FRONT of the ball when it's inside the hoop. */
  drawFront(ctx) {
    this.drawNet(ctx, 'front');
    this.drawRim(ctx, 'front');
  }

  /** A silver pole from the floor up behind the backboard, with a shadow at its base. */
  drawPole(ctx) {
    const poleZ = this.boardZ + 0.35;
    const bottom = project(this.x, 0, poleZ);
    const top = projectHoop(this.x, this.boardBottom + 0.25, poleZ);
    if (!bottom || !top) return;
    const w = 0.1 * bottom.scale;

    // Shadow on the floor
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(bottom.x, bottom.y, w * 2.2, w * 0.5, 0, 0, TAU);
    ctx.fill();

    // Round-looking pole: light in the middle, darker at the edges
    const shine = ctx.createLinearGradient(bottom.x - w / 2, 0, bottom.x + w / 2, 0);
    shine.addColorStop(0, COLORS.poleDark);
    shine.addColorStop(0.4, COLORS.poleLight);
    shine.addColorStop(1, COLORS.poleDark);
    ctx.fillStyle = shine;
    ctx.fillRect(bottom.x - w / 2, top.y, w, bottom.y - top.y);
  }

  drawBoard(ctx) {
    const halfW = this.boardWidth / 2;
    const tl = projectHoop(this.x - halfW, this.boardTop, this.boardZ);
    const br = projectHoop(this.x + halfW, this.boardBottom, this.boardZ);
    if (!tl || !br) return;
    const s = tl.scale;
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const corner = 0.05 * s;

    // Soft shadow behind the board, then the white board itself
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 0.12 * s;
    ctx.shadowOffsetY = 0.03 * s;
    const face = ctx.createLinearGradient(0, tl.y, 0, br.y);
    face.addColorStop(0, COLORS.board);
    face.addColorStop(1, COLORS.boardShade);
    ctx.fillStyle = face;
    roundRect(ctx, tl.x, tl.y, w, h, corner);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = Math.max(1.5, 0.015 * s);
    ctx.stroke();

    // Red border just inside the edge
    const inset = 0.05 * s;
    ctx.strokeStyle = COLORS.boardTrim;
    ctx.lineWidth = Math.max(2, 0.03 * s);
    roundRect(ctx, tl.x + inset, tl.y + inset, w - inset * 2, h - inset * 2, corner * 0.6);
    ctx.stroke();

    // Shooter's square above the rim
    const sq = projectHoop(this.x - 0.3, this.rimY + 0.45, this.boardZ);
    const sqEnd = projectHoop(this.x + 0.3, this.rimY + 0.02, this.boardZ);
    ctx.lineWidth = Math.max(2, 0.035 * s);
    ctx.strokeRect(sq.x, sq.y, sqEnd.x - sq.x, sqEnd.y - sq.y);
  }

  /** The little metal arm joining the rim to the backboard. */
  drawBracket(ctx) {
    const a = projectHoop(this.x, this.rimY, this.z + this.radius);
    const b = projectHoop(this.x, this.rimY, this.boardZ);
    ctx.strokeStyle = COLORS.rimDark;
    ctx.lineWidth = Math.max(2, 0.07 * a.scale);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /** Draw half of the rim: 'back' (far side) or 'front' (near side). */
  drawRim(ctx, half) {
    const start = half === 'back' ? 0 : Math.PI;
    const center = projectHoop(this.x, this.rimY, this.z);
    const width = Math.max(2.5, this.tube * 2 * center.scale);

    ctx.beginPath();
    for (let i = 0; i <= RIM_SEGMENTS / 2; i++) {
      const a = start + (i / (RIM_SEGMENTS / 2)) * Math.PI;
      const p = projectHoop(this.x + Math.cos(a) * this.radius, this.rimY, this.z + Math.sin(a) * this.radius);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.lineCap = 'round';
    // Dark outline first, then the bright rim on top
    ctx.strokeStyle = COLORS.rimDark;
    ctx.lineWidth = width + 2;
    ctx.stroke();
    ctx.strokeStyle = COLORS.rim;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** 3D position of a knot in the net. row 0 = at the rim, row NET_ROWS = bottom. */
  netPoint(row, strand) {
    const f = row / NET_ROWS;
    const stretch = Math.max(-0.3, this.netStretch);
    const angle = ((strand + (row % 2) * 0.5) / NET_STRANDS) * TAU;
    const radius = this.radius * (1 - 0.42 * f) * (1 - 0.18 * stretch * f);
    const sway = Math.sin(this.time * 22 + strand * 1.3 + row) * this.wobble * 0.03 * f;
    return {
      x: this.x + Math.cos(angle) * radius + sway,
      y: this.rimY - this.netLength * f * (1 + 0.35 * stretch),
      z: this.z + Math.sin(angle) * radius,
    };
  }

  /** Draw the diamond-pattern net. Strands on the far side are 'back', near side 'front'. */
  drawNet(ctx, half) {
    const wantBack = half === 'back';
    const center = projectHoop(this.x, this.rimY, this.z);
    ctx.strokeStyle = COLORS.net;
    ctx.lineWidth = Math.max(1, 0.011 * center.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let row = 0; row < NET_ROWS; row++) {
      for (let strand = 0; strand < NET_STRANDS; strand++) {
        const a = this.netPoint(row, strand);
        // Each knot connects diagonally to the two knots below it.
        const offset = row % 2 === 0 ? -1 : 1;
        const neighbors = [strand, (strand + offset + NET_STRANDS) % NET_STRANDS];
        for (const n of neighbors) {
          const b = this.netPoint(row + 1, n);
          const isBack = (a.z + b.z) / 2 > this.z;
          if (isBack !== wantBack) continue;
          const pa = projectHoop(a.x, a.y, a.z);
          const pb = projectHoop(b.x, b.y, b.z);
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
        }
      }
    }
    ctx.stroke();
  }
}

/** Rounded rectangle path helper (works on older Safari too). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
