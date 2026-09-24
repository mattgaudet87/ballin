/**
 * wallet.js
 * ---------------------------------------------------------------------------
 * Coins, and the ball styles you can buy with them in the Shop.
 *
 * How coins are counted:
 *   earned — every coin grabbed in a game (only ever goes UP)
 *   spent  — every coin spent in the Shop (only ever goes UP)
 *   bonus  — coins the SERVER gave you for winning online challenges
 *   balance = earned + bonus − spent
 * Because all three only grow, syncing with your account (see syncScores()
 * in main.js) simply keeps the higher number of each, the same way best
 * scores work. Owned ball styles are merged the same way (you keep all of them).
 *
 * Ball styles are just looks: they change the colors of your ball in every
 * mode and don't change how it plays. Specialty balls (Gold, Silver, Bronze)
 * still show their own colors while they're loaded.
 *
 * To add a ball style: add it to BALL_STYLES (colors = [highlight, middle, edge]
 * of the ball, seam = the line color). The Shop and the ball drawing pick it up.
 */
import { CONFIG } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

export const BALL_STYLES = {
  classic: { name: 'Classic', price: 0, colors: ['#ffae63', '#f2711c', '#a8420b'], seam: 'rgba(45, 20, 6, 0.9)' },
  street: { name: 'Street', price: 150, colors: ['#8a8f99', '#3a3d44', '#141518'], seam: '#ff7a1a' },
  ice: { name: 'Ice', price: 250, colors: ['#ffffff', '#9fdcff', '#2f7fc2'], seam: 'rgba(255, 255, 255, 0.95)' },
  neon: { name: 'Neon', price: 400, colors: ['#e6ffb0', '#7dff3a', '#1f8a12'], seam: 'rgba(10, 40, 5, 0.9)', glow: true },
  lava: { name: 'Lava', price: 600, colors: ['#ff8a3d', '#b01e0a', '#2a0503'], seam: '#ffd23f', glow: true },
  galaxy: { name: 'Galaxy', price: 900, colors: ['#d9a8ff', '#5b2bb5', '#12062e'], seam: '#ff7ae0', glow: true },
  // Rainbow's colors cycle while it's on screen (see Ball.draw)
  rainbow: { name: 'Rainbow', price: 1500, colors: null, seam: 'rgba(255, 255, 255, 0.9)', glow: true, rainbow: true },
};

export const STYLE_IDS = Object.keys(BALL_STYLES);

export class Wallet {
  constructor() {
    const saved = loadJSON(CONFIG.storageKeys.wallet, null);
    this.earned = saved?.earned ?? 0;
    this.spent = saved?.spent ?? 0;
    this.bonus = saved?.bonus ?? 0;
    this.owned = new Set(['classic', ...(saved?.owned ?? [])].filter((id) => BALL_STYLES[id]));
    this.equipped = this.owned.has(saved?.equipped) ? saved.equipped : 'classic';
  }

  save() {
    saveJSON(CONFIG.storageKeys.wallet, {
      earned: this.earned,
      spent: this.spent,
      bonus: this.bonus,
      owned: [...this.owned],
      equipped: this.equipped,
    });
  }

  /** Coins you can spend right now. */
  get balance() {
    return Math.max(0, this.earned + this.bonus - this.spent);
  }

  /** Coins picked up in a game. */
  add(amount) {
    this.earned += amount;
    this.save();
  }

  /** Coins the server gave you for an online win (it keeps its own count too). */
  addBonus(amount) {
    this.bonus += amount;
    this.save();
  }

  owns(id) {
    return this.owned.has(id);
  }

  /** Buy a ball style (and put it on). Returns false if you can't afford it. */
  buy(id) {
    const style = BALL_STYLES[id];
    if (!style || this.owns(id) || this.balance < style.price) return false;
    this.spent += style.price;
    this.owned.add(id);
    this.equipped = id;
    this.save();
    return true;
  }

  /** Use a ball style you already own. */
  equip(id) {
    if (!this.owns(id)) return;
    this.equipped = id;
    this.save();
  }

  /** What gets uploaded to your account. */
  toJSON() {
    return { earned: this.earned, spent: this.spent, owned: [...this.owned] };
  }

  /**
   * Take in what your account has saved. Normally we keep the higher of each
   * number; `replace` (a different account logged in on this device) takes the
   * account's numbers as they are.
   */
  merge(saved, replace = false) {
    const pick = (mine, theirs) => (replace ? theirs ?? 0 : Math.max(mine, theirs ?? 0));
    this.earned = pick(this.earned, saved.earned);
    this.spent = pick(this.spent, saved.spent);
    this.bonus = pick(this.bonus, saved.bonus);
    const owned = (saved.owned ?? []).filter((id) => BALL_STYLES[id]);
    this.owned = new Set(['classic', ...(replace ? [] : this.owned), ...owned]);
    if (!this.owned.has(this.equipped)) this.equipped = 'classic';
    this.save();
  }
}
