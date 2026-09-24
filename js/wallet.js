/**
 * wallet.js
 * ---------------------------------------------------------------------------
 * Coins, and what you can buy with them on the Customize screen:
 *   ball    — ball styles (BALL_STYLES, below)
 *   stadium — stadiums (COURT_THEMES in court.js)
 *   floor   — floor surfaces (FLOORS in court.js)
 * Everything with price 0 is free and always yours.
 *
 * How coins are counted:
 *   earned — every coin grabbed in a game (only ever goes UP)
 *   spent  — every coin spent in the Shop (only ever goes UP)
 *   bonus  — coins the SERVER gave you for winning online challenges
 *   balance = earned + bonus − spent
 * Because all three only grow, syncing with your account (see syncScores()
 * in main.js) simply keeps the higher number of each, the same way best
 * scores work. Owned things are merged the same way (you keep all of them).
 * They're saved as one list of ids: a ball style is just its id ('ice'),
 * anything else is 'kind:id' ('stadium:inferno', 'floor:glass').
 *
 * Ball styles are just looks: they change the colors of your ball in every
 * mode and don't change how it plays. Specialty balls (Gold, Silver, Bronze)
 * still show their own colors while they're loaded.
 *
 * To add a ball style: add it to BALL_STYLES (colors = [highlight, middle, edge]
 * of the ball, seam = the line color). The Balls tab and the ball drawing pick it up.
 */
import { CONFIG } from './config.js';
import { loadJSON, saveJSON } from './storage.js';
import { COURT_THEMES, FLOORS } from './court.js';

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

/** Everything for sale, by kind. Each entry has a `name` and a `price`. */
export const CATALOG = { ball: BALL_STYLES, stadium: COURT_THEMES, floor: FLOORS };

/** The id saved in the owned list: 'ice' for a ball style, 'stadium:inferno' for the rest. */
function ownedKey(kind, id) {
  return kind === 'ball' ? id : `${kind}:${id}`;
}

/** One thing from the catalog, or null. (hasOwn so ids like 'constructor' don't count.) */
export function catalogItem(kind, id) {
  return Object.hasOwn(CATALOG, kind) && Object.hasOwn(CATALOG[kind], id) ? CATALOG[kind][id] : null;
}

/** Is this a real thing from the catalog? (Used to clean saved and uploaded lists.) */
export function isOwnedKey(key) {
  const [kind, id] = key.includes(':') ? key.split(':') : ['ball', key];
  return Boolean(catalogItem(kind, id));
}

export class Wallet {
  constructor() {
    const saved = loadJSON(CONFIG.storageKeys.wallet, null);
    this.earned = saved?.earned ?? 0;
    this.spent = saved?.spent ?? 0;
    this.bonus = saved?.bonus ?? 0;
    this.owned = new Set((saved?.owned ?? []).filter(isOwnedKey));
    this.equipped = this.owns('ball', saved?.equipped) ? saved.equipped : 'classic';
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

  /** Do you have it? kind = 'ball' | 'stadium' | 'floor'. Free things are always yours. */
  owns(kind, id) {
    const item = catalogItem(kind, id);
    return Boolean(item) && (item.price === 0 || this.owned.has(ownedKey(kind, id)));
  }

  /** Buy something (a ball style is also put on). Returns false if you can't afford it. */
  buy(kind, id) {
    const item = catalogItem(kind, id);
    if (!item || this.owns(kind, id) || this.balance < item.price) return false;
    this.spent += item.price;
    this.owned.add(ownedKey(kind, id));
    if (kind === 'ball') this.equipped = id;
    this.save();
    return true;
  }

  /** Give something for free (a court picked before stadiums cost coins). */
  grant(kind, id) {
    if (!catalogItem(kind, id) || this.owns(kind, id)) return;
    this.owned.add(ownedKey(kind, id));
    this.save();
  }

  /** Use a ball style you already own. */
  equip(id) {
    if (!this.owns('ball', id)) return;
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
    const owned = (saved.owned ?? []).filter(isOwnedKey);
    this.owned = new Set([...(replace ? [] : this.owned), ...owned]);
    if (!this.owns('ball', this.equipped)) this.equipped = 'classic';
    this.save();
  }
}
