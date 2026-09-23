/**
 * court.js
 * ---------------------------------------------------------------------------
 * Draws the background: back wall, spotlight and floor with court lines.
 *
 * The background never changes during play, so main.js draws it ONCE into a
 * hidden canvas whenever the screen size changes, then copies that image
 * every frame. That's much faster than redrawing all the gradients each time.
 */
import { CONFIG } from './config.js';
import { project } from './camera.js';

export function drawCourt(ctx, width, height) {
  const wallZ = CONFIG.court.wallZ;
  const hoopZ = CONFIG.hoop.z;

  // Where the floor meets the back wall on screen
  const floorLine = project(0, 0, wallZ).y;
  const rim = project(0, CONFIG.hoop.rimY, hoopZ);

  // --- Back wall -----------------------------------------------------------
  const wall = ctx.createLinearGradient(0, 0, 0, floorLine);
  wall.addColorStop(0, '#070b18');
  wall.addColorStop(1, '#16203d');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, floorLine);

  // Spotlight glow behind the hoop
  const glow = ctx.createRadialGradient(rim.x, rim.y - height * 0.05, 0, rim.x, rim.y, height * 0.55);
  glow.addColorStop(0, 'rgba(120, 140, 255, 0.28)');
  glow.addColorStop(0.5, 'rgba(90, 80, 220, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, floorLine);

  // --- Floor ---------------------------------------------------------------
  const floor = ctx.createLinearGradient(0, floorLine, 0, height);
  floor.addColorStop(0, '#1f1a2e');
  floor.addColorStop(1, '#0c0f1c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorLine, width, height - floorLine);

  // Soft reflection of the spotlight on the floor
  const shine = ctx.createRadialGradient(rim.x, floorLine, 0, rim.x, floorLine, width * 0.7);
  shine.addColorStop(0, 'rgba(255, 120, 60, 0.18)');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, floorLine, width, height - floorLine);

  // --- Court lines (drawn in 3D so they have perspective) -------------------
  ctx.strokeStyle = 'rgba(255, 107, 26, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Baseline along the wall
  line3D(ctx, -6, wallZ, 6, wallZ);
  // Sides of the painted lane
  line3D(ctx, -0.95, wallZ, -0.95, 1.5);
  line3D(ctx, 0.95, wallZ, 0.95, 1.5);

  // Small arc under the hoop
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI + (i / 32) * Math.PI;
    const p = project(Math.cos(a) * 0.9, 0, hoopZ + Math.sin(a) * 0.9);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // --- Vignette (darker edges pull the eye to the center) -------------------
  const vignette = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.25, width / 2, height * 0.45, height * 0.8);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Draw a straight line on the floor between two (x, z) points. */
function line3D(ctx, x1, z1, x2, z2) {
  const a = project(x1, 0, z1);
  const b = project(x2, 0, z2);
  if (!a || !b) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
