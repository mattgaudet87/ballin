/**
 * effects.js
 * ---------------------------------------------------------------------------
 * Eye candy that doesn't affect gameplay:
 *   - particles (confetti bursts, fire trail)
 *   - floating text ("+2", "SWISH!", "ON FIRE!")
 *   - screen shake
 *   - the orange glow around the screen edges while on fire
 *
 * Everything here works in SCREEN pixels, not world meters.
 */

const TAU = Math.PI * 2;
const FIRE_COLORS = ['#fff1a8', '#ffd23f', '#ff9a1f', '#ff5a1a'];
const random = (min, max) => min + Math.random() * (max - min);

export class Effects {
  constructor() {
    this.particles = [];
    this.flames = []; // kept separate so they can be drawn BEHIND the ball
    this.texts = [];
    this.shakeAmount = 0;
  }

  /** Clear everything (new game). */
  reset() {
    this.particles.length = 0;
    this.flames.length = 0;
    this.texts.length = 0;
    this.shakeAmount = 0;
  }

  /** A burst of confetti-like particles flying outward. */
  burst(x, y, colors, count = 20, speed = 260) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, TAU);
      const v = random(speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.4,
        gravity: 600,
        size: random(3, 6),
        color: colors[i % colors.length],
        life: 0,
        maxLife: random(0.5, 0.9),
        glow: false,
      });
    }
  }

  /** Flames that trail behind the ball while on fire. */
  fireTrail(x, y, radius) {
    for (let i = 0; i < 2; i++) {
      this.flames.push({
        x: x + random(-radius, radius) * 0.7,
        y: y + random(-radius, radius) * 0.5,
        vx: random(-15, 15),
        vy: random(-140, -60),
        gravity: -80,
        size: radius * random(0.2, 0.45),
        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
        life: 0,
        maxLife: random(0.25, 0.45),
        glow: true,
      });
    }
  }

  /** Text that pops up, floats upward and fades out. */
  floatText(x, y, text, { color = '#ffffff', size = 32, life = 1.1 } = {}) {
    this.texts.push({ x, y, text, color, size, life: 0, maxLife: life });
  }

  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Current screen-shake offset in pixels. */
  getShake() {
    if (this.shakeAmount < 0.1) return [0, 0];
    return [random(-1, 1) * this.shakeAmount, random(-1, 1) * this.shakeAmount];
  }

  update(dt) {
    for (const p of [...this.particles, ...this.flames]) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    this.flames = this.flames.filter((p) => p.life < p.maxLife);

    for (const t of this.texts) t.life += dt;
    this.texts = this.texts.filter((t) => t.life < t.maxLife);

    this.shakeAmount *= Math.pow(0.001, dt); // fade the shake out quickly
  }

  /** Fire trail — main.js draws this just before the ball. */
  drawFlames(ctx) {
    this.drawParticles(ctx, this.flames);
  }

  /** Confetti and floating text — drawn on top of everything. */
  draw(ctx) {
    this.drawParticles(ctx, this.particles);
    this.drawTexts(ctx);
  }

  drawParticles(ctx, list) {
    for (const p of list) {
      const k = 1 - p.life / p.maxLife; // 1 → 0 over its lifetime
      ctx.globalAlpha = k;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * (p.glow ? k : 1)), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.maxLife; // 0 → 1
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.5);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `900 ${Math.round(t.size * pop)}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
      const y = t.y - k * 50;
      ctx.lineWidth = Math.max(3, t.size * 0.14);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Pulsing orange glow around the edges of the screen. */
  drawFireGlow(ctx, width, height, time) {
    const pulse = 0.28 + Math.sin(time * 6) * 0.07;
    const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(255, 90, 20, 0)');
    g.addColorStop(1, `rgba(255, 90, 20, ${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
