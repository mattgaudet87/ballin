/**
 * physics.js
 * ---------------------------------------------------------------------------
 * Everything about how the ball MOVES:
 *   - aimShot():     turns a player's swipe into a launch velocity
 *   - stepBall():    moves the ball forward a tiny slice of time, applying
 *                    gravity and bouncing it off the rim, backboard, floor
 *                    and wall. It also detects made baskets.
 *
 * stepBall() doesn't play sounds or change the score itself. Instead it pushes
 * "events" (like { type: 'rim' } or { type: 'score' }) into a list, and
 * main.js decides what to do with them. This keeps physics separate from
 * game rules, which makes both easier to change.
 */
import { CONFIG } from './config.js';
import { project, unprojectX } from './camera.js';

const P = CONFIG.physics;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------

/**
 * Work out the launch velocity needed to go from `start` to `target`,
 * peaking at height `apexY` on the way.
 */
export function computeLaunch(start, target, apexY) {
  const g = CONFIG.gravity;
  const apex = Math.max(apexY, start.y + 0.2, target.y + 0.2);
  const vy = Math.sqrt(2 * g * (apex - start.y)); // speed needed to reach the apex
  const timeUp = vy / g;
  const timeDown = Math.sqrt((2 * (apex - target.y)) / g);
  const flightTime = timeUp + timeDown;
  return {
    vx: (target.x - start.x) / flightTime,
    vy,
    vz: (target.z - start.z) / flightTime,
  };
}

/**
 * Convert a swipe into a launch velocity.
 * swipe = { dx, dy, speed } where dx/dy is the swipe direction in pixels
 * and speed is measured in screen-heights per second.
 */
export function aimShot(swipe, ball, hoop, difficulty) {
  const S = CONFIG.shot;

  // 1) POWER — how fast the swipe was compared to a "perfect" swipe.
  //    1.0 = lands exactly at the hoop, less = short, more = long.
  //    On Easy/Normal power doesn't matter: every shot is the right distance.
  let power = 1;
  if (difficulty.powerMatters) {
    const raw = swipe.speed / S.perfectSwipeSpeed;
    power = clamp(1 + (raw - 1) * S.powerForgiveness, S.minPower, S.maxPower);
  }

  // 2) DIRECTION — extend the swipe line up the screen until it reaches the
  //    rim's height, then ask the camera which world x is at that spot.
  const ballScreen = project(ball.x, ball.y, ball.z);
  const rimScreen = project(hoop.x, hoop.rimY, hoop.z);
  const sidewaysPerUp = swipe.dx / -swipe.dy;
  const aimScreenX = ballScreen.x + sidewaysPerUp * (ballScreen.y - rimScreen.y);
  let aimX = unprojectX(aimScreenX, hoop.z);

  // 3) AIM ASSIST — shrink small misses so close swipes feel good.
  const miss = aimX - hoop.x;
  const help = difficulty.aimAssist * Math.max(0, 1 - Math.abs(miss) / S.aimAssistRange);
  aimX = hoop.x + miss * (1 - help);

  // 4) The target is the rim, pulled closer or pushed further by power.
  const target = {
    x: ball.x + (aimX - ball.x) * power,
    y: hoop.rimY,
    z: ball.z + (hoop.z - ball.z) * power,
  };
  const apex = difficulty.apexY + (power - 1) * S.apexPowerGain;
  return computeLaunch(ball, target, apex);
}

// ---------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------

/**
 * Bounce the ball off a surface. (nx, ny, nz) is the surface "normal": a
 * length-1 arrow pointing from the surface toward the ball.
 * Returns the impact speed (0 if the ball was already moving away).
 */
function bounce(ball, nx, ny, nz, restitution) {
  const vn = ball.vx * nx + ball.vy * ny + ball.vz * nz; // speed toward the surface
  if (vn >= 0) return 0;

  // Split velocity into "into the surface" and "along the surface" parts.
  const tx = ball.vx - vn * nx;
  const ty = ball.vy - vn * ny;
  const tz = ball.vz - vn * nz;

  // Reverse (and shrink) the "into" part; slow the "along" part with friction.
  ball.vx = tx * P.friction - vn * restitution * nx;
  ball.vy = ty * P.friction - vn * restitution * ny;
  ball.vz = tz * P.friction - vn * restitution * nz;
  return -vn;
}

/**
 * If the ball overlaps the point (px, py, pz) closer than `minDist`, push it
 * out and bounce. Used for both the rim and the backboard.
 */
function collideWithPoint(ball, px, py, pz, minDist, restitution) {
  let nx = ball.x - px;
  let ny = ball.y - py;
  let nz = ball.z - pz;
  const dist = Math.hypot(nx, ny, nz);
  if (dist >= minDist) return 0;

  if (dist < 1e-6) {
    // Dead center (very rare): push straight toward the player.
    nx = 0; ny = 0; nz = -1;
  } else {
    nx /= dist; ny /= dist; nz /= dist;
  }
  const push = minDist - dist;
  ball.x += nx * push;
  ball.y += ny * push;
  ball.z += nz * push;
  return bounce(ball, nx, ny, nz, restitution);
}

/** The rim is a ring (a donut). Find the closest point on the ring and collide with it. */
function collideRim(ball, hoop) {
  const dx = ball.x - hoop.x;
  const dz = ball.z - hoop.z;
  const flat = Math.hypot(dx, dz) || 1e-6;
  const px = hoop.x + (dx / flat) * hoop.radius;
  const pz = hoop.z + (dz / flat) * hoop.radius;
  return collideWithPoint(ball, px, hoop.rimY, pz, ball.radius + hoop.tube, P.rimBounce);
}

/** The backboard is a thin box. Find the closest point on the box and collide with it. */
function collideBoard(ball, hoop) {
  const halfW = hoop.boardWidth / 2;
  const px = clamp(ball.x, hoop.x - halfW, hoop.x + halfW);
  const py = clamp(ball.y, hoop.boardBottom, hoop.boardTop);
  const pz = clamp(ball.z, hoop.boardZ, hoop.boardZ + hoop.boardThickness);
  return collideWithPoint(ball, px, py, pz, ball.radius, P.boardBounce);
}

// ---------------------------------------------------------------------------
// The main physics step
// ---------------------------------------------------------------------------

/**
 * Move the ball forward by `dt` seconds. Anything interesting that happens
 * is pushed into the `events` array for main.js to react to.
 */
export function stepBall(ball, hoop, dt, events) {
  const r = ball.radius;
  const prevY = ball.y;

  // Gravity, then move.
  ball.vy -= CONFIG.gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  // Rim
  const rimHit = collideRim(ball, hoop);
  if (rimHit > 0) {
    ball.touchedRim = true;
    events.push({ type: 'rim', speed: rimHit });
  }

  // Backboard
  const boardHit = collideBoard(ball, hoop);
  if (boardHit > 0) {
    ball.touchedBoard = true;
    events.push({ type: 'board', speed: boardHit });
  }

  // Net: slow the ball down and guide it toward the middle while it's inside.
  const flatDist = Math.hypot(ball.x - hoop.x, ball.z - hoop.z);
  const inNet = ball.y < hoop.rimY && ball.y > hoop.rimY - hoop.netLength && flatDist < hoop.radius;
  if (inNet) {
    const drag = Math.min(1, P.netDrag * dt);
    ball.vx *= 1 - drag;
    ball.vz *= 1 - drag;
    ball.vy *= 1 - drag * 0.4;
    ball.vx += (hoop.x - ball.x) * 4 * dt;
    ball.vz += (hoop.z - ball.z) * 4 * dt;
  }

  // Floor
  if (ball.y - r < 0) {
    ball.y = r;
    const hit = bounce(ball, 0, 1, 0, P.floorBounce);
    if (hit > 0.3) events.push({ type: 'floor', speed: hit });
  }

  // Back wall
  if (ball.z + r > hoop.wallZ) {
    ball.z = hoop.wallZ - r;
    const hit = bounce(ball, 0, 0, -1, P.wallBounce);
    if (hit > 0.3) events.push({ type: 'wall', speed: hit });
  }

  // SCORING: the ball's center must cross the rim's height going DOWN while
  // inside the ring. If it ever comes UP through the ring, it can't count.
  if (!ball.scored && flatDist < hoop.radius) {
    if (prevY >= hoop.rimY && ball.y < hoop.rimY) {
      if (!ball.enteredFromBelow) {
        ball.scored = true;
        events.push({ type: 'score', swish: !ball.touchedRim && !ball.touchedBoard });
      }
    } else if (prevY < hoop.rimY && ball.y >= hoop.rimY) {
      ball.enteredFromBelow = true;
    }
  }
}
