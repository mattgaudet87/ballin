/**
 * camera.js
 * ---------------------------------------------------------------------------
 * Turns 3D world positions (x, y, z in meters) into 2D screen positions.
 *
 * This is what makes the game feel 3D: things further away (bigger z) are
 * drawn smaller and closer to the "horizon". The math is a simple pinhole
 * camera:  screen = center + worldOffset * (focal / depth)
 */
import { CONFIG } from './config.js';

// Shared camera state. fitCamera() fills in the screen-dependent values.
export const camera = {
  x: 0,
  y: CONFIG.camera.y,
  z: CONFIG.camera.z,
  focal: 1, // zoom factor (pixels per meter at 1 meter of depth)
  horizonY: 0, // screen y that is level with the camera's eyes
  centerX: 0, // screen x straight ahead of the camera
  hoopZ: 3, // where the hoop is (for projectHoop)
};

/**
 * Recalculate the camera for a new screen size (or hoop distance). We solve
 * for the zoom and the horizon so that the resting ball and the rim always
 * land on the same fraction of the screen, no matter the device. A closer
 * hoop therefore makes everything look bigger.
 */
export function fitCamera(width, height, hoopZ) {
  const cam = CONFIG.camera;
  const ballDepth = CONFIG.ball.startZ - camera.z;
  const rimDepth = hoopZ - camera.z;

  // How far below the eye line each object is, per unit of focal length
  const ballDrop = (camera.y - CONFIG.ball.startY) / ballDepth;
  const rimDrop = (camera.y - CONFIG.hoop.rimY) / rimDepth;

  camera.focal = ((cam.ballScreenY - cam.rimScreenY) * height) / (ballDrop - rimDrop);
  camera.horizonY = cam.ballScreenY * height - ballDrop * camera.focal;
  camera.centerX = width / 2;
  camera.hoopZ = hoopZ;
}

/**
 * Project a 3D point to the screen.
 * Returns { x, y, scale } where scale = pixels per meter at that depth,
 * or null if the point is behind the camera.
 */
export function project(x, y, z) {
  const depth = z - camera.z;
  if (depth < 0.1) return null;
  const scale = camera.focal / depth;
  return {
    x: camera.centerX + (x - camera.x) * scale,
    y: camera.horizonY + (camera.y - y) * scale,
    scale,
  };
}

/**
 * Like project(), but for things drawn near the hoop: the rim, net, backboard
 * and the ball when it gets there. Near the hoop everything is flattened onto
 * the rim's depth and tilted as if seen from slightly above, so the rim looks
 * like a nice flat oval instead of tipping up at the low camera. Far from the
 * hoop (the ball at your feet) it's exactly project(). See CONFIG.camera.hoopViewTilt.
 * Physics never uses this; it's only how things are drawn.
 */
export function projectHoop(x, y, z) {
  const p = project(x, y, z);
  const cam = CONFIG.camera;
  // 0 = normal view … 1 = full hoop view (starts hoopViewBlend meters before the rim)
  const start = camera.hoopZ - CONFIG.hoop.rimRadius - cam.hoopViewBlend;
  const w = Math.max(0, Math.min(1, (z - start) / cam.hoopViewBlend));
  if (!p || w === 0) return p;

  const flat = project(x, y, camera.hoopZ);
  const tiltedY = flat.y - (z - camera.hoopZ) * flat.scale * cam.hoopViewTilt; // further back = higher up
  return {
    x: p.x + (flat.x - p.x) * w,
    y: p.y + (tiltedY - p.y) * w,
    scale: p.scale + (flat.scale - p.scale) * w,
  };
}

/** The reverse of project() for x only: which world x is at this screen x, at depth z? */
export function unprojectX(screenX, z) {
  const scale = camera.focal / (z - camera.z);
  return camera.x + (screenX - camera.centerX) / scale;
}
