/**
 * input.js
 * ---------------------------------------------------------------------------
 * Turns finger swipes (iPhone) and mouse drags (Mac) into shots.
 *
 * We use "pointer events", which handle touch AND mouse with the same code.
 * When a swipe ends we call onShoot({ dx, dy, speed }):
 *   dx, dy — the swipe direction in pixels (dy is negative for "up")
 *   speed  — how fast the END of the swipe was moving, in screen-heights
 *            per second (so it feels the same on every screen size)
 */
import { CONFIG } from './config.js';

export class SwipeInput {
  /**
   * @param {HTMLElement} element  the canvas to listen on
   * @param {object} handlers
   *   canStart(x, y) → true if a swipe may begin here right now
   *   onShoot(swipe) → called when a valid swipe finishes
   */
  constructor(element, { canStart, onShoot }) {
    this.el = element;
    this.canStart = canStart;
    this.onShoot = onShoot;
    this.pointerId = null;
    this.points = []; // recent { x, y, t } samples of the current swipe
    this.start = null;

    element.addEventListener('pointerdown', (e) => this.handleDown(e));
    element.addEventListener('pointermove', (e) => this.handleMove(e));
    element.addEventListener('pointerup', (e) => this.handleUp(e));
    element.addEventListener('pointercancel', () => this.cancel());
  }

  get active() {
    return this.pointerId !== null;
  }

  /** Convert a pointer event into a point relative to the canvas. */
  toPoint(e) {
    const rect = this.el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp };
  }

  handleDown(e) {
    e.preventDefault();
    if (this.active) return;
    const p = this.toPoint(e);
    if (!this.canStart(p.x, p.y)) return;

    this.pointerId = e.pointerId;
    this.start = p;
    this.points = [p];
    try {
      this.el.setPointerCapture(e.pointerId); // keep getting events even off the canvas
    } catch {
      // Not supported for this pointer — the swipe still works without it.
    }
  }

  handleMove(e) {
    if (e.pointerId !== this.pointerId) return;
    const p = this.toPoint(e);
    this.points.push(p);

    // Only keep the last ~300ms of samples (plenty for measuring speed)
    while (this.points.length > 2 && p.t - this.points[0].t > 300) this.points.shift();

    // Dragging far enough up the screen fires the shot automatically
    const height = this.el.clientHeight;
    if (this.start.y - p.y > height * CONFIG.shot.autoReleaseFraction) this.release();
  }

  handleUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.points.push(this.toPoint(e));
    this.release();
  }

  cancel() {
    this.pointerId = null;
    this.points = [];
  }

  /** The swipe is finished: measure it and (maybe) shoot. */
  release() {
    const S = CONFIG.shot;
    const start = this.start;
    const end = this.points[this.points.length - 1];
    const points = this.points;
    this.cancel();

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (-dy < S.minSwipePx) return; // too short, or not upward

    // Speed = distance covered during the last few milliseconds of the swipe
    let ref = points[0];
    for (let i = points.length - 1; i >= 0; i--) {
      ref = points[i];
      if (end.t - points[i].t >= S.speedWindowMs) break;
    }
    let dist = Math.hypot(end.x - ref.x, end.y - ref.y);
    let ms = end.t - ref.t;
    if (ms < 16) {
      // Not enough samples: fall back to the whole swipe
      dist = Math.hypot(dx, dy);
      ms = Math.max(16, end.t - start.t);
    }
    const speed = dist / (ms / 1000) / this.el.clientHeight;

    this.onShoot({ dx, dy, speed });
  }
}
