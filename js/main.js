/**
 * main.js
 * ---------------------------------------------------------------------------
 * The "conductor" of the game. It:
 *   1. sets up the canvas (sharp on Retina screens) and all the game objects
 *   2. runs the game-state machine: 'menu' → 'countdown' → 'playing' → 'gameover'
 *   3. runs the main loop ~60 times a second: update() then render()
 *   4. applies the game RULES: scoring, streaks, on fire, the clock, power-ups,
 *      basket multipliers and missions
 *
 * The other modules each do one job and main.js wires them together.
 * Mode rules live in modes.js, power-ups in items.js, missions in missions.js.
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
import { MODES, rollBasketMultiplier } from './modes.js';
import { Inventory, ITEMS, DRINK_EFFECTS } from './items.js';
import { Missions } from './missions.js';

const G = CONFIG.game;
const KEYS = CONFIG.storageKeys;
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
const inventory = new Inventory();
const missions = new Missions();

/** Everything about the current game session. */
const game = {
  state: 'menu', // 'menu' | 'countdown' | 'playing' | 'gameover'
  mode: MODES.blitz,
  best: loadBests(), // { blitz: 0, hothand: 0 }

  // Per-game stats (reset in startGame)
  score: 0,
  streak: 0,
  bestStreak: 0,
  makes: 0,
  shots: 0,
  swishes: 0,
  fireCount: 0,
  bankShots: 0,
  bigMultiplierMakes: 0,
  itemsUsed: 0,

  timeLeft: 0,
  countdown: 0,
  countdownShown: null,
  shotOutcome: null, // null while the ball is still "live", then 'make' | 'miss'
  resetTimer: 0,
  basketMultiplier: null, // Hot Hand bonus on the current basket, e.g. { value: 3, color }
  shot: null, // power-ups used by the ball in the air (from inventory.startShot())
};

const physicsEvents = [];
let physicsTime = 0; // leftover time not yet simulated

function loadBests() {
  const bests = {};
  for (const id of Object.keys(MODES)) bests[id] = loadNumber(KEYS.best + id, 0);
  // Keep the best score from before modes existed
  bests.blitz = Math.max(bests.blitz, loadNumber(KEYS.oldBest, 0));
  return bests;
}

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
// (menus marked with class="scroll" are still allowed to scroll)
// ---------------------------------------------------------------------------

document.addEventListener(
  'touchmove',
  (e) => {
    if (!e.target.closest?.('.scroll')) e.preventDefault();
  },
  { passive: false },
);
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
  canStart: (x, y) => game.state === 'playing' && !timeIsUp() && ball.state === 'ready' && y > view.height * 0.5,
  onShoot: shoot,
});

ui.onModeSelect(startGame);
ui.onPlayAgain(() => startGame(game.mode.id));
ui.onMenu(showMenu);
ui.onItem(useItem);
ui.onMute(() => ui.setMuted(audio.toggleMute()));
ui.setMuted(audio.muted);

/** Launch the ball based on the player's swipe. */
function shoot(swipe) {
  if (game.state !== 'playing' || ball.state !== 'ready') return;

  // Lock in the power-ups (and basket multiplier) for this shot
  game.shot = inventory.startShot();
  game.shot.basket = game.basketMultiplier;
  game.itemsUsed += game.shot.itemsUsed;

  ball.launch(aimShot(swipe, ball, hoop));
  physicsTime = 0;
  game.shots++;
  game.shotOutcome = null;
  audio.whoosh();
}

/** The player tapped a power-up in the in-game tray. */
function useItem(id) {
  if (game.state !== 'playing' && game.state !== 'countdown') return;
  const item = ITEMS[id];

  if (item.type === 'ball') {
    if (ball.state !== 'ready') return; // can't swap balls mid-flight
    inventory.toggleBall(id);
    ball.skin = inventory.selectedBall;
    if (ball.skin) audio.select();
  } else if (inventory.activateDrink(id)) {
    game.itemsUsed++;
    audio.powerUp();
    effects.floatText(view.width / 2, view.height * 0.55, item.name.toUpperCase(), { color: '#7ee8ff', size: 26 });
    effects.floatText(view.width / 2, view.height * 0.55 + 30, item.desc, { color: '#ffffff', size: 15, life: 1.4 });
  }
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function showMenu() {
  game.state = 'menu';
  newBall();
  ui.showMenu({
    bests: game.best,
    missions: missions.list.map((m) => ({ ...m, text: missions.describe(m) })),
    inventory,
  });
}

function startGame(modeId) {
  audio.unlock();
  Object.assign(game, {
    mode: MODES[modeId],
    state: 'countdown',
    score: 0,
    streak: 0,
    bestStreak: 0,
    makes: 0,
    shots: 0,
    swishes: 0,
    fireCount: 0,
    bankShots: 0,
    bigMultiplierMakes: 0,
    itemsUsed: 0,
    timeLeft: MODES[modeId].duration,
    countdown: G.countdownFrom,
    countdownShown: null,
    shotOutcome: null,
  });
  hoop.reset();
  effects.reset();
  newBall();
  ui.showGame();
}

function endGame() {
  const mode = game.mode;
  game.state = 'gameover';
  inventory.selectedBall = null; // unused balls go back in the locker

  const isNewBest = game.score > game.best[mode.id];
  if (isNewBest) {
    game.best[mode.id] = game.score;
    saveNumber(KEYS.best + mode.id, game.score);
    setTimeout(() => audio.newBest(), 500);
  }

  // Missions: record this game and pay out rewards for anything completed.
  const results = missions.applyGame(gameStats());
  const completed = results.filter((r) => r.completed);
  for (const r of completed) {
    for (const id of r.mission.reward) inventory.add(id);
  }
  if (completed.length) setTimeout(() => audio.missionComplete(), 1100);

  ui.showGameOver({
    ...game,
    title: mode.timed ? 'TIME’S UP' : `${mode.name.toUpperCase()} · MISSED`,
    best: game.best[mode.id],
    isNewBest,
    results,
  });
  newBall();
}

/** The numbers missions care about, for the game that just ended. */
function gameStats() {
  return {
    points: game.score,
    makes: game.makes,
    swishes: game.swishes,
    bestStreak: game.bestStreak,
    fireCount: game.fireCount,
    bankShots: game.bankShots,
    bigMultiplierMakes: game.bigMultiplierMakes,
    itemsUsed: game.itemsUsed,
    hotHandMakes: game.mode.id === 'hothand' ? game.makes : 0,
    blitzPoints: game.mode.id === 'blitz' ? game.score : 0,
    games: 1,
  };
}

function isOnFire() {
  return game.state === 'playing' && game.streak >= G.fireStreak;
}

function timeIsUp() {
  return game.mode.timed && game.timeLeft <= 0;
}

/** Bring out a fresh ball (random spot in a game, centered in menus). */
function newBall() {
  const inGame = game.state === 'playing' || game.state === 'countdown';
  const range = CONFIG.ball.startXRange;
  ball.reset(inGame ? (Math.random() * 2 - 1) * range : CONFIG.ball.startX);
  ball.skin = inGame ? inventory.selectedBall : null;
  game.shot = null;

  // Hot Hand: maybe put a multiplier on the next basket
  game.basketMultiplier = inGame && game.mode.basketMultipliers ? rollBasketMultiplier() : null;
  if (game.basketMultiplier?.value >= 5) audio.rareMultiplier();
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
  if (game.state !== 'playing' || !game.mode.timed || game.timeLeft <= 0) return;
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
// The hoop: movement and size
// ---------------------------------------------------------------------------

/**
 * Is a power-up effect on right now? While a ball is in the air we use the
 * power-ups it was shot with, so a boost can't run out mid-flight.
 */
function boostOn(effect) {
  if (game.state !== 'playing' && game.state !== 'countdown') return false;
  if (game.shot) return game.shot[effect];
  return effect === 'bigHoop' ? inventory.isActive('white') : inventory.isActive('orange');
}

/** How fast the hoop should slide, based on the mode's rules. */
function hoopSpeed() {
  if (game.state !== 'playing') return 0;
  const rule = game.mode.movingHoop;
  const value = game[rule.stat];
  if (value < rule.startAt) return 0;
  let speed = Math.min(G.hoopSpeedMax, rule.speedStart + (value - rule.startAt) * rule.speedPer);
  if (boostOn('slowHoop')) speed *= DRINK_EFFECTS.slowHoopFactor;
  return speed;
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
  const shot = game.shot ?? { ballMultiplier: 1, greenMultiplier: 1, basket: null, ball: null };
  const rule = game.mode.movingHoop;
  const hoopStatBefore = game[rule.stat];

  game.shotOutcome = 'make';
  game.resetTimer = G.resetAfterMake;
  game.makes++;
  game.streak++;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  if (ball.touchedBoard) game.bankShots++;
  if (game.streak === G.fireStreak) game.fireCount++;
  const onFireNow = game.streak >= G.fireStreak;

  // Points: base (+ swish bonus), then every multiplier stacks.
  // `labels` explains the bonus to the player under the "+points" text.
  const labels = [];
  let multiplier = 1;
  if (onFireNow) multiplier *= G.fireMultiplier;
  if (shot.basket) {
    multiplier *= shot.basket.value;
    labels.push({ text: `${shot.basket.value}× BASKET`, color: shot.basket.color });
    if (shot.basket.value >= 3) game.bigMultiplierMakes++;
  }
  if (shot.ball) {
    multiplier *= shot.ballMultiplier;
    labels.push({ text: `${ITEMS[shot.ball].name.toUpperCase()} ${shot.ballMultiplier}×`, color: '#ffd23f' });
  }
  if (shot.greenMultiplier > 1) {
    multiplier *= shot.greenMultiplier;
    labels.push({ text: `GREEN ${shot.greenMultiplier.toFixed(1)}×`, color: '#5ee05a' });
  }
  const points = Math.round((G.pointsPerMake + (swish ? G.swishBonus : 0)) * multiplier);
  game.score += points;

  // Feedback
  const rim = project(hoop.x, hoop.rimY, hoop.z);
  const big = multiplier >= 3;
  effects.floatText(rim.x, rim.y - 40, `+${points}`, { color: onFireNow || big ? '#ffd23f' : '#ffffff', size: big ? 52 : 40 });
  labels.forEach((label, i) => {
    effects.floatText(rim.x, rim.y + 30 + i * 24, label.text, { color: label.color, size: 18, life: 1.3 });
  });
  const colors = shot.basket ? [shot.basket.color, '#ffffff', '#ffd23f'] : onFireNow ? ['#ffd23f', '#ff7a1a', '#ff3d1a'] : ['#ffffff', '#ff7a1a', '#7aa2ff'];
  effects.burst(rim.x, rim.y + 20, colors, big ? 36 : 18);
  if (big) effects.shake(6);
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
  if (hoopStatBefore < rule.startAt && game[rule.stat] >= rule.startAt) {
    effects.floatText(view.width / 2, view.height * 0.58, 'HOOP ON THE MOVE!', { color: '#7aa2ff', size: 26, life: 1.6 });
  }
}

function onMiss() {
  game.shotOutcome = 'miss';
  game.resetTimer = G.resetAfterMiss;
  if (game.mode.endsOnMiss) {
    game.resetTimer += 0.4; // a beat longer so the miss sinks in
    effects.floatText(view.width / 2, view.height * 0.5, 'MISS', { color: '#ff5a5a', size: 54, life: 1.2 });
  } else if (game.streak >= G.fireStreak) {
    effects.floatText(view.width / 2, view.height * 0.5, 'FIRE’S OUT', { color: '#9aa7c7', size: 30 });
  }
  game.streak = 0;
}

/** The shot is done: bring out a fresh ball, or end the game. */
function finishShot() {
  const outcome = game.shotOutcome;
  game.shotOutcome = null;
  if (game.state === 'playing') {
    if (game.mode.endsOnMiss && outcome === 'miss') return endGame();
    if (timeIsUp()) return endGame();
  }
  newBall();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function update(dt) {
  updateCountdown(dt);
  updateTimer(dt);
  hoop.update(dt, hoopSpeed(), boostOn('bigHoop') ? DRINK_EFFECTS.bigHoopScale : 1);
  ball.update(dt);
  updateShot(dt);

  // Flames behind the ball while on fire
  if (isOnFire()) {
    const s = ball.screenPosition(performance.now() / 1000);
    if (s) effects.fireTrail(s.x, s.y, s.r);
  }
  effects.update(dt);

  if (game.state === 'playing' || game.state === 'countdown') {
    const seconds = Math.ceil(game.timeLeft);
    ui.updateHUD({
      score: game.score,
      best: game.best[game.mode.id],
      center: game.mode.timed ? seconds : `RUN ${game.makes}`,
      lowTime: game.mode.timed && seconds <= 10,
      streak: game.streak,
      onFire: isOnFire(),
    });
    ui.renderTrays(inventory, ball.state !== 'ready');
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

  // Hot Hand multiplier badge floats above the backboard
  if (game.basketMultiplier && game.state === 'playing') {
    hoop.drawBadge(ctx, `${game.basketMultiplier.value}×`, game.basketMultiplier.color, time);
  }

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

showMenu();
requestAnimationFrame(frame);

// Handy for debugging in the browser console, e.g. ballin.inventory.add('gold', 5)
window.ballin = { game, ball, hoop, inventory, missions, CONFIG };
