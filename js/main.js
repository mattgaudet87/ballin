/**
 * main.js
 * ---------------------------------------------------------------------------
 * The "conductor" of the game. It:
 *   1. sets up the canvas (sharp on Retina screens) and all the game objects
 *   2. runs the game-state machine: 'menu' → 'countdown' → 'playing' → 'gameover'
 *   3. runs the main loop ~60 times a second: update() then render()
 *   4. applies the game RULES: scoring, streaks, on fire, the timer
 *
 * The other modules each do one job (ball, hoop, physics, input, ui, audio,
 * effects, court) and main.js wires them together.
 */
import { CONFIG } from './config.js';
import { fitCamera, project } from './camera.js';
import { Ball } from './ball.js';
import { Hoop } from './hoop.js';
import { stepBall, aimShot } from './physics.js';
import { SwipeInput } from './input.js';
import { UI } from './ui.js';
import { SoundFX } from './audio.js';
import { Effects } from './effects.js';
import { drawCourt } from './court.js';
import { loadNumber, saveNumber } from './storage.js';

const G = CONFIG.game;
const PHYSICS_STEP = 1 / CONFIG.physics.stepsPerSecond;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const container = document.getElementById('game');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// The background is drawn once into this hidden canvas (see court.js)
const courtCanvas = document.createElement('canvas');
const courtCtx = courtCanvas.getContext('2d');

// Screen size in CSS pixels, plus the device pixel ratio (2 or 3 on Retina)
const view = { width: 0, height: 0, dpr: 1 };

const ball = new Ball();
const hoop = new Hoop();
const effects = new Effects();
const audio = new SoundFX();
const ui = new UI();

/** Everything about the current game session. */
const game = {
  state: 'menu', // 'menu' | 'countdown' | 'playing' | 'gameover'
  score: 0,
  streak: 0,
  bestStreak: 0,
  makes: 0,
  shots: 0,
  swishes: 0,
  best: loadNumber(CONFIG.storageKeys.best, 0),
  timeLeft: G.duration,
  countdown: 0,
  countdownShown: null,
  shotOutcome: null, // null while the ball is still "live", then 'make' | 'miss'
  resetTimer: 0,
};

const physicsEvents = [];
let physicsTime = 0; // leftover time not yet simulated

// ---------------------------------------------------------------------------
// Screen size & Retina
// ---------------------------------------------------------------------------

/**
 * Match the canvas to its on-screen size. On Retina screens we make the canvas
 * 2–3× bigger internally and scale the drawing up, so nothing looks blurry.
 */
function resize() {
  const rect = container.getBoundingClientRect();
  view.width = rect.width;
  view.height = rect.height;
  view.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);

  for (const c of [canvas, courtCanvas]) {
    c.width = Math.round(view.width * view.dpr);
    c.height = Math.round(view.height * view.dpr);
  }
  fitCamera(view.width, view.height);

  // Redraw the cached background at the new size
  courtCtx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawCourt(courtCtx, view.width, view.height);
}

window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Stop the page from scrolling, zooming or pull-to-refresh on iPhone
// ---------------------------------------------------------------------------

document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch-zoom
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Browsers only allow sound after a tap, so unlock audio on the first touch.
window.addEventListener('pointerdown', () => audio.unlock());

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

new SwipeInput(canvas, {
  // Swipes may start anywhere in the lower half, once the ball is ready.
  canStart: (x, y) =>
    game.state === 'playing' && game.timeLeft > 0 && ball.state === 'ready' && y > view.height * 0.5,
  onShoot: shoot,
});

ui.onPlay(startGame);
ui.onMute(() => ui.setMuted(audio.toggleMute()));
ui.setMuted(audio.muted);

/** Launch the ball based on the player's swipe. */
function shoot(swipe) {
  if (game.state !== 'playing' || ball.state !== 'ready') return;
  ball.launch(aimShot(swipe, ball, hoop));
  physicsTime = 0;
  game.shots++;
  game.shotOutcome = null;
  audio.whoosh();
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startGame() {
  audio.unlock();
  Object.assign(game, {
    state: 'countdown',
    score: 0,
    streak: 0,
    bestStreak: 0,
    makes: 0,
    shots: 0,
    swishes: 0,
    timeLeft: G.duration,
    countdown: G.countdownFrom,
    countdownShown: null,
    shotOutcome: null,
  });
  ball.reset();
  hoop.reset();
  effects.reset();
  ui.showGame();
}

function endGame() {
  game.state = 'gameover';
  const isNewBest = game.score > game.best;
  if (isNewBest) {
    game.best = game.score;
    saveNumber(CONFIG.storageKeys.best, game.best);
    setTimeout(() => audio.newBest(), 500);
  }
  ui.showGameOver({ ...game, isNewBest });
}

function isOnFire() {
  return game.state === 'playing' && game.streak >= G.fireStreak;
}

function updateCountdown(dt) {
  if (game.state !== 'countdown') return;
  game.countdown -= dt;
  const number = Math.ceil(game.countdown);
  if (number !== game.countdownShown) {
    game.countdownShown = number;
    if (number > 0) {
      ui.showCountdown(number);
      audio.beep();
    } else {
      ui.showCountdown('GO!');
      audio.beep(true);
      game.state = 'playing';
      setTimeout(() => ui.hideCountdown(), 600);
    }
  }
}

function updateTimer(dt) {
  if (game.state !== 'playing' || game.timeLeft <= 0) return;
  const before = game.timeLeft;
  game.timeLeft = Math.max(0, game.timeLeft - dt);

  // Tick every second during the last 5 seconds
  if (game.timeLeft > 0 && game.timeLeft <= 5 && Math.ceil(before) !== Math.ceil(game.timeLeft)) {
    audio.tick();
  }
  if (game.timeLeft === 0) {
    audio.buzzer();
    // A shot already in the air still counts (buzzer beater!); we end the
    // game when it lands instead — see finishShot().
    if (ball.state !== 'flying') endGame();
  }
}

// ---------------------------------------------------------------------------
// Shots: making, missing and resetting
// ---------------------------------------------------------------------------

function updateShot(dt) {
  if (ball.state !== 'flying') return;

  // Run the physics in small fixed steps for accurate bounces.
  physicsTime += dt;
  while (physicsTime >= PHYSICS_STEP) {
    stepBall(ball, hoop, PHYSICS_STEP, physicsEvents);
    physicsTime -= PHYSICS_STEP;
  }

  // React to whatever happened during those steps.
  for (const event of physicsEvents) {
    if (event.type === 'rim') {
      audio.rim(event.speed);
      hoop.onRimHit(event.speed);
    } else if (event.type === 'board') {
      audio.board(event.speed);
    } else if (event.type === 'floor' || event.type === 'wall') {
      audio.bounce(event.speed);
    } else if (event.type === 'score') {
      onMake(event.swish);
    }
  }
  physicsEvents.length = 0;

  // Decide if the shot is over.
  if (game.shotOutcome === null) {
    const belowRimFalling = ball.y < hoop.rimY - 0.3 && ball.vy < 0 && ball.flightTime > 0.3;
    const lost = ball.flightTime > G.maxShotTime || Math.abs(ball.x) > 6;
    if (belowRimFalling || lost) onMiss();
  } else {
    game.resetTimer -= dt;
    if (game.resetTimer <= 0) finishShot();
  }
}

function onMake(swish) {
  game.shotOutcome = 'make';
  game.resetTimer = G.resetAfterMake;
  game.makes++;
  game.streak++;
  game.bestStreak = Math.max(game.bestStreak, game.streak);

  // Points: base + swish bonus, doubled (or more) while on fire
  let points = G.pointsPerMake + (swish ? G.swishBonus : 0);
  if (game.streak >= G.fireStreak) points *= G.fireMultiplier;
  const scoreBefore = game.score;
  game.score += points;

  // Feedback
  const rim = project(hoop.x, hoop.rimY, hoop.z);
  const onFireNow = game.streak >= G.fireStreak;
  effects.floatText(rim.x, rim.y - 40, `+${points}`, { color: onFireNow ? '#ffd23f' : '#ffffff', size: 40 });
  effects.burst(rim.x, rim.y + 20, onFireNow ? ['#ffd23f', '#ff7a1a', '#ff3d1a'] : ['#ffffff', '#ff7a1a', '#7aa2ff'], 18);
  hoop.onScore(swish ? 1.3 : 1);
  audio.score(game.streak);

  if (swish) {
    game.swishes++;
    audio.swish();
    effects.floatText(rim.x, rim.y - 85, 'SWISH!', { color: '#7ee8ff', size: 30 });
  }
  if (game.streak === G.fireStreak) {
    audio.fire();
    effects.shake(8);
    effects.floatText(view.width / 2, view.height * 0.5, 'ON FIRE!', { color: '#ff8a1f', size: 54, life: 1.4 });
  }
  if (scoreBefore < G.movingHoopScore && game.score >= G.movingHoopScore) {
    effects.floatText(view.width / 2, view.height * 0.58, 'HOOP ON THE MOVE!', { color: '#7aa2ff', size: 26, life: 1.6 });
  }
}

function onMiss() {
  game.shotOutcome = 'miss';
  game.resetTimer = G.resetAfterMiss;
  if (game.streak >= G.fireStreak) {
    effects.floatText(view.width / 2, view.height * 0.5, 'FIRE’S OUT', { color: '#9aa7c7', size: 30 });
  }
  game.streak = 0;
}

/** The shot is done: bring out a fresh ball (or end the game if time ran out). */
function finishShot() {
  ball.reset();
  game.shotOutcome = null;
  if (game.state === 'playing' && game.timeLeft <= 0) endGame();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function update(dt) {
  updateCountdown(dt);
  updateTimer(dt);
  hoop.update(dt, game.score, game.state === 'playing');
  ball.update(dt);
  updateShot(dt);

  // Flames behind the ball while on fire
  if (isOnFire()) {
    const s = ball.screenPosition(performance.now() / 1000);
    if (s) effects.fireTrail(s.x, s.y, s.r);
  }
  effects.update(dt);

  if (game.state === 'playing') {
    ui.updateHUD({ score: game.score, timeLeft: game.timeLeft, streak: game.streak, best: game.best, onFire: isOnFire() });
  }
  ui.setHint(game.state === 'playing' && game.shots === 0 && ball.state === 'ready');
}

/**
 * Which layer should the ball be drawn on? Painting order fakes 3D depth:
 *  - 'behindBoard': flew past the backboard → draw ball first
 *  - 'insideHoop':  past the front of the rim → between the back and front of the hoop
 *  - 'front':       in front of the hoop → draw ball last
 */
function ballLayer() {
  if (ball.z > hoop.boardZ) return 'behindBoard';
  const dx = ball.x - hoop.x;
  const rimFrontZ = Math.abs(dx) < hoop.radius ? hoop.z - Math.sqrt(hoop.radius ** 2 - dx * dx) : hoop.z;
  return ball.z > rimFrontZ ? 'insideHoop' : 'front';
}

function render(time) {
  const { width, height, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#070b18';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  const [shakeX, shakeY] = effects.getShake();
  ctx.translate(shakeX, shakeY);

  ctx.drawImage(courtCanvas, 0, 0, width, height);
  ball.drawShadow(ctx);

  const onFire = isOnFire();
  const drawBall = () => {
    effects.drawFlames(ctx);
    ball.draw(ctx, time, onFire);
  };
  const layer = ballLayer();
  if (layer === 'behindBoard') {
    drawBall();
    hoop.drawBack(ctx);
    hoop.drawFront(ctx);
  } else if (layer === 'insideHoop') {
    hoop.drawBack(ctx);
    drawBall();
    hoop.drawFront(ctx);
  } else {
    hoop.drawBack(ctx);
    hoop.drawFront(ctx);
    drawBall();
  }

  effects.draw(ctx);
  ctx.restore();

  if (onFire) effects.drawFireGlow(ctx, width, height, time);
}

let lastTime = performance.now();

function frame(now) {
  // Time since the last frame, capped so a hiccup (or a hidden tab) can't
  // make the ball teleport.
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}

ui.showStart(game.best);
requestAnimationFrame(frame);

// Handy for debugging in the browser console: window.ballin.game.score = 9
window.ballin = { game, ball, hoop, CONFIG };
