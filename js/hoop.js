/**
 * hoop.js
 * ---------------------------------------------------------------------------
 * The hoop: backboard, rim, net and support pole. Handles:
 *   - sliding side to side once the player's score is high enough
 *   - the springy net animation when a shot goes in
 *   - drawing, split into a BACK layer and a FRONT layer so the ball can
 *     appear to drop *inside* the rim (see render() in main.js)
 */
import { CONFIG } from './config.js';
import { project } from './camera.js';

const TAU = Math.PI * 2;
const NET_STRANDS = 12; // strings around the rim
const NET_ROWS = 4; // diamond rows from top to bottom
const RIM_SEGMENTS = 40;

const COLORS = {
  rim: '#ff5a1f',
  rimDark: '#9e2c08',
  net: 'rgba(255, 255, 255, 0.85)',
  board: 'rgba(255, 255, 255, 0.12)',
  boardEdge: '#ffffff',
  pole: '#1d2540',
};

export class Hoop {
  constructor() {
    const H = CONFIG.hoop;
    this.x = 0; // slides left/right when moving
    this.z = H.z;
    this.rimY = H.rimY;
    this.radius = H.rimRadius;
    this.tube = H.rimTube;
    this.netLength = H.netLength;

    this.boardZ = H.z + H.rimRadius + H.boardGap;
    this.boardThickness = 0.05;
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

  /** Reset position and animations (called at the start of every game). */
  reset() {
    this.phase = 0;
    this.speed = 0;
    this.netStretch = 0;
    this.netVelocity = 0;
    this.wobble = 0;
  }

  update(dt, score, isPlaying) {
    this.time += dt;
    const G = CONFIG.game;

    if (isPlaying && score >= G.movingHoopScore) {
      // Slide side to side, faster as the score climbs.
      this.speed = Math.min(G.hoopSpeedMax, G.hoopSpeedStart + (score - G.movingHoopScore) * G.hoopSpeedPerPoint);
      this.phase += this.speed * dt;
      this.x = Math.sin(this.phase) * G.hoopRange;
    } else {
      // Glide back to the middle.
      this.x += (0 - this.x) * Math.min(1, dt * 3);
    }

    // Spring the net back to its resting length.
    const stiffness = 140;
    const damping = 9;
    this.netVelocity += (-stiffness * this.netStretch - damping * this.netVelocity) * dt;
    this.netStretch += this.netVelocity * dt;
    this.wobble = Math.max(0, this.wobble - dt * 1.5);
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

  drawPole(ctx) {
    const poleZ = this.boardZ + 0.35;
    const bottom = project(this.x, 0, poleZ);
    const top = project(this.x, this.boardBottom + 0.25, poleZ);
    const boardBack = project(this.x, this.boardBottom + 0.25, this.boardZ);
    if (!bottom || !top || !boardBack) return;

    ctx.strokeStyle = COLORS.pole;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.09 * top.scale;
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(boardBack.x, boardBack.y);
    ctx.stroke();
  }

  drawBoard(ctx) {
    const halfW = this.boardWidth / 2;
    const tl = project(this.x - halfW, this.boardTop, this.boardZ);
    const br = project(this.x + halfW, this.boardBottom, this.boardZ);
    if (!tl || !br) return;
    const s = tl.scale;
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const corner = 0.04 * s;

    // Glass
    ctx.fillStyle = COLORS.board;
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = Math.max(2, 0.035 * s);
    roundRect(ctx, tl.x, tl.y, w, h, corner);
    ctx.fill();
    ctx.stroke();

    // Shooter's square above the rim
    const sq = project(this.x - 0.3, this.rimY + 0.45, this.boardZ);
    const sqEnd = project(this.x + 0.3, this.rimY + 0.02, this.boardZ);
    ctx.lineWidth = Math.max(1.5, 0.028 * s);
    ctx.strokeRect(sq.x, sq.y, sqEnd.x - sq.x, sqEnd.y - sq.y);
  }

  /** The little metal arm joining the rim to the backboard. */
  drawBracket(ctx) {
    const a = project(this.x, this.rimY, this.z + this.radius);
    const b = project(this.x, this.rimY, this.boardZ);
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
    const center = project(this.x, this.rimY, this.z);
    const width = Math.max(2.5, this.tube * 2 * center.scale);

    ctx.beginPath();
    for (let i = 0; i <= RIM_SEGMENTS / 2; i++) {
      const a = start + (i / (RIM_SEGMENTS / 2)) * Math.PI;
      const p = project(this.x + Math.cos(a) * this.radius, this.rimY, this.z + Math.sin(a) * this.radius);
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
    const center = project(this.x, this.rimY, this.z);
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
          const pa = project(a.x, a.y, a.z);
          const pb = project(b.x, b.y, b.z);
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
