/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Everything drawn with regular HTML instead of the canvas:
 * the HUD (score, timer, streak), start screen, countdown, game-over screen,
 * the "swipe up" hint and the mute button.
 *
 * The HTML lives in index.html and the styling in style.css. This file just
 * shows/hides pieces and updates their text.
 */

import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

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
      startBest: $('start-best'),
      gameOver: $('gameover-screen'),
      finalScore: $('final-score'),
      newBest: $('new-best'),
      statBest: $('stat-best'),
      statMakes: $('stat-makes'),
      statAccuracy: $('stat-accuracy'),
      statSwishes: $('stat-swishes'),
      statStreak: $('stat-streak'),
      muteBtn: $('mute-btn'),
    };
    // Remember what's on screen so we only touch the page when something changes
    this.shown = {};
  }

  /** Connect the Play / Play Again buttons. */
  onPlay(callback) {
    $('play-btn').addEventListener('click', callback);
    $('again-btn').addEventListener('click', callback);
  }

  onMute(callback) {
    this.el.muteBtn.addEventListener('click', callback);
  }

  setMuted(muted) {
    this.el.muteBtn.classList.toggle('muted', muted);
    this.el.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  // --- Screens ---------------------------------------------------------------

  showStart(best) {
    this.el.startBest.textContent = best;
    show(this.el.startScreen);
    hide(this.el.gameOver);
    hide(this.el.hud);
  }

  /** Hide menus and show the in-game HUD. */
  showGame() {
    hide(this.el.startScreen);
    hide(this.el.gameOver);
    show(this.el.hud);
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

  showGameOver(stats) {
    const e = this.el;
    e.finalScore.textContent = stats.score;
    e.statBest.textContent = stats.best;
    e.statMakes.textContent = `${stats.makes}/${stats.shots}`;
    e.statAccuracy.textContent = stats.shots ? `${Math.round((stats.makes / stats.shots) * 100)}%` : '–';
    e.statSwishes.textContent = stats.swishes;
    e.statStreak.textContent = stats.bestStreak;
    e.newBest.classList.toggle('hidden', !stats.isNewBest);
    hide(e.hud);
    hide(e.hint);
    show(e.gameOver);
  }

  // --- HUD ---------------------------------------------------------------------

  /** Called every frame; only updates the page when a value actually changes. */
  updateHUD({ score, timeLeft, streak, best, onFire }) {
    const seconds = Math.ceil(timeLeft);
    this.setText('score', score);
    this.setText('bestSmall', `BEST ${Math.max(best, score)}`);
    this.setText('timer', seconds);
    this.el.timer.classList.toggle('low', seconds <= 10);

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

  setText(key, value) {
    if (this.shown[key] === value) return;
    this.shown[key] = value;
    this.el[key].textContent = value;
  }
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}
