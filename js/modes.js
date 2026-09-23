/**
 * modes.js
 * ---------------------------------------------------------------------------
 * The game modes and their rules. main.js reads the current mode to decide
 * things like "is there a clock?" and "does one miss end the game?".
 *
 * To add a mode: add an entry to MODES, then add a card for it in the start
 * screen (index.html). ui.js fills in the best score automatically.
 */

export const MODES = {
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    tagline: '60 seconds. Score all you can.',
    timed: true,
    duration: 60, // seconds
    endsOnMiss: false,
    basketMultipliers: false,
    // The hoop starts sliding once `stat` reaches `startAt`, then speeds up
    // by `speedPer` for every extra point of that stat.
    movingHoop: { stat: 'score', startAt: 10, speedStart: 0.7, speedPer: 0.05 },
  },

  hothand: {
    id: 'hothand',
    name: 'Hot Hand',
    tagline: 'No clock. One miss and it’s over. Chase the multipliers.',
    timed: false,
    duration: 0,
    endsOnMiss: true,
    basketMultipliers: true,
    // Multipliers make scores jump around, so difficulty follows makes instead.
    movingHoop: { stat: 'makes', startAt: 5, speedStart: 0.7, speedPer: 0.08 },
  },
};

/**
 * Bonus multipliers that can appear on a basket in Hot Hand.
 * `chance` is the probability of each one showing up on any given shot.
 */
export const BASKET_MULTIPLIERS = [
  { value: 10, chance: 0.015, color: '#ff4df0', label: 'VERY RARE' },
  { value: 5, chance: 0.045, color: '#b36bff', label: 'RARE' },
  { value: 3, chance: 0.12, color: '#3fb6ff', label: 'UNCOMMON' },
  { value: 2, chance: 0.26, color: '#4be08a', label: 'COMMON' },
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
