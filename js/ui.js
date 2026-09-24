/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Everything drawn with regular HTML instead of the canvas:
 *   - menu screens: home, Shop (ball styles), Hot Hand hub (missions + locker), Blitz with
 *     Friends (pass-and-play names, or online: login, challenges, friends),
 *     a friend's page, pass-the-phone handoff, friends results, game over
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
import { BALL_STYLES, STYLE_IDS } from './wallet.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

/** Menu screens by name (only one is visible at a time). */
const SCREENS = {
  home: 'home-screen',
  shop: 'shop-screen',
  hothand: 'hothand-screen',
  friends: 'friends-screen',
  friend: 'friend-screen',
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
      coinsSmall: $('coins-small'),
      coinTotal: $('coin-total'),
      shopCoins: $('shop-coins'),
      shopList: $('shop-list'),
      shopNote: $('shop-note'),
      statCoinsWrap: $('stat-coins-wrap'),
      statCoins: $('stat-coins'),
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
      leaveBtn: $('leave-btn'),
      tapStart: $('tap-start'),
      tapStartMode: $('tap-start-mode'),
      lockerTitle: $('locker-title'),
      gameOverNote: $('gameover-note'),
      againBtn: $('again-btn'),
      friendsBadge: $('friends-badge'),
      onlineTabBadge: $('online-tab-badge'),
      localPanel: $('local-panel'),
      onlinePanel: $('online-panel'),
      addFriendForm: $('add-friend-form'),
      friendAvatar: $('friend-avatar'),
      friendName: $('friend-name'),
      friendSub: $('friend-sub'),
      friendBody: $('friend-body'),
      authForm: $('auth-form'),
      authError: $('auth-error'),
      accountBlock: $('account-block'),
      accountName: $('account-name'),
      challengeList: $('challenge-list'),
      friendList: $('friend-list'),
      onlineError: $('online-error'),
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

  /** The coins button on the home screen. */
  onShop(callback) {
    $('shop-btn').addEventListener('click', callback);
  }

  /** callback(styleId) when a ball in the Shop is tapped. */
  onShopItem(callback) {
    this.el.shopList.addEventListener('click', (e) => {
      const button = e.target.closest('[data-style]');
      if (button) callback(button.dataset.style);
    });
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

  // --- Online screen buttons ---

  /** callback('login' | 'signup', username, password) */
  onAuth(callback) {
    const send = (action) => callback(action, $('auth-username').value.trim(), $('auth-password').value);
    // Pressing Enter in the form counts as LOG IN
    this.el.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      send('login');
    });
    $('signup-btn').addEventListener('click', () => send('signup'));
  }

  onLogout(callback) {
    $('logout-btn').addEventListener('click', callback);
  }

  /**
   * "+ Add friend" opens a small form; callback(username, done) when it's sent.
   * Call done() once the friend was added to close the form again.
   */
  onAddFriend(callback) {
    const form = this.el.addFriendForm;
    const input = $('friend-username');
    $('add-friend-btn').addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) input.focus();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      callback(name, () => {
        input.value = '';
        form.classList.add('hidden');
      });
    });
  }

  /** callback('local' | 'online') when a Blitz with Friends tab is tapped. */
  onFriendsTab(callback) {
    $$('[data-tab]').forEach((tab) => tab.addEventListener('click', () => callback(tab.dataset.tab)));
  }

  /** Show the Pass and play or Online part of the Blitz with Friends screen. */
  setFriendsTab(tab) {
    $$('[data-tab]').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.tab === tab);
      btn.setAttribute('aria-selected', btn.dataset.tab === tab);
    });
    this.el.localPanel.classList.toggle('hidden', tab !== 'local');
    this.el.onlinePanel.classList.toggle('hidden', tab !== 'online');
  }

  /** The friend page's buttons. handlers: { back(), challenge(), remove() } */
  onFriendPage(handlers) {
    $('friend-back-btn').addEventListener('click', handlers.back);
    $('friend-challenge-btn').addEventListener('click', handlers.challenge);
    $('friend-remove-btn').addEventListener('click', handlers.remove);
  }

  /**
   * Buttons inside the friend and challenge lists.
   * handlers: { friend(name), challenge(name), play(id), decline(id) }
   */
  onOnlineList(handlers) {
    for (const list of [this.el.friendList, this.el.challengeList]) {
      list.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (button) handlers[button.dataset.action](button.dataset.value);
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

  /** The LEAVE button in the corner during a game (END in Free Throw). */
  onLeave(callback) {
    this.el.leaveBtn.addEventListener('click', callback);
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
   * @param lifetime  { blitz: 200, hothand: 90, friends: 40 } for the current difficulty
   * @param total     every basket ever made (all modes and difficulties)
   */
  setRecords(bests, lifetime, total) {
    $$('[data-best]').forEach((el) => (el.textContent = bests[el.dataset.best] ?? 0));
    $$('[data-lifetime]').forEach((el) => (el.textContent = lifetime[el.dataset.lifetime] ?? 0));
    $('lifetime-total').textContent = total.toLocaleString();
  }

  /** Your coin balance on the home screen's Shop button. */
  setCoins(balance) {
    this.el.coinTotal.textContent = balance.toLocaleString();
  }

  /**
   * Fill the Shop: every ball style with its price, or OWNED / IN USE.
   * `note` is an optional message (e.g. "You need 40 more coins").
   */
  renderShop(wallet, note = null) {
    this.el.shopCoins.textContent = wallet.balance.toLocaleString();
    showMessage(this.el.shopNote, note);
    this.el.shopList.innerHTML = STYLE_IDS.map((id) => shopCard(id, wallet)).join('');
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
   * @param stats.note      optional line under the score (online challenges)
   * @param stats.againLabel text on the right-hand button (default "PLAY AGAIN")
   */
  showGameOver(stats) {
    const e = this.el;
    e.gameOverTitle.textContent = stats.title;
    showMessage(e.gameOverNote, stats.note ?? null);
    e.againBtn.textContent = stats.againLabel ?? 'PLAY AGAIN';
    e.finalScore.textContent = stats.score;
    e.statBest.textContent = stats.best;
    e.statLifetime.textContent = stats.lifetime;
    e.statMakes.textContent = `${stats.makes}/${stats.shots}`;
    e.statAccuracy.textContent = stats.shots ? `${Math.round((stats.makes / stats.shots) * 100)}%` : '–';
    e.statSwishes.textContent = stats.swishes;
    e.statStreak.textContent = stats.bestStreak;
    e.newBest.classList.toggle('hidden', !stats.isNewBest);
    this.setGameOverCoins(stats.coins ?? 0);

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

  // --- Online ------------------------------------------------------------------------

  /** Red "your turn" counters on the Blitz with Friends card and the Online tab. */
  setOnlineStatus(yourTurnCount = 0) {
    for (const badge of [this.el.friendsBadge, this.el.onlineTabBadge]) {
      badge.textContent = yourTurnCount;
      badge.classList.toggle('hidden', !yourTurnCount);
    }
    this.el.friendsBadge.textContent = `${yourTurnCount} YOUR TURN`;
  }

  /**
   * Fill the Online screen.
   * @param view.username    null when logged out (shows the login form)
   * @param view.friends     from Online.friends(), or null while loading
   * @param view.challenges  from Online.challenges(), or null while loading
   */
  renderOnline({ username, friends, challenges }) {
    const e = this.el;
    e.authForm.classList.toggle('hidden', !!username);
    e.accountBlock.classList.toggle('hidden', !username);
    if (!username) return;

    e.accountName.textContent = username;
    const loading = '<p class="list-empty">Loading…</p>';
    // Open challenges, plus the last few results (the full history is on each friend's page)
    const open = challenges?.filter((c) => c.status === 'yourTurn' || c.status === 'waiting') ?? [];
    const recent = challenges?.filter((c) => !open.includes(c)).slice(0, RECENT_RESULTS) ?? [];
    e.challengeList.innerHTML = !challenges
      ? loading
      : challenges.length
        ? [...open, ...recent].map(challengeRow).join('')
        : '<p class="list-empty">No challenges yet. Challenge a friend above!</p>';
    e.friendList.innerHTML = !friends
      ? loading
      : friends.length
        ? friends.map(friendRow).join('')
        : '<p class="list-empty">No friends yet. Add one by their username.</p>';
  }

  /**
   * Fill a friend's page. `friend` is null while it loads.
   * friend = { username, bests, baskets, record: { wins, losses, ties }, games }
   */
  renderFriend(username, friend, difficulty) {
    const e = this.el;
    e.friendAvatar.textContent = username[0].toUpperCase();
    e.friendName.textContent = username;
    if (!friend) {
      e.friendSub.textContent = 'Loading…';
      e.friendBody.innerHTML = '';
      return;
    }
    const { wins, losses, ties } = friend.record;
    const played = friend.games.filter((g) => ['won', 'lost', 'tie'].includes(g.status));
    e.friendSub.textContent = `🏀 ${friend.baskets.toLocaleString()} lifetime baskets`;
    e.friendBody.innerHTML = friendPage(friend, { wins, losses, ties, played }, difficulty);
  }

  /** Show an error under the login form (or hide it with null). */
  showAuthError(message) {
    showMessage(this.el.authError, message);
  }

  /** Show an error on the logged-in part of the Online screen (or hide it with null). */
  showOnlineError(message) {
    showMessage(this.el.onlineError, message);
  }

  /** Coins earned this game, next to BEST on the game over screen (hidden when 0). */
  setGameOverCoins(coins) {
    this.el.statCoins.textContent = `+${coins}`;
    this.el.statCoinsWrap.classList.toggle('hidden', !coins);
  }

  /** Update the line under the score on the game over screen (online results). */
  setGameOverNote(text) {
    showMessage(this.el.gameOverNote, text);
  }

  /** Change the right-hand game over button, e.g. to "RETRY". */
  setAgainLabel(text) {
    this.el.againBtn.textContent = text;
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
    hide(this.el.leaveBtn);
    this.shown = {};
  }

  /**
   * Called every frame; only updates the page when a value actually changes.
   * @param label   small text above the score ("SCORE" or a player's name)
   * @param sub     line under the score ("BEST 12" or "ROUND 1 OF 2")
   * @param center  what shows in the middle pill (seconds left, or the run count)
   * @param leaveLabel text on the corner button ("✕ LEAVE", or "END" in Free Throw)
   * @param coins   your coin balance
   */
  updateHUD({ label, score, sub, lifetime, center, lowTime, streak, onFire, leaveLabel, coins }) {
    this.setText('hudLabel', label);
    this.setText('score', score);
    this.setText('bestSmall', sub);
    this.setText('lifetimeSmall', `🏀 ${lifetime}`);
    this.setText('coinsSmall', coins);
    this.setText('timer', center);
    this.el.timer.classList.toggle('low', lowTime);

    const streakText = onFire ? `🔥 ON FIRE ×${CONFIG.game.fireMultiplier}` : streak >= 2 ? `${streak} IN A ROW` : '';
    this.setText('streak', streakText);
    this.el.streak.classList.toggle('hidden', !streakText);
    this.el.streak.classList.toggle('fire', onFire);

    if (this.shown.leaveLabel !== leaveLabel) {
      this.shown.leaveLabel = leaveLabel;
      this.el.leaveBtn.textContent = leaveLabel;
      this.el.leaveBtn.classList.remove('hidden');
    }
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

/** A ball style in the Shop: a preview ball, its name, and the price or whether it's yours. */
function shopCard(id, wallet) {
  const style = BALL_STYLES[id];
  const owned = wallet.owns(id);
  const inUse = wallet.equipped === id;
  const tooMuch = !owned && wallet.balance < style.price;
  const status = inUse ? '✓ IN USE' : owned ? 'OWNED · TAP TO USE' : `<span class="mini-coin" aria-hidden="true"></span>${style.price.toLocaleString()}`;
  const [light, mid, edge] = style.colors ?? ['#ffb3b3', '#ff3d3d', '#6b0000']; // rainbow cycles in CSS
  const colors = `--light:${light};--mid:${mid};--edge:${edge};--seam:${style.seam}`;
  const classes = ['shop-card', inUse && 'in-use', owned && 'owned', tooMuch && 'locked'].filter(Boolean).join(' ');
  const ballClasses = ['shop-ball', style.glow && 'glow', style.rainbow && 'rainbow'].filter(Boolean).join(' ');
  return `<button type="button" class="${classes}" data-style="${id}">
    <span class="${ballClasses}" style="${colors}" aria-hidden="true"></span>
    <span class="shop-name">${style.name}</span>
    <span class="shop-price">${status}</span>
  </button>`;
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

const RECENT_RESULTS = 5; // finished challenges shown in the online list

/** Mode icons used for friends' best scores. */
const LEADERBOARD = [
  ['blitz', '⏱', 'Blitz'],
  ['hothand', '🔥', 'Hot Hand'],
  ['freethrow', '🎯', 'Free Throw'],
];

/** A friend: tap the name for their page, or Challenge them right away. */
function friendRow(friend) {
  const name = escapeHtml(friend.username);
  const { wins, losses, ties } = friend.record;
  const record = wins + losses + ties ? `${wins}W · ${losses}L${ties ? ` · ${ties}T` : ''} vs you` : 'No games yet';
  return `<div class="online-row friend">
    <button type="button" class="friend-open" data-action="friend" data-value="${name}" aria-label="${name}'s stats">
      <span class="avatar small" aria-hidden="true">${name[0].toUpperCase()}</span>
      <span class="online-who"><b>${name}</b><small>${record}</small></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>
    <button type="button" class="row-btn" data-action="challenge" data-value="${name}">CHALLENGE</button>
  </div>`;
}

/** The body of a friend's page: record, head-to-head numbers, their bests and game history. */
function friendPage(friend, { wins, losses, ties, played }, difficulty) {
  const avg = (list) => (list.length ? (list.reduce((sum, n) => sum + n, 0) / list.length).toFixed(1) : '–');
  const high = (list) => (list.length ? Math.max(...list) : '–');
  const mine = played.map((g) => g.myScore);
  const theirs = played.map((g) => g.theirScore);

  const recordTiles = `<div class="stats record">
    <div class="win"><span>${wins}</span><small>Wins</small></div>
    <div class="loss"><span>${losses}</span><small>Losses</small></div>
    <div><span>${ties}</span><small>Ties</small></div>
    <div><span>${wins + losses + ties}</span><small>Played</small></div>
  </div>`;

  const headToHead = played.length
    ? `<div class="h2h">
        <div class="h2h-row h2h-labels"><b>You</b><small>Head to head</small><b>${escapeHtml(friend.username)}</b></div>
        <div class="h2h-row"><span>${avg(mine)}</span><small>Average score</small><span>${avg(theirs)}</span></div>
        <div class="h2h-row"><span>${high(mine)}</span><small>Highest score</small><span>${high(theirs)}</span></div>
      </div>`
    : '';

  const diffName = difficulty[0].toUpperCase() + difficulty.slice(1);
  const bests = LEADERBOARD.map(
    ([mode, icon, label]) => `<div><span>${friend.bests[mode]?.[difficulty] ?? 0}</span><small>${icon} ${label}</small></div>`,
  ).join('');

  const history = friend.games.length
    ? friend.games.map(historyRow).join('')
    : '<p class="list-empty">You haven’t played each other yet. Send a challenge!</p>';

  return `${recordTiles}${headToHead}
    <h2 class="section-title">Their bests · ${diffName}</h2>
    <div class="stats three">${bests}</div>
    <h2 class="section-title">Game history</h2>
    <div class="online-list">${history}</div>`;
}

/** One line of a friend's game history. */
function historyRow(g) {
  const diff = g.difficulty[0].toUpperCase() + g.difficulty.slice(1);
  const date = new Date(g.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const results = {
    won: ['WIN', `${g.myScore}–${g.theirScore}`],
    lost: ['LOSS', `${g.myScore}–${g.theirScore}`],
    tie: ['TIE', `${g.myScore}–${g.theirScore}`],
    yourTurn: ['YOUR TURN', '–'],
    waiting: ['WAITING', `${g.myScore}–?`],
    declined: ['PASSED', '–'],
  };
  const [label, score] = results[g.status];
  return `<div class="online-row history ${g.status}">
    <span class="result-tag">${label}</span>
    <span class="online-who"><b>${score}</b><small>${diff} · ${date}</small></span>
  </div>`;
}

/** A challenge, described from your side. */
function challengeRow(c) {
  const name = escapeHtml(c.opponent);
  const diff = c.difficulty[0].toUpperCase() + c.difficulty.slice(1);
  const score = `${c.myScore}–${c.theirScore}`;
  const rows = {
    yourTurn: [`${name} challenged you`, `Your turn · ${diff}`,
      `<button type="button" class="row-btn go" data-action="play" data-value="${c.id}">PLAY</button>
       <button type="button" class="row-x" data-action="decline" data-value="${c.id}" aria-label="Decline">×</button>`],
    waiting: [`vs ${name}`, `You scored ${c.myScore} · waiting for them · ${diff}`, ''],
    won: [`You beat ${name}`, `${score} · ${diff} · +${CONFIG.coins.onlineWin} coins`, rematch(name)],
    lost: [`${name} beat you`, `${score} · ${diff}`, rematch(name)],
    tie: [`Tie with ${name}`, `${score} · ${diff}`, rematch(name)],
    declined: [`vs ${name}`, `They passed · ${diff}`, rematch(name)],
  };
  const [title, detail, buttons] = rows[c.status];
  return `<div class="online-row ${c.status}">
    <div class="online-who"><b>${title}</b><small>${detail}</small></div>${buttons}
  </div>`;
}

function rematch(name) {
  return `<button type="button" class="row-btn" data-action="challenge" data-value="${name}">REMATCH</button>`;
}

function showMessage(el, text) {
  el.textContent = text ?? '';
  el.classList.toggle('hidden', !text);
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
