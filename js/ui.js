/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Everything drawn with regular HTML instead of the canvas:
 *   - the start screen (mode picker, missions, locker)
 *   - the in-game HUD, countdown, "swipe up" hint and power-up trays
 *   - the game-over screen (score, stats, mission progress + rewards)
 *   - the mute button
 *
 * The HTML skeleton lives in index.html and the styling in style.css. This
 * file shows/hides pieces and fills in their content. It never changes game
 * state itself — it just calls the callbacks main.js gives it.
 */
import { CONFIG } from './config.js';
import { ITEMS, BALL_IDS, DRINK_IDS } from './items.js';

const $ = (id) => document.getElementById(id);

/** Small HTML icon for an item (drawn with CSS, see "Item icons" in style.css). */
export function itemIcon(id) {
  const shape = ITEMS[id].type === 'ball' ? 'icon-ball' : 'icon-can';
  return `<span class="icon ${shape} ${id}" aria-hidden="true"></span>`;
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      score: $('score'),
      bestSmall: $('best-small'),
      timer: $('timer'),
      streak: $('streak'),
      hint: $('hint'),
      countdown: $('countdown'),
      startScreen: $('start-screen'),
      startMissions: $('start-missions'),
      locker: $('locker'),
      gameOver: $('gameover-screen'),
      gameOverTitle: $('gameover-title'),
      finalScore: $('final-score'),
      newBest: $('new-best'),
      statBest: $('stat-best'),
      statMakes: $('stat-makes'),
      statAccuracy: $('stat-accuracy'),
      statSwishes: $('stat-swishes'),
      statStreak: $('stat-streak'),
      gameOverMissions: $('gameover-missions'),
      ballTray: $('ball-tray'),
      drinkTray: $('drink-tray'),
      muteBtn: $('mute-btn'),
    };
    // Remember what's on screen so we only touch the page when something changes
    this.shown = {};
  }

  // --- Wiring up buttons ---------------------------------------------------------

  /** callback(modeId) when a mode card on the start screen is tapped. */
  onModeSelect(callback) {
    document.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => callback(card.dataset.mode));
    });
  }

  onPlayAgain(callback) {
    $('again-btn').addEventListener('click', callback);
  }

  onMenu(callback) {
    $('menu-btn').addEventListener('click', callback);
  }

  onMute(callback) {
    this.el.muteBtn.addEventListener('click', callback);
  }

  /** callback(itemId) when a power-up in the in-game tray is tapped. */
  onItem(callback) {
    for (const tray of [this.el.ballTray, this.el.drinkTray]) {
      tray.addEventListener('click', (e) => {
        const button = e.target.closest('[data-item]');
        if (button) callback(button.dataset.item);
      });
    }
  }

  setMuted(muted) {
    this.el.muteBtn.classList.toggle('muted', muted);
    this.el.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  // --- Start screen ----------------------------------------------------------------

  /**
   * @param bests     { blitz: 12, hothand: 30 }
   * @param missions  [{ text, progress, target, reward: [itemIds] }]
   * @param inventory the Inventory (for the locker)
   */
  showMenu({ bests, missions, inventory }) {
    for (const el of document.querySelectorAll('[data-best]')) {
      el.textContent = bests[el.dataset.best] ?? 0;
    }
    this.el.startMissions.innerHTML = missions.map((m) => missionCard(m)).join('');
    this.el.locker.innerHTML = [...BALL_IDS, ...DRINK_IDS].map((id) => lockerTile(id, inventory)).join('');

    show(this.el.startScreen);
    this.el.startScreen.scrollTop = 0;
    hide(this.el.gameOver);
    this.hideGameHUD();
  }

  // --- In game -------------------------------------------------------------------

  /** Hide menus and show the in-game HUD. */
  showGame() {
    hide(this.el.startScreen);
    hide(this.el.gameOver);
    show(this.el.hud);
    show(this.el.ballTray);
    show(this.el.drinkTray);
    this.shown = {};
  }

  hideGameHUD() {
    hide(this.el.hud);
    hide(this.el.hint);
    hide(this.el.ballTray);
    hide(this.el.drinkTray);
    this.shown = {};
  }

  /** Show a big countdown number (or "GO!") with a pop animation. */
  showCountdown(text) {
    const el = this.el.countdown;
    el.textContent = text;
    show(el);
    // Restart the CSS animation by removing and re-adding the class
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  hideCountdown() {
    hide(this.el.countdown);
  }

  /**
   * Called every frame; only updates the page when a value actually changes.
   * `center` is what shows in the middle pill (seconds left, or the run count).
   */
  updateHUD({ score, best, center, lowTime, streak, onFire }) {
    this.setText('score', score);
    this.setText('bestSmall', `BEST ${Math.max(best, score)}`);
    this.setText('timer', center);
    this.el.timer.classList.toggle('low', lowTime);

    const streakText = onFire ? `🔥 ON FIRE ×${CONFIG.game.fireMultiplier}` : streak >= 2 ? `${streak} IN A ROW` : '';
    this.setText('streak', streakText);
    this.el.streak.classList.toggle('hidden', !streakText);
    this.el.streak.classList.toggle('fire', onFire);
  }

  setHint(visible) {
    if (this.shown.hint === visible) return;
    this.shown.hint = visible;
    this.el.hint.classList.toggle('hidden', !visible);
  }

  /**
   * Draw the power-up trays: specialty balls on the left, energy drinks on the right.
   * @param ballsLocked true while a shot is in the air (can't swap balls then)
   */
  renderTrays(inventory, ballsLocked) {
    // Build a short "fingerprint" so we only rebuild the buttons when something changed
    const key = JSON.stringify([inventory.counts, inventory.active, inventory.selectedBall, ballsLocked]);
    if (this.shown.trays === key) return;
    this.shown.trays = key;

    this.el.ballTray.innerHTML = BALL_IDS.map((id) => {
      const count = inventory.count(id);
      const classes = ['tray-btn', inventory.selectedBall === id && 'selected', (count === 0 || ballsLocked) && 'empty'];
      return `<button type="button" class="${classes.filter(Boolean).join(' ')}" data-item="${id}" aria-label="${ITEMS[id].name}: ${ITEMS[id].desc}">
        ${itemIcon(id)}<span class="tray-count">${count}</span>
      </button>`;
    }).join('');

    this.el.drinkTray.innerHTML = DRINK_IDS.map((id) => {
      const item = ITEMS[id];
      const boost = inventory.active[id];
      const count = inventory.count(id);
      const classes = ['tray-btn', boost && 'active', !boost && (count === 0 || item.comingSoon) && 'empty'];
      const badge = item.comingSoon
        ? '<span class="tray-soon">SOON</span>'
        : boost
          ? `<span class="tray-shots">${boost.shotsLeft}</span>`
          : `<span class="tray-count">${count}</span>`;
      return `<button type="button" class="${classes.filter(Boolean).join(' ')}" data-item="${id}" aria-label="${item.name}: ${item.desc}">
        ${itemIcon(id)}${badge}
      </button>`;
    }).join('');
  }

  // --- Game over -----------------------------------------------------------------

  /**
   * @param stats.title    headline, e.g. "TIME'S UP"
   * @param stats.results  mission results from Missions.applyGame()
   */
  showGameOver(stats) {
    const e = this.el;
    e.gameOverTitle.textContent = stats.title;
    e.finalScore.textContent = stats.score;
    e.statBest.textContent = stats.best;
    e.statMakes.textContent = `${stats.makes}/${stats.shots}`;
    e.statAccuracy.textContent = stats.shots ? `${Math.round((stats.makes / stats.shots) * 100)}%` : '–';
    e.statSwishes.textContent = stats.swishes;
    e.statStreak.textContent = stats.bestStreak;
    e.newBest.classList.toggle('hidden', !stats.isNewBest);

    // Mission cards start at their old progress, then the bars fill up.
    e.gameOverMissions.innerHTML = stats.results
      .map((r) => missionCard({ ...r.mission, text: r.text, progress: r.before }, r))
      .join('');
    setTimeout(() => {
      e.gameOverMissions.querySelectorAll('.mission').forEach((card, i) => {
        const r = stats.results[i];
        card.querySelector('.bar-fill').style.width = `${(r.after / r.mission.target) * 100}%`;
        card.querySelector('.mission-count').textContent = `${r.after}/${r.mission.target}`;
        if (r.completed) card.classList.add('done');
      });
    }, 350);

    this.hideGameHUD();
    show(e.gameOver);
    e.gameOver.scrollTop = 0;
  }

  setText(key, value) {
    if (this.shown[key] === value) return;
    this.shown[key] = value;
    this.el[key].textContent = value;
  }
}

// --- HTML builders -------------------------------------------------------------------

/**
 * A mission card with a progress bar and its reward.
 * If `result` is given (game-over screen), completed missions animate to "done".
 */
function missionCard(mission, result = null) {
  const pct = Math.min(100, (mission.progress / mission.target) * 100);
  const rewards = mission.reward
    .map((id) => `<span class="chip">${itemIcon(id)}${ITEMS[id].name}</span>`)
    .join('');
  const gained = result && result.after > result.before ? ' gained' : '';
  return `<div class="mission${gained}">
    <div class="mission-top">
      <span class="mission-text">${mission.text}</span>
      <span class="mission-count">${mission.progress}/${mission.target}</span>
    </div>
    <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div class="mission-reward"><span class="reward-label">REWARD</span>${rewards}<span class="done-badge">COMPLETE ✓</span></div>
  </div>`;
}

/** A tile in the start screen's locker showing how many of an item you own. */
function lockerTile(id, inventory) {
  const item = ITEMS[id];
  const boost = inventory.active[id];
  const status = item.comingSoon ? 'SOON' : boost ? `${boost.shotsLeft} left` : `×${inventory.count(id)}`;
  const empty = !boost && (inventory.count(id) === 0 || item.comingSoon) ? ' empty' : '';
  return `<div class="locker-tile${empty}" title="${item.desc}">
    ${itemIcon(id)}
    <span class="locker-name">${item.name}</span>
    <span class="locker-desc">${item.desc}</span>
    <span class="locker-count">${status}</span>
  </div>`;
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}
