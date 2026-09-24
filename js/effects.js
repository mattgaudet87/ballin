/**
 * effects.js
 * ---------------------------------------------------------------------------
 * Eye candy that doesn't affect gameplay:
 *   - particles (confetti bursts, fire trail)
 *   - floating text ("+2", "SWISH!", "ON FIRE!")
 *
 * No screen flash, screen shake or pulsing fire glow — the game stays calm
 * and low-stim on purpose, with no setting to turn that off.
 *
 * Everything here works in SCREEN pixels, not world meters.
 */

import { FX, FX_FONT } from './config.js';

const TAU = Math.PI * 2;
const TEXT_FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const FIRE_COLORS = ['#fff1a8', '#ffd23f', '#ff9a1f', '#ff5a1a'];
const random = (min, max) => min + Math.random() * (max - min);

export class Effects {
  constructor() {
    this.particles = [];
    this.flames = []; // kept separate so they can be drawn BEHIND the ball
    this.texts = [];
    this.rings = []; // FX: shockwave rings at the rim on a make
    this.grain = null; // FX: film grain tile, made on first use
  }

  /** FX: fast glowing sparks that draw as streaks. */
  sparks(x, y, colors, count = 24, speed = 520) {
    for (let i = 0; i < count; i++) {
      const angle = random(-Math.PI, 0) + random(-0.3, 0.3);
      const v = random(speed * 0.35, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        gravity: 900,
        size: random(1.5, 3),
        color: colors[i % colors.length],
        life: 0,
        maxLife: random(0.35, 0.7),
        glow: true,
        streak: true,
      });
    }
  }

  /** FX: an expanding ring around the rim. rx = rim radius in pixels. */
  ring(x, y, rx, color = '#ffd23f') {
    this.rings.push({ x, y, rx, color, life: 0, maxLife: 0.45 });
  }

  /** Clear everything (new game). */
  reset() {
    this.particles.length = 0;
    this.flames.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
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
        rot: random(0, TAU),
        vr: random(-14, 14),
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

  update(dt) {
    for (const p of [...this.particles, ...this.flames]) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.maxLife);
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    this.flames = this.flames.filter((p) => p.life < p.maxLife);

    for (const t of this.texts) t.life += dt;
    this.texts = this.texts.filter((t) => t.life < t.maxLife);
  }

  /** Fire trail — main.js draws this just before the ball. */
  drawFlames(ctx) {
    this.drawParticles(ctx, this.flames);
  }

  /** Confetti and floating text — drawn on top of everything. */
  draw(ctx) {
    this.drawRings(ctx);
    this.drawParticles(ctx, this.particles);
    this.drawTexts(ctx);
  }

  drawParticles(ctx, list) {
    for (const p of list) {
      const k = 1 - p.life / p.maxLife; // 1 → 0 over its lifetime
      ctx.globalAlpha = k;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      if (p.streak) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * k + 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
        continue;
      }
      if (FX && !p.glow) {
        // Tumbling confetti strips instead of dots
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 1.7));
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        ctx.restore();
        continue;
      }
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
      ctx.font = FX
        ? `italic 900 ${Math.round(t.size * pop * 1.18)}px ${FX_FONT}`
        : `900 ${Math.round(t.size * pop)}px ${TEXT_FONT}`;
      const y = t.y - k * 50;
      ctx.lineWidth = Math.max(3, t.size * 0.14);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawRings(ctx) {
    for (const r of this.rings) {
      const k = r.life / r.maxLife;
      const grow = 1 + k * (FX ? 1.8 : 0.9);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5 + 7 * (1 - k);
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.rx * grow, r.rx * 0.28 * grow, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /**
   * FX: dust and big out-of-focus bokeh drifting through the lights. On fire it turns to embers.
   * `idleTint` is the dust's "r, g, b" (each court has its own, see court.js courtMote()).
   */
  drawMotes(ctx, width, height, time, onFire = false, idleTint = '255, 240, 220') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const speed = onFire ? 0.09 : 0.022;
    const tint = onFire ? '255, 150, 60' : idleTint;
    for (let i = 0; i < 70; i++) {
      const cycle = (time * speed * (0.7 + (i % 5) * 0.12) + ((i * 0.37) % 1)) % 1;
      const x = ((i * 0.618034) % 1) * width + Math.sin(time * 0.4 + i * 1.7) * 18;
      const y = height * 0.8 - cycle * height * 0.85;
      const fade = Math.sin(cycle * Math.PI);
      ctx.globalAlpha = fade * (onFire ? 0.9 : 0.6);
      ctx.fillStyle = `rgb(${tint})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + (i % 3) * 0.7, 0, TAU);
      ctx.fill();
    }
    // Bokeh: large soft discs, like dust right in front of the lens
    for (let i = 0; i < 9; i++) {
      const cycle = (time * 0.012 + i * 0.113) % 1;
      const x = ((i * 0.381966 + 0.1) % 1) * width + Math.sin(time * 0.25 + i) * 30;
      const y = height * (0.15 + ((i * 0.53) % 0.7)) - cycle * 40;
      const r = 10 + (i % 4) * 7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tint}, 0.22)`);
      g.addColorStop(0.7, `rgba(${tint}, 0.12)`);
      g.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.globalAlpha = Math.sin(cycle * Math.PI);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** FX: film grain. Drawn last, over everything. */
  drawPost(ctx, width, height) {
    if (!this.grain) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.grain = ctx.createPattern(c, 'repeat');
    }
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    ctx.translate(random(-64, 0), random(-64, 0));
    ctx.fillStyle = this.grain;
    ctx.fillRect(0, 0, width + 64, height + 64);
    ctx.restore();
  }
}
