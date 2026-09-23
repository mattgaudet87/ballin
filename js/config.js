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
    // Where the ball rests before each shot
    startX: 0,
    startY: 2.2,
    startZ: 0,
    backspin: -11, // radians per second (negative = backspin, like a real jumper)
  },

  hoop: {
    z: 3.6, // distance from the ball to the center of the rim
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
    wallZ: 4.7, // the back wall behind the hoop
  },

  camera: {
    // The camera sits behind and above the ball, looking at the hoop.
    y: 4.4,
    z: -3.2,
    // The camera zoom is calculated automatically so that the resting ball
    // and the rim land on these spots (fractions of the screen height).
    ballScreenY: 0.83,
    rimScreenY: 0.32,
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
    // 1 = your swipe speed is used exactly, lower = more forgiving.
    powerForgiveness: 0.38,
    minPower: 0.55,
    maxPower: 1.5,
    // Aim assist gently pulls near-misses toward the hoop.
    aimAssist: 0.6, // 0 = none, 1 = always straight at the hoop
    aimAssistRange: 0.75, // meters: misses further than this get no help
    apexY: 4.2, // how high the ball peaks on a perfect shot
    apexPowerGain: 0.6, // harder shots also fly a bit higher
    minSwipePx: 25, // shorter swipes are ignored
    autoReleaseFraction: 0.35, // dragging this far up the screen shoots automatically
    speedWindowMs: 90, // swipe speed is measured over the last N milliseconds
  },

  game: {
    duration: 60, // seconds per game
    countdownFrom: 3,
    pointsPerMake: 1,
    swishBonus: 1, // extra points for touching nothing but net
    fireStreak: 3, // makes in a row needed to catch fire
    fireMultiplier: 2, // points are multiplied by this while on fire
    movingHoopScore: 10, // the hoop starts sliding once you reach this score
    hoopRange: 0.62, // how far (meters) the hoop slides left/right
    hoopSpeedStart: 0.7, // slide speed (radians/second) when it starts moving
    hoopSpeedPerPoint: 0.05, // ...gets this much faster per extra point
    hoopSpeedMax: 2.4,
    resetAfterMake: 0.75, // seconds before the next ball appears
    resetAfterMiss: 0.5,
    maxShotTime: 4.5, // give up on a shot after this many seconds
  },

  maxPixelRatio: 3, // cap for Retina rendering (higher = sharper but slower)

  storageKeys: {
    best: 'ballin.bestScore',
    muted: 'ballin.muted',
  },
};
