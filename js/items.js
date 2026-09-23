/**
 * items.js
 * ---------------------------------------------------------------------------
 * Power-ups the player earns from missions, and the Inventory that stores them.
 *
 *   Specialty balls: used for ONE shot and multiply that shot's points.
 *                    Selecting one loads it as your next ball; it's used up
 *                    when you shoot (make or miss).
 *   Energy drinks:   last for several SHOTS once activated. You can run one of
 *                    each kind at the same time. If a game ends mid-boost, the
 *                    remaining shots carry over to your next game.
 *
 * To add an item: add it to ITEMS (and to BALL_IDS or DRINK_IDS), add its
 * effect in Inventory.startShot() / main.js, and give it an icon in style.css.
 */
import { CONFIG } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

export const ITEMS = {
  gold: { type: 'ball', name: 'Gold Ball', multiplier: 3, desc: '3× points on one shot' },
  silver: { type: 'ball', name: 'Silver Ball', multiplier: 2, desc: '2× points on one shot' },
  bronze: { type: 'ball', name: 'Bronze Ball', multiplier: 1.5, desc: '1.5× points on one shot' },

  white: { type: 'drink', name: 'White Monster', shots: 10, desc: 'Bigger hoop for 10 shots' },
  green: { type: 'drink', name: 'Green Monster', shots: 10, desc: 'Multiplier climbs every shot for 10 shots' },
  orange: { type: 'drink', name: 'Orange Monster', shots: 10, desc: 'Moving hoop 25% slower for 10 shots' },
  blue: { type: 'drink', name: 'Blue Monster', shots: 10, desc: 'Coin booster — coming soon', comingSoon: true },
};

export const BALL_IDS = ['gold', 'silver', 'bronze'];
export const DRINK_IDS = ['white', 'green', 'orange', 'blue'];

/** Drink effect strengths */
export const DRINK_EFFECTS = {
  bigHoopScale: 1.3, // White: rim radius × this
  greenStep: 0.2, // Green: shot 1 = 1.2×, shot 2 = 1.4× ... shot 10 = 3×
  slowHoopFactor: 0.75, // Orange: moving hoop speed × this
};

/** What a brand-new player starts with, so they can discover power-ups. */
const STARTER_PACK = { bronze: 1, white: 1, green: 1 };

export class Inventory {
  constructor() {
    const saved = loadJSON(CONFIG.storageKeys.inventory, null);
    this.counts = {};
    for (const id of Object.keys(ITEMS)) this.counts[id] = saved?.counts?.[id] ?? STARTER_PACK[id] ?? 0;
    // Active drinks: { white: { shotsLeft: 7, used: 3 }, ... }
    this.active = saved?.active ?? {};
    this.selectedBall = null; // id of the specialty ball loaded for the next shot
    if (!saved) this.save();
  }

  save() {
    saveJSON(CONFIG.storageKeys.inventory, { counts: this.counts, active: this.active });
  }

  count(id) {
    return this.counts[id] ?? 0;
  }

  add(id, amount = 1) {
    this.counts[id] = this.count(id) + amount;
    this.save();
  }

  isActive(id) {
    return Boolean(this.active[id]);
  }

  /** Load (or unload) a specialty ball for the next shot. */
  toggleBall(id) {
    if (this.selectedBall === id) this.selectedBall = null;
    else if (this.count(id) > 0) this.selectedBall = id;
    return this.selectedBall;
  }

  /** Crack open an energy drink. Returns true if it was activated. */
  activateDrink(id) {
    const item = ITEMS[id];
    if (!item || item.comingSoon || this.isActive(id) || this.count(id) <= 0) return false;
    this.counts[id]--;
    this.active[id] = { shotsLeft: item.shots, used: 0 };
    this.save();
    return true;
  }

  /**
   * Called when the player shoots. Uses up the loaded ball and one shot of
   * every active drink, and returns a snapshot of what THIS shot gets.
   */
  startShot() {
    const shot = {
      ball: this.selectedBall, // 'gold' | 'silver' | 'bronze' | null
      ballMultiplier: this.selectedBall ? ITEMS[this.selectedBall].multiplier : 1,
      bigHoop: this.isActive('white'),
      slowHoop: this.isActive('orange'),
      greenMultiplier: 1,
      itemsUsed: this.selectedBall ? 1 : 0,
    };
    if (this.selectedBall) {
      this.counts[this.selectedBall]--;
      this.selectedBall = null;
    }
    if (this.active.green) {
      shot.greenMultiplier = 1 + DRINK_EFFECTS.greenStep * (this.active.green.used + 1);
    }
    for (const id of Object.keys(this.active)) {
      const boost = this.active[id];
      boost.used++;
      boost.shotsLeft--;
      if (boost.shotsLeft <= 0) delete this.active[id];
    }
    this.save();
    return shot;
  }
}
