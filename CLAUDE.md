# Ballin' — project guide for Claude

A mobile-first flick basketball game. Plain HTML/CSS/JS with ES modules and an
HTML5 canvas. **No frameworks, no build step, no npm.** It deploys to Vercel as a
static site with zero config. The owner is a beginner, so keep the code simple,
well commented and consistent with what's already here.

## Running it

ES modules don't load from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (`.claude/launch.json` has this as the `ballin` preview config.)

## File map

```
index.html             Page markup: canvas + HTML overlays (HUD, menus, mute button), PWA/Apple meta tags
style.css              All styling for the page and overlays (not the canvas drawing)
manifest.webmanifest   Home-screen app settings (name, icons, fullscreen, portrait)
icons/                 App icons (PNG 180/192/512 + SVG favicon)
tools/make_icons.py    Regenerates the PNG icons (pure Python, no libraries)
js/
  config.js    ALL tunable numbers: world sizes, camera, bounciness, shot feel, scoring rules, timings
  camera.js    3D → 2D projection (project, unprojectX) and fitCamera() for the screen size
  main.js      Entry point: setup, game-state machine, main loop, scoring/streak/fire rules, render order
  physics.js   aimShot() swipe → launch velocity; stepBall() gravity, rim/board/floor/wall collisions, score detection
  ball.js      Ball state (position, velocity, per-shot flags) and drawing (shading, spinning 3D seams)
  hoop.js      Hoop state, side-to-side movement, net spring animation, drawing (split into back/front layers)
  court.js     Background (wall, floor, court lines) — drawn once into a cached canvas on resize
  input.js     Pointer events (touch + mouse) → swipe { dx, dy, speed } → onShoot callback
  ui.js        Show/hide/update the HTML overlays: HUD, countdown, start and game-over screens, hint, mute icon
  audio.js     Web Audio sound effects (synthesized, no files) + mute (saved to localStorage)
  effects.js   Particles, fire trail, floating text, screen shake, on-fire edge glow (screen space)
  storage.js   try/catch-wrapped localStorage helpers (best score, mute setting)
```

## How it works

- **World units are meters.** x = left/right, y = height, z = distance away from the player.
  The ball rests at z = 0 and the rim is at `CONFIG.hoop.z`. Everything is simulated
  in 3D and only turned into pixels by `camera.project()` when drawing. That's how the
  ball shrinks as it flies away.
- **Game states** (`game.state` in main.js): `menu` → `countdown` → `playing` → `gameover`.
- **Ball states** (`ball.state`): `ready` (waiting for a swipe) or `flying`.
- **Main loop** (`frame()` in main.js): `update(dt)`, then `render(time)`. dt is capped at 0.05s.
- **Physics** runs in fixed 1/240s steps (`updateShot()` in main.js) for stable collisions.
  `stepBall()` never touches score or sound. It pushes events (`rim`, `board`, `floor`,
  `wall`, `score`) into an array and main.js reacts to them. Keep it that way.
- **Scoring rule:** a basket counts only when the ball's center crosses the rim plane
  moving *down* while inside the ring (`physics.js`, bottom of `stepBall`). Coming up
  through the ring sets `enteredFromBelow` and voids the shot.
  A **swish** = scored with `touchedRim` and `touchedBoard` both false.
- **Shot resolution** (`updateShot()` in main.js): a make ends the shot after
  `resetAfterMake`. A miss is declared once the ball falls below the rim, or goes lost or
  off-screen, then it resets after `resetAfterMiss`. If time runs out while the ball is
  in the air, the game ends when that shot finishes (buzzer beaters count).
- **Draw order fakes depth** (`ballLayer()` + `render()` in main.js): the hoop is drawn
  in two layers (`drawBack`: pole, board, back rim, back net; `drawFront`: front net,
  front rim). The ball goes before, between or after them depending on its z.
- **Shot aiming** (`aimShot()` in physics.js): swipe speed ÷ `perfectSwipeSpeed` gives
  power, which is softened by `powerForgiveness`. The swipe direction is extended up the
  screen to the rim's height and turned back into a world x, then aim assist pulls near
  misses toward the hoop. `computeLaunch()` then solves the arc to that target with a
  fixed apex height.
- **Retina:** the canvas backing size is CSS size × devicePixelRatio (capped by
  `CONFIG.maxPixelRatio`), and the context is scaled so all drawing code uses CSS pixels.
- **Mobile lockdown:** `touch-action: none` + `overscroll-behavior: none` in CSS, and
  `touchmove`/`gesturestart` `preventDefault` in main.js stop scrolling, zoom and pull-to-refresh.

## Recipes for common changes

- **Tune difficulty/feel:** only edit `js/config.js`. Shot sensitivity lives in `shot`,
  bounciness in `physics`, scoring and timings in `game`.
- **Test shot tuning without playing:** write a small Node script that imports
  `config.js`, `camera.js`, `physics.js`, `ball.js` and `hoop.js` (they have no DOM
  dependencies), calls `fitCamera(375, 812)`, then loops `aimShot()` and `stepBall()`
  over a grid of swipe speeds and angles.
- **New sound:** add a method to `SoundFX` in audio.js built from `tone()`/`noise()`, and call it from main.js.
- **New scoring rule or bonus:** add it in `onMake()` / `onMiss()` in main.js, and put any numbers in `CONFIG.game`.
- **New physics event** (e.g. hitting the pole): push `{ type: 'pole', speed }` in `stepBall()`,
  then handle it in the event loop inside `updateShot()`.
- **New game mode:** add a state or a mode flag to `game` in main.js. Branch in `startGame()`,
  `updateTimer()` and `endGame()`. Add the menu button in index.html and wire it in ui.js.
- **New overlay/HUD item:** markup in index.html, styles in style.css, and a method in ui.js
  that main.js calls. Only touch the DOM when a value changes (see `UI.setText`).
- **New visual effect:** add it to effects.js (screen space) and call it from main.js.
- **Changing the icon:** edit and run `python3 tools/make_icons.py`, and update `icons/icon.svg`.
- **Debugging in the browser console:** `window.ballin` exposes `{ game, ball, hoop, CONFIG }`,
  e.g. `ballin.game.score = 9` to test the moving hoop, or `ballin.game.streak = 2` to test fire.

## Conventions

- ES modules, one class or concern per file, named exports.
- Every file starts with a comment block explaining its job. Keep comments beginner-friendly.
- No magic numbers in logic. Put them in `config.js`.
- Wrap all `localStorage` access in try/catch (use storage.js).
- Don't add dependencies or a build step. Keep it deployable as plain static files.
