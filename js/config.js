/**
 * config.js
 * ---------------------------------------------------------------------------
 * Every tunable number in the game lives here, so you can change how the game
 * FEELS without digging through the rest of the code.
 *
 * THE WORLD
 * The game uses a simple 3D world measured in (roughly) METERS:
 *   x = left (-) / right (+)
 *   y = height above the floor
 *   z = distance "into" the screen, away from the player
 * The ball rests at z = 0 and the hoop sits further away at z = hoop.z.
 * camera.js turns these 3D positions into 2D screen positions.
 */
export const CONFIG = {
  gravity: 9.8, // meters per second², same as Earth

  ball: {
    radius: 0.12,
    // Where the ball rests before each shot. During a game its x is picked at
    // random (how far depends on the difficulty, see modes.js), so every
    // shot needs fresh aiming.
    startX: 0,
    startY: 2.2,
    startZ: 0,
    backspin: -11, // radians per second (negative = backspin, like a real jumper)
  },

  // Hoop distance and slide range depend on the difficulty (see modes.js).
  hoop: {
    rimY: 3.05, // rim height (a real hoop is 10 ft = 3.05 m)
    rimRadius: 0.3, // bigger than real life (0.23) so the game is fun
    rimTube: 0.022, // thickness of the rim metal
    boardGap: 0.12, // gap between the back of the rim and the backboard
    boardWidth: 1.2,
    boardHeight: 0.85,
    boardBelowRim: 0.2, // how far the backboard reaches below the rim
    netLength: 0.45,
  },

  court: {
    wallBehindBoard: 0.7, // distance from the backboard to the back wall
  },

  camera: {
    // A low camera just above rim height, behind the ball, looking almost
    // straight at the hoop (like GamePigeon's flick basketball).
    y: 3.5,
    z: -2.5,
    // The camera zoom is calculated automatically so that the resting ball
    // and the rim land on these spots (fractions of the screen height).
    ballScreenY: 0.82,
    rimScreenY: 0.37,
  },

  physics: {
    stepsPerSecond: 240, // small steps = accurate collisions
    rimBounce: 0.55, // 0 = dead, 1 = super bouncy
    boardBounce: 0.6,
    floorBounce: 0.62,
    wallBounce: 0.45,
    friction: 0.85, // fraction of sideways speed kept when bouncing
    netDrag: 3.5, // how much the net slows the ball down
  },

  shot: {
    // How fast (in screen-heights per second) the end of your swipe must be
    // moving for a "perfect power" shot.
    perfectSwipeSpeed: 2.3,
    // How much swipe speed matters: 1 = fully, lower = barely.
    // Kept low on purpose so the game is about AIM, not strength.
    powerForgiveness: 0.2,
    // Only used on difficulties where power matters (Hard).
    // Power is always clamped to this narrow range (1 = perfect distance),
    // so even a wild flick never sails way over the hoop.
    minPower: 0.82,
    maxPower: 1.18,
    apexPowerGain: 0.2, // harder shots fly only a tiny bit higher
    // Aim assist strength is set per difficulty (modes.js); misses further
    // than this many meters from the hoop get no help at all.
    aimAssistRange: 0.6,
    minSwipePx: 25, // shorter swipes are ignored
    autoReleaseFraction: 0.35, // dragging this far up the screen shoots automatically
    speedWindowMs: 90, // swipe speed is measured over the last N milliseconds
  },

  // Rules shared by every mode. Mode-specific rules live in modes.js.
  game: {
    countdownFrom: 3,
    pointsPerMake: 1,
    swishBonus: 1, // extra points for touching nothing but net
    fireStreak: 3, // makes in a row needed to catch fire
    fireMultiplier: 2, // points are multiplied by this while on fire
    hoopSpeedMax: 2.4, // fastest slide speed (radians/second)
    resetAfterMake: 0.75, // seconds before the next ball appears
    resetAfterMiss: 0.5,
    maxShotTime: 4.5, // give up on a shot after this many seconds
  },

  maxPixelRatio: 3, // cap for Retina rendering (higher = sharper but slower)

  storageKeys: {
    best: 'ballin.best.', // + mode + '.' + difficulty, e.g. 'ballin.best.blitz.hard'
    baskets: 'ballin.baskets.', // + mode: lifetime baskets made
    difficulty: 'ballin.difficulty',
    playerNames: 'ballin.playerNames',
    oldBest: 'ballin.bestScore', // from the very first version (Blitz on Hard)
    muted: 'ballin.muted',
    inventory: 'ballin.inventory',
    missions: 'ballin.missions',
  },
};
