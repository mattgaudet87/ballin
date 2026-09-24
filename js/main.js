/**
 * main.js
 * ---------------------------------------------------------------------------
 * The "conductor" of the game. It:
 *   1. sets up the canvas (sharp on Retina screens) and all the game objects
 *   2. runs the game-state machine: 'menu' → 'waiting' (tap to start) → 'playing' → 'gameover'
 *   3. runs the main loop ~60 times a second: update() then render()
 *   4. applies the game RULES: scoring, streaks, on fire, the clock, power-ups,
 *      basket multipliers and missions
 *   5. runs the online screens (login, friends, challenges) using online.js
 *   6. coins: a coin can float in the hoop before any shot; make it to grab
 *      it. Coins buy ball styles in the Shop (wallet.js)
 *
 * The other modules each do one job and main.js wires them together.
 * Mode rules live in modes.js, power-ups in items.js, missions in missions.js,
 * coins and the Shop in wallet.js, and talking to the server in online.js.
 */
import { CONFIG, FX } from './config.js';
import { fitCamera, project } from './camera.js';
import { Ball } from './ball.js';
import { Hoop } from './hoop.js';
import { stepBall, aimShot } from './physics.js';
import { SwipeInput } from './input.js';
import { UI } from './ui.js';
import { SoundFX } from './audio.js';
import { Effects } from './effects.js';
import { drawCourt } from './court.js';
import { loadNumber, saveNumber, loadJSON, saveJSON } from './storage.js';
import { MODES, DIFFICULTIES, rollBasketMultiplier } from './modes.js';
import { Inventory, ITEMS, DRINK_EFFECTS } from './items.js';
import { Missions } from './missions.js';
import { Online } from './online.js';
import { Wallet, BALL_STYLES } from './wallet.js';

const G = CONFIG.game;
const COINS = CONFIG.coins;
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

// The ball waiting at the bottom, and every ball still in the air. Shooting
// moves the ready ball into `flying` and a new one reloads almost right away,
// so you never wait to see if the last shot went in.
let ball = new Ball();
const flying = [];
const hoop = new Hoop();
const effects = new Effects();
const audio = new SoundFX();
const ui = new UI();
// (the locker is picked once the difficulty is known, in applyDifficulty)
const inventory = new Inventory();
const missions = new Missions();
const online = new Online();
const wallet = new Wallet();
// What the Online screen last downloaded (null = not loaded yet)
const onlineView = { friends: null, challenges: null };

/** Everything about the current game session. */
const game = {
  state: 'menu', // 'menu' | 'waiting' | 'playing' | 'gameover'
  mode: MODES.blitz,
  difficulty: DIFFICULTIES[loadJSON(KEYS.difficulty, 'normal')] ?? DIFFICULTIES.normal,
  best: loadBests(), // best[modeId][difficultyId]
  lifetime: loadLifetime(), // lifetime[modeId][difficultyId] = baskets made ever
  match: null, // Blitz with Friends: { players: [{ name, rounds, total }], turn }
  // Online challenge being played: { id, opponent, score }.
  // id is null for a NEW challenge; score is set once the game ends and
  // stays until the server has it (so a failed send can be retried).
  challenge: null,

  // Per-game stats (reset in startGame)
  score: 0,
  streak: 0,
  bestStreak: 0,
  makes: 0,
  shots: 0,
  swishes: 0,
  fireCount: 0,
  bigMultiplierMakes: 0,
  itemsUsed: 0,
  coinsEarned: 0, // coins grabbed this game
  startBest: 0, // the record when this game started (to spot a new best)

  timeLeft: 0,
  reloadTimer: 0, // seconds until the next ball pops in
  ending: false, // Hot Hand: missed, game over is coming (no more shots)
  endTimer: 0, // seconds until that game over screen
  basketMultiplier: null, // Hot Hand bonus on the NEXT ball's basket, e.g. { value: 3, color }
  coin: false, // is a coin floating in the hoop for the NEXT ball?
  spot: -1, // which of the ball's starting spots was used last (so it never repeats)
};

const physicsEvents = [];

function loadBests() {
  const bests = {};
  for (const mode of Object.keys(MODES)) {
    bests[mode] = {};
    for (const diff of Object.keys(DIFFICULTIES)) bests[mode][diff] = loadNumber(`${KEYS.best}${mode}.${diff}`, 0);
    // Older versions had no difficulties; their scores were on today's Hard.
    bests[mode].hard = Math.max(bests[mode].hard, loadNumber(KEYS.best + mode, 0));
  }
  bests.blitz.hard = Math.max(bests.blitz.hard, loadNumber(KEYS.oldBest, 0));
  return bests;
}

function loadLifetime() {
  const lifetime = {};
  for (const mode of Object.keys(MODES)) {
    lifetime[mode] = {};
    for (const diff of Object.keys(DIFFICULTIES)) lifetime[mode][diff] = loadNumber(`${KEYS.baskets}${mode}.${diff}`, 0);

    // Older versions counted baskets per mode only. Move that count to the
    // difficulty the player last used (once), then clear the old key.
    const old = loadNumber(KEYS.baskets + mode, 0);
    if (old > 0) {
      const diff = DIFFICULTIES[loadJSON(KEYS.difficulty, 'normal')] ? loadJSON(KEYS.difficulty, 'normal') : 'normal';
      lifetime[mode][diff] += old;
      saveNumber(`${KEYS.baskets}${mode}.${diff}`, lifetime[mode][diff]);
      saveNumber(KEYS.baskets + mode, 0);
    }
  }
  return lifetime;
}

/** Lifetime baskets for the current difficulty, e.g. { blitz: 200, hothand: 90 }. */
function currentLifetime() {
  const counts = {};
  for (const mode of Object.keys(MODES)) counts[mode] = game.lifetime[mode][game.difficulty.id];
  return counts;
}

/** Every basket ever made, all modes and difficulties added up. */
function totalBaskets() {
  let total = 0;
  for (const byDiff of Object.values(game.lifetime)) for (const n of Object.values(byDiff)) total += n;
  return total;
}

/** Refresh best scores and basket counts on the menus. */
function showRecords() {
  ui.setRecords(currentBests(), currentLifetime(), totalBaskets());
  ui.setCoins(wallet.balance);
}

/** Best scores for the current difficulty, e.g. { blitz: 12, hothand: 40 }. */
function currentBests() {
  const bests = {};
  for (const mode of Object.keys(MODES)) bests[mode] = game.best[mode][game.difficulty.id];
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
  fitCamera(view.width, view.height, hoop.baseZ);

  // Redraw the cached background at the new size (each difficulty has its own court)
  courtCtx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawCourt(courtCtx, view.width, view.height, hoop, game.difficulty.id);
}

/** Switch difficulty: moves the hoop, refits the camera and redraws the court. */
function applyDifficulty(id) {
  game.difficulty = DIFFICULTIES[id];
  saveJSON(KEYS.difficulty, id);
  inventory.setDifficulty(id); // each difficulty has its own locker
  hoop.setDistance(game.difficulty.hoopZ, game.difficulty.hoopRange);
  resize();
  ui.setDifficulty(id);
  showRecords();
  ui.setLockerTitle(game.difficulty.name);
  if (ui.isShowing('hothand')) ui.renderHotHandHub(missionViews(), inventory);
  if (ui.isShowing('friend')) showFriend(friendPage.username); // their bests too
}

window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
hoop.setDistance(game.difficulty.hoopZ, game.difficulty.hoopRange);
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
  canStart: (x, y) => game.state === 'playing' && !timeIsUp() && !game.ending && ball.state === 'ready' && y > view.height * 0.5,
  onShoot: shoot,
});

ui.onModeSelect((modeId) => {
  if (modeId === 'hothand') showHotHandHub();
  else if (modeId === 'friends') showFriendsSetup(loadJSON(KEYS.friendsTab, 'local'));
  else startGame(modeId);
});
ui.onDifficulty(applyDifficulty);
ui.onHome(showHome);
ui.onHotHandPlay(() => startGame('hothand'));
ui.onFriendsStart(startMatch);
// The handoff screen's "I'm ready" button already is the tap to start
ui.onHandoffReady(() => startGame('friends', { tapToStart: false }));
ui.onTapToStart(beginPlay);
ui.onRematch(() => startMatch(game.match.players.map((p) => p.name)));
ui.onPlayAgain(() => {
  if (!game.mode.online) startGame(game.mode.id);
  else if (game.challenge?.score != null) sendChallengeResult(); // the send failed: RETRY
  else showOnline();
});
ui.onAuth(logIn);
ui.onLogout(logOut);
ui.onAddFriend(addFriend);
ui.onOnlineList({ friend: showFriend, challenge: challengeFriend, play: playChallenge, decline: declineChallenge });
ui.onFriendsTab((tab) => showFriendsSetup(tab));
ui.onFriendPage({
  back: showOnline,
  challenge: () => challengeFriend(friendPage.username),
  remove: () => removeFriend(friendPage.username),
});
ui.onCollect(collectReward);
ui.onShop(showShop);
ui.onShopItem(shopItem);
ui.onItem(useItem);
ui.onMute(() => ui.setMuted(audio.toggleMute()));
ui.onLeave(leaveGame);
ui.setMuted(audio.muted);

/** Launch the ball based on the player's swipe, then reload right away. */
function shoot(swipe) {
  if (game.state !== 'playing' || game.ending || ball.state !== 'ready') return;

  // Lock in the power-ups (Hot Hand only) and basket multiplier for this ball
  const shot = game.mode.powerUps ? inventory.startShot() : { ballMultiplier: 1, greenMultiplier: 1, itemsUsed: 0 };
  shot.basket = game.basketMultiplier;
  shot.coin = game.coin;
  game.itemsUsed += shot.itemsUsed;
  ball.shot = shot;

  ball.launch(aimShot(swipe, ball, hoop, game.difficulty));
  flying.push(ball);
  game.shots++;
  audio.whoosh();

  // The next ball pops in a split second later (see update())
  ball = new Ball();
  ball.hide();
  game.reloadTimer = G.reloadDelay;
}

/** The player tapped a power-up in the in-game tray. */
function useItem(id) {
  if (!inGame() || !game.mode.powerUps) return;
  const item = ITEMS[id];

  if (item.type === 'ball') {
    inventory.toggleBall(id); // loads onto the ball at the bottom (or the next one)
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

// --- Menus -----------------------------------------------------------------

function showHome() {
  game.state = 'menu';
  newBall();
  showRecords();
  ui.showScreen('home');
}

function showHotHandHub() {
  game.state = 'menu';
  newBall();
  showRecords();
  ui.renderHotHandHub(missionViews(), inventory);
  ui.showScreen('hothand');
}

// --- Shop --------------------------------------------------------------------

function showShop() {
  game.state = 'menu';
  newBall();
  ui.renderShop(wallet);
  ui.showScreen('shop');
  syncScores(); // pick up coins from online wins (redraws the shop if it's open)
}

/** A ball in the Shop was tapped: use it if you own it, otherwise buy it. */
function shopItem(id) {
  const style = BALL_STYLES[id];
  if (wallet.owns(id)) {
    wallet.equip(id);
    audio.select();
  } else if (wallet.balance < style.price) {
    return ui.renderShop(wallet, `You need ${style.price - wallet.balance} more coins for ${style.name}.`);
  } else if (confirm(`Buy the ${style.name} ball for ${style.price} coins?`)) {
    wallet.buy(id);
    audio.buy();
    syncScores(); // save the purchase to your account
  }
  ball.style = wallet.equipped;
  ui.renderShop(wallet);
  showRecords();
}

/**
 * Blitz with Friends: `tab` is 'local' (pass and play on this phone) or
 * 'online' (log in, challenges, friends). The last tab used is remembered.
 */
function showFriendsSetup(tab) {
  game.state = 'menu';
  game.challenge = null;
  newBall();
  saveJSON(KEYS.friendsTab, tab);
  ui.setPlayerNames(loadJSON(KEYS.playerNames, []));
  ui.showScreen('friends');
  ui.setFriendsTab(tab);
  if (tab === 'online') {
    ui.showOnlineError(null);
    renderOnline();
    refreshOnline();
  }
}

/** What the mission cards need to show (the reward stays secret). */
function missionViews() {
  return missions.list.map((m) => ({ text: missions.describe(m), progress: m.progress, target: m.target, completed: m.completed }));
}

/** "Collect reward" tapped: reveal the prize in a popup, then refresh the lists. */
function collectReward(index) {
  const items = missions.collect(index);
  if (!items.length) return;
  for (const id of items) inventory.add(id);
  audio.missionComplete();
  ui.showRewardPopup(items, () => {
    if (game.state === 'gameover') ui.renderGameOverMissions(missionViews());
    else ui.renderHotHandHub(missionViews(), inventory);
  });
}

// --- Blitz with Friends ------------------------------------------------------

/** Start a pass-and-play match. Turns go A, B, A, B. */
function startMatch(names) {
  saveJSON(KEYS.playerNames, names);
  game.match = { players: names.map((name) => ({ name, rounds: [], total: 0 })), turn: 0 };
  showHandoff();
}

function totalTurns() {
  const rule = MODES.friends.passAndPlay;
  return rule.players * rule.roundsEach;
}

function currentPlayer() {
  const { players, turn } = game.match;
  return players[turn % players.length];
}

function showHandoff() {
  game.state = 'menu';
  newBall();
  ui.showHandoff({ round: game.match.turn + 1, totalRounds: totalTurns(), name: currentPlayer().name, players: game.match.players });
}

/** A friends round just ended: record it, then hand off or show the results. */
function endRound() {
  const player = currentPlayer();
  player.rounds.push(game.score - player.total);
  player.total = game.score;
  game.match.turn++;
  if (game.match.turn < totalTurns()) {
    showHandoff();
  } else {
    game.state = 'menu';
    newBall();
    ui.showResults({ players: game.match.players });
    setTimeout(() => audio.newBest(), 300);
  }
}

// --- Online ----------------------------------------------------------------------

/** The Online tab of Blitz with Friends. */
function showOnline() {
  showFriendsSetup('online');
}

function renderOnline() {
  ui.renderOnline({ username: online.username, ...onlineView });
  const yourTurn = onlineView.challenges?.filter((c) => c.status === 'yourTurn').length ?? 0;
  ui.setOnlineStatus(yourTurn);
}

// The friend whose page is open
const friendPage = { username: null };

/** Open a friend's page: your record against them, their bests and your game history. */
async function showFriend(username) {
  friendPage.username = username;
  ui.renderFriend(username, null, game.difficulty.id);
  ui.showScreen('friend');
  try {
    const friend = await online.friend(username);
    if (friendPage.username === username) ui.renderFriend(username, friend, game.difficulty.id);
  } catch (err) {
    showOnline();
    ui.showOnlineError(err.message);
  }
}

/** Download the latest friends list and challenges, then redraw. */
async function refreshOnline() {
  if (!online.username) return renderOnline();
  try {
    const [friends, challenges] = await Promise.all([online.friends(), online.challenges()]);
    Object.assign(onlineView, { friends, challenges });
  } catch (err) {
    ui.showOnlineError(err.message);
  }
  renderOnline();
}

/** The login form was sent. action is 'login' or 'signup'. */
async function logIn(action, username, password) {
  ui.showAuthError(null);
  try {
    if (action === 'signup') await online.signUp(username, password);
    else await online.logIn(username, password);
  } catch (err) {
    return ui.showAuthError(err.message);
  }
  Object.assign(onlineView, { friends: null, challenges: null });
  syncScores();
  showOnline();
}

async function logOut() {
  await online.logOut();
  Object.assign(onlineView, { friends: null, challenges: null });
  renderOnline();
}

/**
 * Save this device's records to the account, and bring back any higher ones
 * saved there (e.g. from another phone). Quietly does nothing when offline.
 *
 * The device remembers whose records it holds. If a DIFFERENT account logs
 * in (a shared iPad), we don't upload the old player's records to it; the
 * device switches to the new account's saved records instead.
 */
async function syncScores() {
  const username = online.username;
  if (!username) return;
  const owner = loadJSON(KEYS.recordsOwner, null);
  const switching = owner !== null && owner.toLowerCase() !== username.toLowerCase();

  let saved;
  try {
    saved = switching ? await online.syncScores({}, {}, {}) : await online.syncScores(game.best, game.lifetime, wallet.toJSON());
  } catch {
    return; // no internet right now; it tries again after the next game
  }
  for (const mode of Object.keys(MODES)) {
    for (const diff of Object.keys(DIFFICULTIES)) {
      const best = saved.bests[mode]?.[diff] ?? 0;
      if (switching || best > game.best[mode][diff]) {
        game.best[mode][diff] = best;
        saveNumber(`${KEYS.best}${mode}.${diff}`, best);
      }
      const baskets = saved.baskets[mode]?.[diff] ?? 0;
      if (switching || baskets > game.lifetime[mode][diff]) {
        game.lifetime[mode][diff] = baskets;
        saveNumber(`${KEYS.baskets}${mode}.${diff}`, baskets);
      }
    }
  }
  if (saved.wallet) wallet.merge(saved.wallet, switching);
  saveJSON(KEYS.recordsOwner, username);
  if (!inGame()) showRecords();
  if (ui.isShowing('shop')) ui.renderShop(wallet);
}

async function addFriend(username, clearInput) {
  ui.showOnlineError(null);
  try {
    await online.addFriend(username);
    clearInput();
  } catch (err) {
    return ui.showOnlineError(err.message);
  }
  refreshOnline();
}

async function removeFriend(username) {
  if (!confirm(`Remove ${username} from your friends?`)) return;
  showOnline();
  try {
    await online.removeFriend(username);
  } catch (err) {
    return ui.showOnlineError(err.message);
  }
  refreshOnline();
}

/** Start a NEW challenge: you play first, it's sent when your game ends. */
function challengeFriend(username) {
  game.challenge = { id: null, opponent: username, score: null };
  startGame('online');
}

/** Answer a challenge a friend sent you, on the difficulty they picked. */
function playChallenge(id) {
  const challenge = onlineView.challenges?.find((c) => c.id === Number(id));
  if (!challenge) return;
  applyDifficulty(challenge.difficulty);
  game.challenge = { id: challenge.id, opponent: challenge.opponent, score: null };
  startGame('online');
}

async function declineChallenge(id) {
  try {
    await online.declineChallenge(Number(id));
  } catch (err) {
    return ui.showOnlineError(err.message);
  }
  refreshOnline();
}

/** Online game over: send the score (a new challenge, or the answer to one). */
async function sendChallengeResult() {
  const challenge = game.challenge;
  if (challenge.sending) return; // already on its way (double tap on RETRY)
  challenge.sending = true;
  ui.setGameOverNote('Sending your score…');
  ui.setAgainLabel('CHALLENGES');
  try {
    const result = challenge.id
      ? await online.finishChallenge(challenge.id, challenge.score)
      : await online.sendChallenge(challenge.opponent, game.difficulty.id, challenge.score);
    game.challenge = null; // delivered
    // The server adds the prize to your account; show it here right away too
    if (result.coinsWon) {
      wallet.addBonus(result.coinsWon);
      ui.setGameOverCoins(game.coinsEarned + result.coinsWon);
    }
    ui.setGameOverNote(challengeNote(result));
    if (result.status === 'won') setTimeout(() => audio.newBest(), 300);
  } catch (err) {
    ui.setGameOverNote(`${err.message} Your score wasn’t sent yet.`);
    ui.setAgainLabel('RETRY');
    challenge.sending = false;
  }
}

function challengeNote({ status, opponent, myScore, theirScore }) {
  if (status === 'won') return `🏆 You beat ${opponent}, ${myScore}–${theirScore}! +${COINS.onlineWin} coins`;
  if (status === 'lost') return `${opponent} wins this one, ${theirScore}–${myScore}.`;
  if (status === 'tie') return `Tie with ${opponent}, ${myScore}–${theirScore}!`;
  return `Sent to ${opponent}! You’ll see who won once they play.`;
}

// --- Playing -------------------------------------------------------------------

/**
 * Set up a new game. No countdown: it waits on a "Tap to start" screen
 * (or starts right away with tapToStart: false).
 */
function startGame(modeId, { tapToStart = true } = {}) {
  audio.unlock();
  const mode = MODES[modeId];
  Object.assign(game, {
    mode,
    state: 'waiting', // → 'playing' in beginPlay()
    // In Blitz with Friends each round continues the player's running total
    score: mode.passAndPlay ? currentPlayer().total : 0,
    streak: 0,
    bestStreak: 0,
    makes: 0,
    shots: 0,
    swishes: 0,
    fireCount: 0,
    bigMultiplierMakes: 0,
    itemsUsed: 0,
    coinsEarned: 0,
    startBest: game.best[modeId][game.difficulty.id],
    timeLeft: mode.duration,
    reloadTimer: 0,
    ending: false,
    endTimer: 0,
  });
  flying.length = 0;
  hoop.reset();
  effects.reset();
  newBall();
  ui.showGame({ powerUps: mode.powerUps });
  const title = mode.online ? `vs ${game.challenge.opponent}` : mode.name;
  if (tapToStart) ui.showTapToStart(`${title} · ${game.difficulty.name}`);
  else beginPlay();
}

/** The player tapped to start: the clock (if any) starts now. */
function beginPlay() {
  if (game.state !== 'waiting') return;
  game.state = 'playing';
  ui.hideTapToStart();
  audio.unlock();
  audio.start();
}

/**
 * The LEAVE button: quit the game and go back to where it was started from.
 * The game doesn't count (no game over screen, no best score, no missions),
 * but baskets you made still add to your lifetime count.
 */
function leaveGame() {
  if (!inGame()) return;
  const mode = game.mode;

  // Free Throw has no clock and no way to lose, so END just finishes the session
  if (mode.endless) return endGame();

  // Answering a friend's challenge: your score so far is sent, so nobody can
  // quit and replay until they get a good score.
  if (mode.online && game.challenge.id) {
    if (confirm(`Leave now? Your score of ${game.score} will be sent to ${game.challenge.opponent}.`)) endGame();
    return;
  }

  const what = mode.passAndPlay ? 'the match' : 'this game';
  if (!confirm(`Leave ${what}? It won’t count.`)) return;

  flying.length = 0;
  inventory.selectedBall = null; // an unused specialty ball goes back in the locker
  const diff = game.difficulty.id;
  saveNumber(`${KEYS.baskets}${mode.id}.${diff}`, game.lifetime[mode.id][diff]);

  if (mode.passAndPlay) {
    game.match = null;
    showFriendsSetup('local');
  } else if (mode.online) {
    showOnline(); // a new challenge that was never sent
  } else if (mode.missions) {
    showHotHandHub();
  } else {
    showHome();
  }
}

/** True during a game, including the "Tap to start" moment before it begins. */
function inGame() {
  return game.state === 'playing' || game.state === 'waiting';
}

function endGame() {
  const mode = game.mode;
  flying.length = 0; // balls still in the air don't count any more
  game.ending = false;
  inventory.selectedBall = null; // unused balls go back in the locker
  const diff = game.difficulty.id;
  saveNumber(`${KEYS.baskets}${mode.id}.${diff}`, game.lifetime[mode.id][diff]);

  if (mode.passAndPlay) {
    syncScores(); // lifetime baskets
    return endRound();
  }
  game.state = 'gameover';

  const result = gameResult();
  const isNewBest = result > game.startBest;
  saveBest(result);
  if (isNewBest) setTimeout(() => audio.newBest(), 500);

  // Hot Hand missions: record progress. Rewards wait for "Collect reward".
  let missionInfo = null;
  if (mode.missions) {
    const results = missions.applyGame(gameStats());
    missionInfo = { views: missionViews(), results };
    if (results.some((r) => r.justCompleted)) setTimeout(() => audio.missionComplete(), 1100);
  }

  ui.showGameOver({
    ...game,
    score: result,
    title: `${gameOverTitle()} · ${game.difficulty.name.toUpperCase()}`,
    best: game.best[mode.id][diff],
    lifetime: game.lifetime[mode.id][diff],
    isNewBest,
    missions: missionInfo,
    coins: game.coinsEarned,
  });
  newBall();

  if (mode.online) {
    game.challenge.score = game.score;
    sendChallengeResult();
  }
  syncScores(); // save records to the account (if logged in)
}

/** The number that counts as this game's score (Free Throw: the longest streak). */
function gameResult() {
  return game.mode.streakScoring ? game.bestStreak : game.score;
}

function gameOverTitle() {
  if (game.mode.streakScoring) return 'BEST STREAK';
  return game.mode.timed ? 'TIME’S UP' : 'MISSED';
}

/** Save a new record for the current mode + difficulty (if it is one). */
function saveBest(value) {
  const { mode, difficulty } = game;
  if (value <= game.best[mode.id][difficulty.id]) return;
  game.best[mode.id][difficulty.id] = value;
  saveNumber(`${KEYS.best}${mode.id}.${difficulty.id}`, value);
}

/** The numbers missions care about, for the game that just ended. */
function gameStats() {
  return {
    points: game.score,
    makes: game.makes,
    swishes: game.swishes,
    bestStreak: game.bestStreak,
    fireCount: game.fireCount,
    bigMultiplierMakes: game.bigMultiplierMakes,
    itemsUsed: game.itemsUsed,
    games: 1,
  };
}

function isOnFire() {
  return game.state === 'playing' && game.mode.fire && game.streak >= G.fireStreak;
}

function timeIsUp() {
  return game.mode.timed && game.timeLeft <= 0;
}

/** Bring out a fresh ball (random spot in a game, centered in menus). */
function newBall() {
  const randomSpot = inGame() && !game.mode.fixedSpot;
  ball.reset(randomSpot ? randomStartX() : CONFIG.ball.startX);
  ball.skin = inGame() && game.mode.powerUps ? inventory.selectedBall : null;
  ball.style = wallet.equipped;

  // Every mode: maybe a coin floats in the hoop for this ball
  game.coin = inGame() && Math.random() < COINS.chance;

  // Hot Hand: maybe put a multiplier on the next basket
  game.basketMultiplier = inGame() && game.mode.basketMultipliers ? rollBasketMultiplier() : null;
  if (game.basketMultiplier?.value >= 5) audio.rareMultiplier();
}

/**
 * Pick one of the evenly spaced starting spots across the difficulty's range,
 * e.g. 8 spots from far left to far right, never the same one twice in a row.
 */
function randomStartX() {
  const spots = CONFIG.ball.spots;
  const range = game.difficulty.startXRange;
  let spot;
  if (game.spot < 0) {
    spot = Math.floor(Math.random() * spots); // first ball: any spot
  } else {
    spot = Math.floor(Math.random() * (spots - 1));
    if (spot >= game.spot) spot++; // skip the spot we just used
  }
  game.spot = spot;
  return -range + (spot / (spots - 1)) * 2 * range;
}

function updateTimer(dt) {
  if (game.state !== 'playing' || !game.mode.timed || game.timeLeft <= 0) return;
  const before = game.timeLeft;
  game.timeLeft = Math.max(0, game.timeLeft - dt);

  // Tick every second during the last 5 seconds
  if (game.timeLeft > 0 && game.timeLeft <= 5 && Math.ceil(before) !== Math.ceil(game.timeLeft)) {
    audio.tick();
  }
  // Balls already in the air still count (buzzer beaters!). The game ends
  // once they're all decided, see updateShots().
  if (game.timeLeft === 0) audio.buzzer();
}

// ---------------------------------------------------------------------------
// The hoop: movement and size
// ---------------------------------------------------------------------------

/**
 * Is a power-up effect on right now? Balls in the air keep the power-ups they
 * were shot with, so a boost can't run out mid-flight.
 */
function boostOn(effect) {
  if (!inGame() || !game.mode.powerUps) return false;
  if (flying.some((b) => b.outcome === null && b.shot[effect])) return true;
  return effect === 'bigHoop' ? inventory.isActive('white') : inventory.isActive('orange');
}

/**
 * The mode's moving-hoop rule, or null if the hoop never moves in this mode
 * on this difficulty (e.g. Blitz only moves the hoop on Hard).
 */
function hoopRule() {
  const rule = game.mode.movingHoop;
  if (!rule) return null;
  if (rule.difficulties && !rule.difficulties.includes(game.difficulty.id)) return null;
  return rule;
}

/** How fast the hoop should slide, based on the mode's rules. */
function hoopSpeed() {
  const rule = hoopRule();
  if (game.state !== 'playing' || !rule) return 0;
  const value = game[rule.stat];
  if (value < rule.startAt) return 0;
  let speed = Math.min(G.hoopSpeedMax, rule.speedStart + (value - rule.startAt) * rule.speedPer);
  if (boostOn('slowHoop')) speed *= DRINK_EFFECTS.slowHoopFactor;
  return speed;
}

// ---------------------------------------------------------------------------
// Shots: making, missing and resetting
// ---------------------------------------------------------------------------

/** Move every ball in the air, react to what they hit, and decide makes/misses. */
function updateShots(dt) {
  for (const b of flying) updateFlyingBall(b, dt);

  // Balls that were decided a while ago (or left the court) disappear
  for (let i = flying.length - 1; i >= 0; i--) {
    const b = flying[i];
    const gone = b.flightTime > G.maxShotTime || Math.abs(b.x) > 6;
    if (b.outcome !== null && (b.linger <= 0 || gone)) flying.splice(i, 1);
  }

  if (game.state !== 'playing') return;
  // Hot Hand: the miss happened, show the game over after a short pause
  if (game.ending) {
    game.endTimer -= dt;
    if (game.endTimer <= 0) endGame();
    return;
  }
  // Time's up and every ball in the air has landed
  if (timeIsUp() && !flying.some((b) => b.outcome === null)) endGame();
}

function updateFlyingBall(b, dt) {
  // Run the physics in small fixed steps for accurate bounces.
  b.physicsTime += dt;
  while (b.physicsTime >= PHYSICS_STEP) {
    stepBall(b, hoop, PHYSICS_STEP, physicsEvents);
    b.physicsTime -= PHYSICS_STEP;
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
    } else if (event.type === 'score' && b.outcome === null) {
      onMake(b, event.swish);
    }
  }
  physicsEvents.length = 0;

  // A miss: it's falling below the rim, or it flew off / took too long
  if (b.outcome === null) {
    const belowRimFalling = b.y < hoop.rimY - 0.3 && b.vy < 0 && b.flightTime > 0.3;
    const lost = b.flightTime > G.maxShotTime || Math.abs(b.x) > 6;
    if (belowRimFalling || lost) onMiss(b);
  } else {
    b.linger -= dt;
  }
}

/** Ball `b` went in. */
function onMake(b, swish) {
  b.outcome = 'make';
  b.linger = G.ballLinger;
  if (game.ending || game.state !== 'playing') return; // Hot Hand run already over

  const shot = b.shot;
  const rule = hoopRule();
  const hoopStatBefore = rule ? game[rule.stat] : 0;
  game.makes++;
  game.lifetime[game.mode.id][game.difficulty.id]++;
  game.streak++;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  const fire = game.mode.fire;
  if (fire && game.streak === G.fireStreak) game.fireCount++;
  const onFireNow = fire && game.streak >= G.fireStreak;

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
  let points = Math.round((G.pointsPerMake + (swish ? G.swishBonus : 0)) * multiplier);
  if (game.mode.streakScoring) {
    // Free Throw: the score is simply your streak, and a record is saved right away
    points = 1;
    game.score = game.streak;
    saveBest(game.bestStreak);
  } else {
    game.score += points;
  }

  // Feedback
  const rim = project(hoop.x, hoop.rimY, hoop.z);
  const big = multiplier >= 3;
  effects.floatText(rim.x, rim.y - 40, `+${points}`, { color: onFireNow || big ? '#ffd23f' : '#ffffff', size: big ? 52 : 40 });
  labels.forEach((label, i) => {
    effects.floatText(rim.x, rim.y + 30 + i * 24, label.text, { color: label.color, size: 18, life: 1.3 });
  });
  const colors = shot.basket ? [shot.basket.color, '#ffffff', '#ffd23f'] : onFireNow ? ['#ffd23f', '#ff7a1a', '#ff3d1a'] : ['#ffffff', '#ff7a1a', '#7aa2ff'];
  effects.burst(rim.x, rim.y + 20, colors, FX ? (big ? 60 : 34) : big ? 36 : 18, FX ? 340 : 260);
  if (FX) {
    effects.ring(rim.x, rim.y, hoop.radius * rim.scale, swish ? '#7ee8ff' : colors[0]);
    effects.sparks(rim.x, rim.y, swish ? ['#ffffff', '#7ee8ff'] : ['#fff1a8', '#ffd23f', '#ff9a1f'], big ? 48 : 26);
    effects.flash(rim.x, rim.y, big || onFireNow ? 0.35 : swish ? 0.22 : 0.14, swish ? '150, 230, 255' : '255, 190, 120');
    effects.shake(big ? 10 : swish ? 5 : 3);
  }
  if (big) effects.shake(6);
  hoop.onScore(swish ? 1.3 : 1);
  audio.score(game.streak);

  if (swish) {
    game.swishes++;
    audio.swish();
    effects.floatText(rim.x, rim.y - 85, 'SWISH!', { color: '#7ee8ff', size: 30 });
  }
  if (shot.coin) grabCoin(shot, rim);
  if (onFireNow && game.streak === G.fireStreak) {
    audio.fire();
    effects.shake(8);
    effects.floatText(view.width / 2, view.height * 0.5, 'ON FIRE!', { color: '#ff8a1f', size: 54, life: 1.4 });
  }
  if (rule && hoopStatBefore < rule.startAt && game[rule.stat] >= rule.startAt) {
    effects.floatText(view.width / 2, view.height * 0.58, 'HOOP ON THE MOVE!', { color: '#7aa2ff', size: 26, life: 1.6 });
  }
}

/** A made basket had a coin in it: add it to the wallet (2× with a Blue Monster). */
function grabCoin(shot, rim) {
  const amount = COINS.value * (shot.coinBoost ? COINS.blueMultiplier : 1);
  wallet.add(amount);
  game.coinsEarned += amount;
  audio.coin();
  const color = shot.coinBoost ? '#7ec8ff' : '#ffd23f';
  effects.floatText(rim.x + 70, rim.y - 60, `+${amount} COINS`, { color, size: 26, life: 1.3 });
  effects.sparks(rim.x, rim.y - 30, shot.coinBoost ? ['#ffffff', '#3aa0ff'] : ['#fff6b8', '#ffc928'], 18);
}

/** Ball `b` missed. */
function onMiss(b) {
  b.outcome = 'miss';
  b.linger = G.ballLinger;
  if (game.ending || game.state !== 'playing') return;

  if (game.mode.endsOnMiss) {
    // Hot Hand: one miss ends it (after a beat, so the miss sinks in)
    game.ending = true;
    game.endTimer = G.missEndDelay;
    effects.floatText(view.width / 2, view.height * 0.5, 'MISS', { color: '#ff5a5a', size: 54, life: 1.2 });
  } else if (isOnFire()) {
    effects.floatText(view.width / 2, view.height * 0.5, 'FIRE’S OUT', { color: '#9aa7c7', size: 30 });
  } else if (game.mode.streakScoring && game.streak >= 2) {
    effects.floatText(view.width / 2, view.height * 0.5, `STREAK OVER · ${game.streak}`, { color: '#9aa7c7', size: 28 });
  }
  game.streak = 0;
  if (game.mode.streakScoring) game.score = 0;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function update(dt) {
  updateTimer(dt);
  hoop.update(dt, hoopSpeed(), boostOn('bigHoop') ? DRINK_EFFECTS.bigHoopScale : 1);

  // Pop in the next ball once the short reload is over
  if (ball.state === 'reloading') {
    game.reloadTimer -= dt;
    if (game.reloadTimer <= 0) newBall();
  }
  ball.update(dt);
  for (const b of flying) b.update(dt);
  updateShots(dt);

  // Flames behind the balls while on fire
  if (isOnFire()) {
    for (const b of [ball, ...flying]) {
      const s = b.screenPosition(performance.now() / 1000);
      if (s) effects.fireTrail(s.x, s.y, s.r);
    }
  }
  effects.update(dt);

  if (inGame()) {
    ui.updateHUD(hudInfo());
    if (game.mode.powerUps) ui.renderTrays(inventory, ball.state !== 'ready');
  }
  ui.setHint(game.state === 'playing' && game.shots === 0 && ball.state === 'ready');
}

/** What the in-game HUD shows, depending on the mode. */
function hudInfo() {
  const mode = game.mode;
  const seconds = Math.ceil(game.timeLeft);
  const best = Math.max(game.best[mode.id][game.difficulty.id], gameResult());
  const info = {
    label: 'SCORE',
    score: game.score,
    sub: `BEST ${best}`,
    lifetime: game.lifetime[mode.id][game.difficulty.id],
    center: mode.timed ? seconds : `RUN ${game.makes}`,
    lowTime: mode.timed && seconds <= 10,
    streak: game.streak,
    onFire: isOnFire(),
    leaveLabel: mode.endless ? 'END' : '✕ LEAVE',
    coins: wallet.balance,
  };
  if (mode.passAndPlay) {
    info.label = currentPlayer().name.toUpperCase();
    info.sub = `ROUND ${Math.floor(game.match.turn / mode.passAndPlay.players) + 1} OF ${mode.passAndPlay.roundsEach}`;
  } else if (mode.online) {
    Object.assign(info, { label: 'YOU', sub: `VS ${game.challenge.opponent.toUpperCase()}` });
  } else if (mode.streakScoring) {
    // Free Throw: the big number already IS the streak
    Object.assign(info, { label: 'STREAK', sub: `RECORD ${best}`, center: `${game.makes}/${game.shots}`, streak: 0 });
  }
  return info;
}

/**
 * Which layer should ball `b` be drawn on? Painting order fakes 3D depth:
 *  - 'behindBoard': flew past the backboard → drawn before the hoop
 *  - 'insideHoop':  past the front of the rim → between the back and front of the hoop
 *  - 'front':       in front of the hoop → drawn after the hoop
 */
function ballLayer(b) {
  if (b.z > hoop.boardZ) return 'behindBoard';
  const dx = b.x - hoop.x;
  const rimFrontZ = Math.abs(dx) < hoop.radius ? hoop.z - Math.sqrt(hoop.radius ** 2 - dx * dx) : hoop.z;
  return b.z > rimFrontZ ? 'insideHoop' : 'front';
}

/** The multiplier badge to show: the newest ball in the air that has one, else the next ball's. */
function shownMultiplier() {
  for (let i = flying.length - 1; i >= 0; i--) {
    if (flying[i].outcome === null && flying[i].shot.basket) return flying[i].shot.basket;
  }
  return game.basketMultiplier;
}

/**
 * The coin to show in the hoop: the newest ball in the air that's going for
 * one, else the next ball's. `double` = worth 2× (Blue Monster).
 */
function shownCoin() {
  for (let i = flying.length - 1; i >= 0; i--) {
    const b = flying[i];
    if (b.outcome === null && b.shot.coin) return { double: Boolean(b.shot.coinBoost) };
  }
  if (!game.coin || game.ending || ball.state !== 'ready') return null;
  return { double: game.mode.powerUps && inventory.isActive('blue') };
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
  if (FX) effects.drawMotes(ctx, width, height, time, isOnFire());
  for (const b of flying) b.drawShadow(ctx);
  ball.drawShadow(ctx);

  // Hot Hand multiplier badge floats above the backboard
  const badge = inGame() && shownMultiplier();
  if (badge) hoop.drawBadge(ctx, `${badge.value}×`, badge.color, time);

  // Sort the balls in the air into layers, farthest first, then paint:
  // balls behind the board → back of hoop → balls inside the rim → front of
  // hoop → balls in front (and the ready ball last, it's the closest).
  const layers = { behindBoard: [], insideHoop: [], front: [] };
  for (const b of [...flying].sort((a, c) => c.z - a.z)) layers[ballLayer(b)].push(b);
  layers.front.push(ball);

  const onFire = isOnFire();
  const drawBalls = (list) => list.forEach((b) => b.draw(ctx, time, onFire));
  drawBalls(layers.behindBoard);
  hoop.drawBack(ctx);
  // A coin floats above the rim (in front of the board) when a shot can grab one
  const coin = inGame() && shownCoin();
  if (coin) hoop.drawCoin(ctx, time, coin.double);
  drawBalls(layers.insideHoop);
  hoop.drawFront(ctx);
  effects.drawFlames(ctx);
  drawBalls(layers.front);

  effects.draw(ctx);
  ctx.restore();

  if (onFire) effects.drawFireGlow(ctx, width, height, time);
  if (FX) effects.drawPost(ctx, width, height);
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

applyDifficulty(game.difficulty.id);
showHome();
requestAnimationFrame(frame);
// If you're logged in: check for challenges waiting on you, and back up your records
refreshOnline();
syncScores();

// Handy for debugging in the browser console, e.g. ballin.inventory.add('gold', 5) or ballin.wallet.add(500)
window.ballin = {
  game, hoop, inventory, missions, online, wallet, CONFIG, flying,
  get ball() { return ball; }, // the ball waiting at the bottom (a new one after every shot)
};
