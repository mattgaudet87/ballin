/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Everything drawn with regular HTML instead of the canvas:
 *   - menu screens: home, Hot Hand hub (missions + locker), friends setup,
 *     pass-the-phone handoff, friends results, game over
 *   - the reward popup
 *   - the in-game HUD, "swipe up" hint and power-up trays
 *   - the mute button
 *
 * The HTML skeleton lives in index.html and the styling in style.css. This
 * file shows/hides pieces and fills in their content. It never changes game
 * state itself — it just calls the callbacks main.js gives it.
 */
import { CONFIG } from './config.js';
import { ITEMS, BALL_IDS, DRINK_IDS } from './items.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

/** Menu screens by name (only one is visible at a time). */
const SCREENS = {
  home: 'home-screen',
  hothand: 'hothand-screen',
  friends: 'friends-screen',
  handoff: 'handoff-screen',
  results: 'results-screen',
  gameover: 'gameover-screen',
};

/** Small HTML icon for an item (drawn with CSS, see "Item icons" in style.css). */
export function itemIcon(id) {
  const shape = ITEMS[id].type === 'ball' ? 'icon-ball' : 'icon-can';
  return `<span class="icon ${shape} ${id}" aria-hidden="true"></span>`;
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      hudLabel: $('hud-label'),
      score: $('score'),
      bestSmall: $('best-small'),
      lifetimeSmall: $('lifetime-small'),
      timer: $('timer'),
      streak: $('streak'),
      hint: $('hint'),
      hubMissions: $('hub-missions'),
      locker: $('locker'),
      gameOverTitle: $('gameover-title'),
      finalScore: $('final-score'),
      newBest: $('new-best'),
      statBest: $('stat-best'),
      statLifetime: $('stat-lifetime'),
      statMakes: $('stat-makes'),
      statAccuracy: $('stat-accuracy'),
      statSwishes: $('stat-swishes'),
      statStreak: $('stat-streak'),
      gameOverMissionsBlock: $('gameover-missions-block'),
      gameOverMissions: $('gameover-missions'),
      handoffRound: $('handoff-round'),
      handoffName: $('handoff-name'),
      handoffScores: $('handoff-scores'),
      resultsWinner: $('results-winner'),
      resultsTable: $('results-table'),
      rewardPopup: $('reward-popup'),
      rewardItems: $('reward-items'),
      ballTray: $('ball-tray'),
      drinkTray: $('drink-tray'),
      muteBtn: $('mute-btn'),
      tapStart: $('tap-start'),
      tapStartMode: $('tap-start-mode'),
      lockerTitle: $('locker-title'),
    };
    // Remember what's on screen so we only touch the page when something changes
    this.shown = {};
  }

  // --- Wiring up buttons ---------------------------------------------------------

  /** callback(modeId) when a mode card on the home screen is tapped. */
  onModeSelect(callback) {
    $$('.mode-card').forEach((card) => card.addEventListener('click', () => callback(card.dataset.mode)));
  }

  /** callback(difficultyId) when any difficulty picker is tapped. */
  onDifficulty(callback) {
    $$('[data-difficulty]').forEach((btn) => btn.addEventListener('click', () => callback(btn.dataset.difficulty)));
  }

  /** Back arrows (on the Hot Hand and friends screens) and "Menu" buttons. */
  onHome(callback) {
    $$('[data-back], [data-home], #menu-btn').forEach((btn) => btn.addEventListener('click', callback));
  }

  onHotHandPlay(callback) {
    $('hothand-play-btn').addEventListener('click', callback);
  }

  /** callback([name1, name2]) when the friends match starts. */
  onFriendsStart(callback) {
    $('friends-start-btn').addEventListener('click', () => {
      callback([$('player1-name').value.trim() || 'Player 1', $('player2-name').value.trim() || 'Player 2']);
    });
  }

  onHandoffReady(callback) {
    $('handoff-ready-btn').addEventListener('click', callback);
  }

  onRematch(callback) {
    $('rematch-btn').addEventListener('click', callback);
  }

  onPlayAgain(callback) {
    $('again-btn').addEventListener('click', callback);
  }

  /** callback(missionIndex) when a "Collect reward" button is tapped. */
  onCollect(callback) {
    for (const list of [this.el.hubMissions, this.el.gameOverMissions]) {
      list.addEventListener('click', (e) => {
        const button = e.target.closest('[data-collect]');
        if (button) callback(Number(button.dataset.collect));
      });
    }
  }

  /** The "Tap to start" screen was tapped. */
  onTapToStart(callback) {
    this.el.tapStart.addEventListener('click', callback);
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

  // --- Screens ---------------------------------------------------------------------

  /** Show one menu screen by name (see SCREENS), or none with null. */
  showScreen(name) {
    for (const [key, id] of Object.entries(SCREENS)) {
      $(id).classList.toggle('hidden', key !== name);
    }
    if (name) {
      $(SCREENS[name]).scrollTop = 0;
      this.hideGameHUD();
    }
  }

  /** Is this menu screen currently visible? */
  isShowing(name) {
    return !$(SCREENS[name]).classList.contains('hidden');
  }

  /** Each difficulty has its own locker, so say which one this is. */
  setLockerTitle(difficultyName) {
    this.el.lockerTitle.textContent = `${difficultyName} locker`;
  }

  /** Highlight the chosen difficulty in every picker. */
  setDifficulty(id) {
    $$('[data-difficulty]').forEach((btn) => btn.classList.toggle('selected', btn.dataset.difficulty === id));
  }

  /**
   * Fill in best scores and lifetime basket counts wherever they appear.
   * @param bests     { blitz: 12, hothand: 30 } for the current difficulty
   * @param lifetime  { blitz: 200, hothand: 90, friends: 40 }
   */
  setRecords(bests, lifetime) {
    $$('[data-best]').forEach((el) => (el.textContent = bests[el.dataset.best] ?? 0));
    $$('[data-lifetime]').forEach((el) => (el.textContent = lifetime[el.dataset.lifetime] ?? 0));
  }

  /** Fill the Hot Hand hub's missions and locker. */
  renderHotHandHub(missions, inventory) {
    this.el.hubMissions.innerHTML = missions.map((m, i) => missionCard(m, i)).join('');
    this.el.locker.innerHTML = [...BALL_IDS, ...DRINK_IDS].map((id) => lockerTile(id, inventory)).join('');
  }

  setPlayerNames(names) {
    $('player1-name').value = names[0] ?? '';
    $('player2-name').value = names[1] ?? '';
  }

  /** Pass-the-phone screen between Blitz with Friends rounds. */
  showHandoff({ round, totalRounds, name, players }) {
    this.el.handoffRound.textContent = `ROUND ${round} OF ${totalRounds}`;
    this.el.handoffName.textContent = name;
    this.el.handoffScores.innerHTML = scoreboard(players, false);
    this.showScreen('handoff');
  }

  /** Final Blitz with Friends results. */
  showResults({ players }) {
    const top = Math.max(...players.map((p) => p.total));
    const winners = players.filter((p) => p.total === top);
    this.el.resultsWinner.textContent = winners.length > 1 ? 'It’s a tie!' : `${winners[0].name} wins!`;
    this.el.resultsTable.innerHTML = scoreboard(players, true);
    this.showScreen('results');
  }

  /**
   * @param stats.title     headline, e.g. "TIME'S UP"
   * @param stats.missions  (Hot Hand only) mission views + results to animate
   */
  showGameOver(stats) {
    const e = this.el;
    e.gameOverTitle.textContent = stats.title;
    e.finalScore.textContent = stats.score;
    e.statBest.textContent = stats.best;
    e.statLifetime.textContent = stats.lifetime;
    e.statMakes.textContent = `${stats.makes}/${stats.shots}`;
    e.statAccuracy.textContent = stats.shots ? `${Math.round((stats.makes / stats.shots) * 100)}%` : '–';
    e.statSwishes.textContent = stats.swishes;
    e.statStreak.textContent = stats.bestStreak;
    e.newBest.classList.toggle('hidden', !stats.isNewBest);

    e.gameOverMissionsBlock.classList.toggle('hidden', !stats.missions);
    if (stats.missions) {
      const { views, results } = stats.missions;
      // Start the bars at their old progress, then fill them up.
      e.gameOverMissions.innerHTML = views
        .map((m, i) => missionCard({ ...m, progress: results[i].before, completed: m.completed && !results[i].justCompleted }, i))
        .join('');
      setTimeout(() => this.animateMissions(views, results), 350);
    }
    this.showScreen('gameover');
  }

  /** Re-draw the game-over missions without animation (after collecting one). */
  renderGameOverMissions(views) {
    this.el.gameOverMissions.innerHTML = views.map((m, i) => missionCard(m, i)).join('');
  }

  animateMissions(views, results) {
    this.el.gameOverMissions.querySelectorAll('.mission').forEach((card, i) => {
      const m = views[i];
      card.querySelector('.bar-fill').style.width = `${(m.progress / m.target) * 100}%`;
      card.querySelector('.mission-count').textContent = `${m.progress}/${m.target}`;
      if (results[i].after > results[i].before) card.classList.add('gained');
      if (m.completed) card.classList.add('done');
    });
  }

  /**
   * Reveal what a mission gave you. Tapping anywhere closes it and then
   * calls onClose (which adds the items to the locker).
   */
  showRewardPopup(items, onClose) {
    const popup = this.el.rewardPopup;
    this.el.rewardItems.innerHTML = items
      .map((id, i) => `<div class="reward-item" style="animation-delay:${0.15 + i * 0.18}s">${itemIcon(id)}<span>${ITEMS[id].name}</span><small>${ITEMS[id].desc}</small></div>`)
      .join('');
    popup.classList.remove('hidden');
    const close = () => {
      popup.classList.add('hidden');
      popup.removeEventListener('click', close);
      onClose();
    };
    // Wait a moment so the tap that opened it doesn't instantly close it
    setTimeout(() => popup.addEventListener('click', close), 400);
  }

  // --- In game -------------------------------------------------------------------

  /** Hide menus and show the in-game HUD (and power-up trays if this mode has them). */
  showGame({ powerUps }) {
    this.showScreen(null);
    show(this.el.hud);
    this.el.ballTray.classList.toggle('hidden', !powerUps);
    this.el.drinkTray.classList.toggle('hidden', !powerUps);
    this.shown = {};
  }

  /** Show the "Tap to start" screen over the court, e.g. "Hot Hand · Easy". */
  showTapToStart(label) {
    this.el.tapStartMode.textContent = label.toUpperCase();
    show(this.el.tapStart);
  }

  hideTapToStart() {
    hide(this.el.tapStart);
  }

  hideGameHUD() {
    hide(this.el.tapStart);
    hide(this.el.hud);
    hide(this.el.hint);
    hide(this.el.ballTray);
    hide(this.el.drinkTray);
    this.shown = {};
  }

  /**
   * Called every frame; only updates the page when a value actually changes.
   * @param label   small text above the score ("SCORE" or a player's name)
   * @param sub     line under the score ("BEST 12" or "ROUND 1 OF 2")
   * @param center  what shows in the middle pill (seconds left, or the run count)
   */
  updateHUD({ label, score, sub, lifetime, center, lowTime, streak, onFire }) {
    this.setText('hudLabel', label);
    this.setText('score', score);
    this.setText('bestSmall', sub);
    this.setText('lifetimeSmall', `🏀 ${lifetime}`);
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

  setText(key, value) {
    if (this.shown[key] === value) return;
    this.shown[key] = value;
    this.el[key].textContent = value;
  }
}

// --- HTML builders -------------------------------------------------------------------

/**
 * A mission card: description, progress bar, and — once complete — a big
 * green "Collect reward" button. The reward itself stays a surprise.
 */
function missionCard(mission, index) {
  const pct = Math.min(100, (mission.progress / mission.target) * 100);
  return `<div class="mission${mission.completed ? ' done' : ''}">
    <div class="mission-top">
      <span class="mission-text">${mission.text}</span>
      <span class="mission-count">${mission.progress}/${mission.target}</span>
    </div>
    <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    <button type="button" class="collect-btn" data-collect="${index}">🎁 COLLECT REWARD</button>
  </div>`;
}

/** A tile in the locker showing how many of an item you own. */
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

/** Blitz with Friends scores. `final` adds the per-round breakdown. */
function scoreboard(players, final) {
  return players
    .map((p) => {
      const rounds = final ? `<span class="rounds">${p.rounds.map((r) => `<i>${r}</i>`).join('')}</span>` : '';
      return `<div class="score-row"><span class="who">${escapeHtml(p.name)}</span>${rounds}<b>${p.total}</b></div>`;
    })
    .join('');
}

/** Player names are typed by users, so make sure they can't inject HTML. */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}
