/**
 * missions.js
 * ---------------------------------------------------------------------------
 * Three active missions at all times. Missions are only shown between games
 * (start screen and game-over screen).
 *
 * Two kinds of mission:
 *   scope 'total' — progress ADDS UP over every game since the mission appeared
 *                   ("Score 30 points")
 *   scope 'game'  — must be done within ONE game ("Score 12 points in one game")
 *
 * After each game, main.js calls applyGame(stats). Finished missions pay out
 * their reward (items go straight into the Inventory) and are replaced with
 * fresh ones. Targets grow slowly as you complete more missions, so they
 * stay achievable but never boring.
 *
 * To add a mission type: add a template to TEMPLATES. Its `stat` must be a
 * key of the per-game stats object built in main.js (see gameStats()).
 */
import { CONFIG } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

const ACTIVE_COUNT = 3;

/**
 * range = [easiest, hardest] target before difficulty scaling.
 * `text` turns a target number into the mission description.
 */
const TEMPLATES = [
  { type: 'points_total', scope: 'total', stat: 'points', range: [15, 40], text: (n) => `Score ${n} points` },
  { type: 'points_game', scope: 'game', stat: 'points', range: [8, 20], text: (n) => `Score ${n} points in one game` },
  { type: 'makes_total', scope: 'total', stat: 'makes', range: [10, 25], text: (n) => `Make ${n} baskets` },
  { type: 'swishes_total', scope: 'total', stat: 'swishes', range: [3, 8], text: (n) => `Hit ${n} swishes` },
  { type: 'swishes_game', scope: 'game', stat: 'swishes', range: [2, 5], text: (n) => `Hit ${n} swishes in one game` },
  { type: 'streak_game', scope: 'game', stat: 'bestStreak', range: [4, 8], text: (n) => `Make ${n} in a row` },
  { type: 'fire_total', scope: 'total', stat: 'fireCount', range: [1, 3], text: (n) => (n === 1 ? 'Catch fire' : `Catch fire ${n} times`) },
  { type: 'bank_total', scope: 'total', stat: 'bankShots', range: [2, 5], text: (n) => `Bank in ${n} shots off the glass` },
  { type: 'hothand_run', scope: 'game', stat: 'hotHandMakes', range: [4, 10], text: (n) => `Make ${n} in one Hot Hand run` },
  { type: 'blitz_score', scope: 'game', stat: 'blitzPoints', range: [10, 22], text: (n) => `Score ${n} in one Blitz game` },
  { type: 'multiplier_total', scope: 'total', stat: 'bigMultiplierMakes', range: [1, 3], text: (n) => (n === 1 ? 'Sink a 3× or bigger basket' : `Sink ${n} baskets worth 3× or more`) },
  { type: 'games_total', scope: 'total', stat: 'games', range: [2, 4], text: (n) => `Play ${n} games` },
  { type: 'items_total', scope: 'total', stat: 'itemsUsed', range: [1, 3], text: (n) => (n === 1 ? 'Use a power-up' : `Use ${n} power-ups`) },
];

/** Reward item chances (bigger number = more common). */
const REWARD_WEIGHTS = { bronze: 30, white: 18, orange: 18, green: 14, silver: 14, gold: 6 };

function pickWeighted(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [id, w] of Object.entries(weights)) {
    if (roll < w) return id;
    roll -= w;
  }
  return Object.keys(weights)[0];
}

export class Missions {
  constructor() {
    const saved = loadJSON(CONFIG.storageKeys.missions, null);
    this.list = (saved?.list ?? []).filter((m) => TEMPLATES.some((t) => t.type === m.type));
    this.completedCount = saved?.completedCount ?? 0; // grows difficulty over time
    this.refill();
  }

  save() {
    saveJSON(CONFIG.storageKeys.missions, { list: this.list, completedCount: this.completedCount });
  }

  /**
   * Top the list back up to 3 missions (each a different type).
   * `skipTypes` avoids handing back a mission type the player just finished.
   */
  refill(skipTypes = []) {
    while (this.list.length < ACTIVE_COUNT) this.list.push(this.create(skipTypes));
    this.save();
  }

  /** Build a new random mission that isn't already active. */
  create(skipTypes = []) {
    const taken = new Set([...skipTypes, ...this.list.map((m) => m.type)]);
    const options = TEMPLATES.filter((t) => !taken.has(t.type));
    const template = options[Math.floor(Math.random() * options.length)];

    // Roll a difficulty (0 = easiest, 1 = hardest), then scale up slowly with experience.
    const difficulty = Math.random();
    const growth = 1 + Math.min(this.completedCount, 30) * 0.04;
    const [lo, hi] = template.range;
    const target = Math.max(1, Math.round((lo + (hi - lo) * difficulty) * growth));

    // Harder missions pay more: 1, 2 or 3 items
    const rewardCount = difficulty < 0.4 ? 1 : difficulty < 0.8 ? 2 : 3;
    const reward = Array.from({ length: rewardCount }, () => pickWeighted(REWARD_WEIGHTS));

    return { type: template.type, target, progress: 0, reward };
  }

  /** Human-readable description of a mission. */
  describe(mission) {
    return TEMPLATES.find((t) => t.type === mission.type).text(mission.target);
  }

  /**
   * Record a finished game. Returns one result per mission:
   * { mission, text, before, after, completed }
   * Completed missions are removed and replaced; main.js hands out rewards.
   */
  applyGame(stats) {
    const results = this.list.map((mission) => {
      const template = TEMPLATES.find((t) => t.type === mission.type);
      const value = stats[template.stat] ?? 0;
      const before = mission.progress;
      mission.progress = template.scope === 'total' ? before + value : Math.max(before, value);
      mission.progress = Math.min(mission.progress, mission.target);
      const completed = mission.progress >= mission.target;
      return { mission, text: this.describe(mission), before, after: mission.progress, completed };
    });

    const finished = results.filter((r) => r.completed);
    this.completedCount += finished.length;
    this.list = this.list.filter((m) => m.progress < m.target);
    this.refill(finished.map((r) => r.mission.type));
    return results;
  }
}
