/**
 * modes.js
 * ---------------------------------------------------------------------------
 * Game modes (Blitz, Hot Hand, Blitz with Friends, Free Throw, Online Challenge), difficulty levels, and Hot Hand's basket multipliers.
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
    desc: '60 seconds. Score all you can.',
    timed: true,
    duration: 60, // seconds
    endsOnMiss: false,
    basketMultipliers: false,
    powerUps: false, // specialty balls + energy drinks
    missions: false,
    fire: true, // 3 in a row = on fire (double points)
    // The hoop starts sliding once `stat` reaches `startAt`, then speeds up
    // by `speedPer` for every extra point of that stat. `difficulties` (if
    // given) limits it: in the Blitz modes the hoop only moves on Hard.
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05, difficulties: ['hard'] },
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
    fire: true,
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
    fire: true,
    // Pass and play: turns go A, B, A, B.
    passAndPlay: { players: 2, roundsEach: 2 },
    // `score` here is the player's running total, so the hoop gets tougher
    // in round 2 for BOTH players equally (on Hard; it stays still otherwise).
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05, difficulties: ['hard'] },
  },

  freethrow: {
    id: 'freethrow',
    name: 'Free Throw',
    desc: 'No clock, no losing. How many in a row?',
    bestLabel: 'Record',
    timed: false,
    duration: 0,
    endsOnMiss: false, // missing just resets your streak
    basketMultipliers: false,
    powerUps: false,
    missions: false,
    fire: false, // no multipliers of any kind
    // The score is your current streak (makes in a row), and your best score
    // (the record) is your longest streak ever.
    streakScoring: true,
    fixedSpot: true, // the ball always sits in the middle, like a real free throw line
    endless: true, // no way to lose, so an END button finishes the session
    movingHoop: null, // the hoop never moves
  },

  // An online challenge against a friend (see online.js and the api/ folder).
  // Each player plays one Blitz game on their own time; the higher score wins.
  online: {
    id: 'online',
    name: 'Online Challenge',
    timed: true,
    duration: 60,
    endsOnMiss: false,
    basketMultipliers: false,
    powerUps: false,
    missions: false,
    fire: true,
    online: true,
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05, difficulties: ['hard'] },
  },
};

/**
 * Difficulty levels. Every mode can be played on any of them.
 *   hoopZ        how far away the hoop is (meters)
 *   powerMatters false = every shot flies exactly the right distance, so only
 *                aim matters (no short shots, no back-rim clangs)
 *   aimAssist    0 = none, 1 = always straight at the hoop
 *   startXRange  how far left/right the ball can start (meters). The ball is
 *                close to the camera, so small numbers are big on screen.
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
    startXRange: 0.34,
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
    startXRange: 0.28,
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
