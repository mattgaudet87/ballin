/**
 * ball.js
 * ---------------------------------------------------------------------------
 * The basketball: its position, velocity, spin, and how to draw it.
 * (How it MOVES lives in physics.js.)
 *
 * Ball states:
 *   'ready'  — resting at the bottom, waiting for a swipe
 *   'flying' — in the air after a shot
 */
import { CONFIG } from './config.js';
import { project } from './camera.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Seam shapes
// The black lines on a basketball are circles drawn on the ball's surface.
// We build them once as 3D points on a sphere of radius 1, then rotate them
// every frame so the ball visibly spins.
// ---------------------------------------------------------------------------

/** A great circle (a seam that goes all the way round) around the x or y axis. */
function greatCircle(axis, samples = 56) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    if (axis === 'x') points.push([0, c, s]);
    else points.push([c, 0, s]);
  }
  return points;
}

/**
 * A curved seam looping around the left (side = -1) or right (side = 1) pole.
 * Its distance from the pole changes around the loop, which gives the classic
 * ( | ) basketball look.
 */
function curvedSeam(side, samples = 56) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * TAU;
    const fromPole = 0.95 + 0.3 * Math.cos(2 * t);
    const ring = Math.sin(fromPole);
    points.push([side * Math.cos(fromPole), ring * Math.cos(t), ring * Math.sin(t)]);
  }
  return points;
}

const SEAMS = [greatCircle('x'), greatCircle('y'), curvedSeam(1), curvedSeam(-1)];
const VIEW_YAW = 0.4; // turn the ball a little so the seams look 3D

/** Colors for the normal ball and the specialty balls: [highlight, middle, edge]. */
const SKINS = {
  normal: ['#ffae63', '#f2711c', '#a8420b'],
  fire: ['#ffd07a', '#ff7a1a', '#a8420b'],
  gold: ['#fff4b0', '#ffc928', '#9a6a00'],
  silver: ['#ffffff', '#c9d2de', '#5d6878'],
  bronze: ['#ffd2a8', '#c97a3d', '#6b3814'],
};

/** Ease-out with a small overshoot, used for the "pop in" animation. */
function easeOutBack(t) {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export class Ball {
  constructor() {
    this.radius = CONFIG.ball.radius;
    this.reset();
  }

  /**
   * Put the ball back at the bottom, ready for the next shot.
   * `x` lets main.js place it somewhere other than the center.
   */
  reset(x = CONFIG.ball.startX) {
    const B = CONFIG.ball;
    this.x = x;
    this.y = B.startY;
    this.z = B.startZ;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.state = 'ready';
    this.spin = -0.5; // current rotation angle
    this.spinSpeed = 0;
    this.spawn = 0; // 0 → 1 "pop in" animation progress
    this.flightTime = 0;
    this.skin = null; // 'gold' | 'silver' | 'bronze' | null (set by main.js)

    // Per-shot flags used for scoring
    this.touchedRim = false;
    this.touchedBoard = false;
    this.scored = false;
    this.enteredFromBelow = false;
  }

  /** Send the ball flying with velocity { vx, vy, vz }. */
  launch(velocity) {
    this.vx = velocity.vx;
    this.vy = velocity.vy;
    this.vz = velocity.vz;
    this.spinSpeed = CONFIG.ball.backspin;
    this.state = 'flying';
    this.flightTime = 0;
  }

  update(dt) {
    this.spin += this.spinSpeed * dt;
    this.spawn = Math.min(1, this.spawn + dt * 3.5);
    if (this.state === 'flying') this.flightTime += dt;
  }

  /** Where the ball is on screen right now (includes the idle bob). */
  screenPosition(time) {
    const p = project(this.x, this.y, this.z);
    if (!p) return null;
    let r = this.radius * p.scale;
    let y = p.y;
    if (this.state === 'ready') {
      y += Math.sin(time * 2.6) * r * 0.06; // gentle floating bob
      r *= easeOutBack(this.spawn);
    }
    return { x: p.x, y, r };
  }

  /** A soft shadow on the floor under the ball. */
  drawShadow(ctx) {
    const p = project(this.x, 0, this.z);
    if (!p) return;
    const heightFade = Math.max(0, 1 - this.y / 5);
    const w = this.radius * p.scale * 1.3;
    ctx.save();
    ctx.globalAlpha = 0.45 * heightFade;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w, w * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx, time, onFire) {
    const s = this.screenPosition(time);
    if (!s || s.r < 0.5) return;
    const r = s.r;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Glow when on fire, or shimmer when it's a specialty ball
    if (this.skin) {
      ctx.shadowColor = SKINS[this.skin][1];
      ctx.shadowBlur = r * (0.6 + Math.sin(time * 6) * 0.2);
    } else if (onFire) {
      ctx.shadowColor = 'rgba(255, 120, 20, 0.95)';
      ctx.shadowBlur = r * 0.9;
    }

    // Base orange ball with a light-to-dark gradient for a round look
    const base = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    const [light, mid, edge] = SKINS[this.skin ?? (onFire ? 'fire' : 'normal')];
    base.addColorStop(0, light);
    base.addColorStop(0.55, mid);
    base.addColorStop(1, edge);
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Seams (clipped to the ball)
    ctx.save();
    ctx.clip();
    ctx.rotate(Math.max(-0.5, Math.min(0.5, this.vx * 0.08))); // lean with sideways motion
    this.drawSeams(ctx, r);
    ctx.restore();

    // Edge shading + a small shine on top for depth
    const shade = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
    shade.addColorStop(0, 'rgba(255,255,255,0.18)');
    shade.addColorStop(0.6, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /** Rotate the 3D seam circles by the current spin and draw the visible half. */
  drawSeams(ctx, r) {
    const cs = Math.cos(this.spin);
    const ss = Math.sin(this.spin);
    const cy = Math.cos(VIEW_YAW);
    const sy = Math.sin(VIEW_YAW);

    ctx.strokeStyle = 'rgba(45, 20, 6, 0.9)';
    ctx.lineWidth = Math.max(1, r * 0.075);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const seam of SEAMS) {
      let penDown = false;
      for (const [x0, y0, z0] of seam) {
        // Spin around the x axis (backspin)...
        const y1 = y0 * cs - z0 * ss;
        const z1 = y0 * ss + z0 * cs;
        // ...then turn slightly around the y axis
        const x2 = x0 * cy + z1 * sy;
        const z2 = -x0 * sy + z1 * cy;
        // Only draw the side facing the camera (negative z)
        if (z2 < 0.05) {
          if (penDown) ctx.lineTo(x2 * r, -y1 * r);
          else ctx.moveTo(x2 * r, -y1 * r);
          penDown = true;
        } else {
          penDown = false;
        }
      }
    }
    ctx.stroke();
  }
}
