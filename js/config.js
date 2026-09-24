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
// Cinematic visual pack: on by default, open the game with ?nofx to compare. Drawing only, no gameplay changes.
export const FX = typeof location === 'undefined' || !new URLSearchParams(location.search).has('nofx');

// Display face used by canvas text when FX is on (loaded in index.html)
export const FX_FONT = '"Barlow Condensed", -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

export const CONFIG = {
  gravity: 9.8, // meters per second², same as Earth

  ball: {
    radius: 0.12,
    // Where the ball rests before each shot, low in front of the camera.
    // During a game it starts on one of `spots` evenly spaced x positions
    // (how wide depends on the difficulty, see modes.js), never the same spot
    // twice in a row, so every shot needs fresh aiming.
    startX: 0,
    startY: 0.4,
    startZ: 0,
    spots: 8,
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
    // A LOW camera (about knee-to-waist height) right behind the ball, looking
    // up at the hoop, like GamePigeon's flick basketball. The ball looks big
    // at the bottom and you see the floor stretch away to the wall.
    y: 1.0,
    z: -1.0,
    // The camera zoom is calculated automatically so that the resting ball
    // and the rim land on these spots (fractions of the screen height).
    ballScreenY: 0.85,
    rimScreenY: 0.35,
    // From such a low camera you'd really see the hoop from underneath, so the
    // rim looks tipped up at you. Games cheat here: anything near the hoop is
    // drawn as if seen from slightly ABOVE. This is how much of the rim's depth
    // shows (0 = perfectly flat line, 0.3 = a clear oval). Drawing only.
    hoopViewTilt: 0.2,
    // The cheat fades in over this many meters as the ball approaches the hoop
    hoopViewBlend: 0.7,
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
    pointsPerMake: 1,
    swishBonus: 1, // extra points for touching nothing but net
    fireStreak: 3, // makes in a row needed to catch fire
    fireMultiplier: 2, // points are multiplied by this while on fire
    hoopSpeedMax: 2.4, // fastest slide speed (radians/second)
    // Rapid fire: the next ball pops in this many seconds after you shoot,
    // without waiting to see if the last one goes in (several can fly at once).
    reloadDelay: 0.2,
    ballLinger: 1.0, // seconds a ball stays on screen after its make/miss is decided
    missEndDelay: 0.9, // Hot Hand: pause after the miss before the game over screen
    maxShotTime: 4.5, // give up on a shot after this many seconds
  },

  // Coins (see wallet.js). Also used by api/challenges.js, so no DOM code in here!
  coins: {
    chance: 0.3, // chance that a coin floats in the hoop for the next ball (every mode)
    value: 5, // coins you get for making the basket with a coin in it
    blueMultiplier: 2, // Blue Monster: coins are worth this many times more
    onlineWin: 50, // coins for winning an online challenge (given by the server)
  },

  maxPixelRatio: 3, // cap for Retina rendering (higher = sharper but slower)
  courtPreviewPixelRatio: 2, // same, for the stadium/floor pictures on the Customize screen

  music: {
    volume: 0.35, // background music plays quieter than the sound effects
  },

  storageKeys: {
    best: 'ballin.best.', // + mode + '.' + difficulty, e.g. 'ballin.best.blitz.hard'
    baskets: 'ballin.baskets.', // + mode + '.' + difficulty: lifetime baskets made
    difficulty: 'ballin.difficulty',
    court: 'ballin.court', // stadium from the Customize screen (unset = each difficulty's classic)
    floor: 'ballin.floor', // floor from the Customize screen (unset = the stadium's own)
    playerNames: 'ballin.playerNames',
    oldBest: 'ballin.bestScore', // from the very first version (Blitz on Hard)
    muted: 'ballin.muted',
    musicMuted: 'ballin.musicMuted',
    inventory: 'ballin.inventory',
    missions: 'ballin.missions',
    wallet: 'ballin.wallet', // coins and ball styles (wallet.js)
    account: 'ballin.account', // online login: { username, token }
    recordsOwner: 'ballin.recordsOwner', // which account the saved records on this device belong to
  },
};
