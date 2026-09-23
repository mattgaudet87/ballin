/**
 * modes.js
 * ---------------------------------------------------------------------------
 * Game modes, difficulty levels, and Hot Hand's basket multipliers.
 * main.js reads the current mode/difficulty to decide things like
 * "is there a clock?", "does one miss end the game?" and "how far is the hoop?".
 *
 * To add a mode: add an entry to MODES and a .mode-card for it in index.html.
 * To tweak a difficulty: change its numbers in DIFFICULTIES.
 */

export const MODES = {
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    timed: true,
    duration: 60, // seconds
    endsOnMiss: false,
    basketMultipliers: false,
    powerUps: false, // specialty balls + energy drinks
    missions: false,
    // The hoop starts sliding once `stat` reaches `startAt`, then speeds up
    // by `speedPer` for every extra point of that stat.
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05 },
  },

  hothand: {
    id: 'hothand',
    name: 'Hot Hand',
    timed: false,
    duration: 0,
    endsOnMiss: true,
    basketMultipliers: true,
    powerUps: true,
    missions: true,
    // Multipliers make scores jump around, so difficulty follows makes instead.
    movingHoop: { stat: 'makes', startAt: 5, speedStart: 0.7, speedPer: 0.08 },
  },

  friends: {
    id: 'friends',
    name: 'Blitz with Friends',
    timed: true,
    duration: 30, // seconds per round
    endsOnMiss: false,
    basketMultipliers: false,
    powerUps: false,
    missions: false,
    // Pass and play: turns go A, B, A, B.
    passAndPlay: { players: 2, roundsEach: 2 },
    // `score` here is the player's running total, so the hoop gets tougher
    // in round 2 for BOTH players equally.
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05 },
  },
};

/**
 * Difficulty levels. Every mode can be played on any of them.
 *   hoopZ        how far away the hoop is (meters)
 *   powerMatters false = every shot flies exactly the right distance, so only
 *                aim matters (no short shots, no back-rim clangs)
 *   aimAssist    0 = none, 1 = always straight at the hoop
 *   startXRange  how far left/right the ball can start (meters)
 *   hoopRange    how far the moving hoop slides (meters)
 *   apexY        how high shots peak (meters)
 */
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    hoopZ: 1.3,
    powerMatters: false,
    aimAssist: 0.6,
    startXRange: 0.22,
    hoopRange: 0.25,
    apexY: 3.7,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    hoopZ: 2.6,
    powerMatters: false,
    aimAssist: 0.5,
    startXRange: 0.3,
    hoopRange: 0.45,
    apexY: 3.9,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    hoopZ: 3.6,
    powerMatters: true,
    aimAssist: 0.35,
    startXRange: 0.35,
    hoopRange: 0.62,
    apexY: 4.0,
  },
};

/**
 * Bonus multipliers that can appear on a basket in Hot Hand.
 * `chance` is the probability of each one showing up on any given shot.
 */
export const BASKET_MULTIPLIERS = [
  { value: 10, chance: 0.015, color: '#ff4df0' }, // very rare
  { value: 5, chance: 0.045, color: '#b36bff' }, // rare
  { value: 3, chance: 0.12, color: '#3fb6ff' }, // uncommon
  { value: 2, chance: 0.26, color: '#4be08a' }, // common
];

/** Pick a multiplier for the next basket, or null for a normal basket. */
export function rollBasketMultiplier() {
  let roll = Math.random();
  for (const m of BASKET_MULTIPLIERS) {
    if (roll < m.chance) return m;
    roll -= m.chance;
  }
  return null;
}
