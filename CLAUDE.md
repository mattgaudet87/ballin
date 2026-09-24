# Ballin' — project guide for Claude

A mobile-first flick basketball game. Plain HTML/CSS/JS with ES modules and an
HTML5 canvas. **No frameworks, no build step, no npm.** It deploys to Vercel with zero
config: the game is static files, and `api/*.js` become Vercel serverless functions for
online play (accounts, friends, scores, challenges) backed by a Turso database. The
owner is a beginner, so keep the code simple, well commented and consistent with
what's already here.

## Running it

ES modules don't load from `file://`, so serve the folder. tools/dev.mjs serves the game
(with `Cache-Control: no-store`, so a refresh always loads the latest code) AND runs the
`api/` functions the way Vercel does. It uses only Node built-ins (Node 22.13+):

```
node tools/dev.mjs
```

Then open http://localhost:8000. (`.claude/launch.json` has this as the `ballin` preview config.)
With no `TURSO_DATABASE_URL` it uses a local SQLite test file `.local/ballin-dev.db`
(`node:sqlite`); delete it to reset. `.env.local` (git-ignored, see `.env.example`) points it
at the real Turso database. `python3 tools/serve.py` still serves the game without `api/`.

## File map

```
index.html             Page markup: canvas + HTML overlays (HUD, menus, mute button), PWA/Apple meta tags
style.css              All styling for the page and overlays (not the canvas drawing)
manifest.webmanifest   Home-screen app settings (name, icons, fullscreen, portrait)
package.json           No dependencies; only `"type": "module"` so Node/Vercel treat .js as ES modules
.env.example           Template for .env.local (Turso URL + token for local testing)
api/                   Vercel serverless functions (server side of online play)
  _lib/db.js           query(sql, args): Turso over HTTP (fetch), or local node:sqlite; creates tables
  _lib/auth.js         scrypt passwords, session tokens, endpoint() wrapper, ApiError, body(), findUser()
  account.js           /api/account: signup, login, logout, who am I
  _lib/challenge-view.js  SELECT for challenges + fromMySide() + record() (shared by challenges.js and friends.js)
  friends.js           /api/friends: list (bests + W/L/T record), ?username= friend page (history), add, remove
  scores.js            /api/scores: upload bests + lifetime baskets + wallet (server keeps the MAX), download
  challenges.js        /api/challenges: list, create, finish (winner gets CONFIG.coins.onlineWin), decline
tools/dev.mjs          Local server: static files + api/ (same as Vercel)
icons/                 App icons (PNG 180/192/512 + SVG favicon)
tools/make_icons.py    Regenerates the PNG icons (pure Python, no libraries)
js/
  config.js    Tunable numbers shared by everything: world sizes, camera, bounciness, shot feel, shared scoring rules, coins, timings, storage keys.
               Also imported by api/ (no DOM code in it!)
  modes.js     MODES (Blitz, Hot Hand, Blitz with Friends, Free Throw, Online) + their rule flags, DIFFICULTIES, basket multipliers.
               Also imported by api/ (no DOM code in it!)
  online.js    Online class: fetch wrapper for /api/*, keeps { username, token } in localStorage
  wallet.js    Coins (earned/spent/bonus, balance) + what they buy on the Customize screen (CATALOG: BALL_STYLES here,
               stadiums/floors from court.js; looks only), what you own + which ball is equipped. Also imported by api/ and ball.js
  items.js     Power-ups: specialty balls + energy drinks (ITEMS, DRINK_EFFECTS) and the Inventory class (counts, active boosts, persistence)
  missions.js  Hot Hand missions: templates, 3 active, progress, completed → collect() rolls the hidden reward
  camera.js    3D → 2D projection (project, unprojectX), projectHoop (drawing cheat near the hoop), fitCamera()
  main.js      Entry point: setup, screens/menus flow, friends match, game-state machine, main loop, scoring rules, power-ups, render order
  physics.js   aimShot() swipe → launch velocity; stepBall() gravity, rim/board/floor/wall collisions, score detection
  ball.js      Ball state (position, velocity, per-shot flags) and drawing (shading, spinning 3D seams, Shop style colors)
  hoop.js      Hoop state, side-to-side movement, rim size (White Monster), net spring, multiplier badge, coin, drawing (back/front layers).
               Colors can be themed per court (setColors)
  court.js     Background: brick wall, floor, court lines, lighting. COURT_THEMES = the 9 stadiums (6 for coins + the 3 free
               classics easy/normal/hard), FLOORS = floor surfaces for any stadium. Drawn once into a cached canvas on
               resize / difficulty / stadium / floor change. No DOM code (wallet.js, and so api/, imports it)
  input.js     Pointer events (touch + mouse) → swipe { dx, dy, speed } → onShoot callback
  ui.js        HTML overlays: home, Customize (Stadium / Floors / Balls tabs), Hot Hand hub (missions + locker), Blitz with Friends
               (online + Pass and play button), Pass and play setup, friend page, handoff/results, game over, popups, HUD, trays
  audio.js     Web Audio sound effects (synthesized, no files) + mute (saved to localStorage)
  effects.js   Particles, fire trail, floating text, screen shake, on-fire edge glow (screen space)
  storage.js   try/catch-wrapped localStorage helpers (numbers, booleans, JSON)
```

## How it works

- **World units are meters.** x = left/right, y = height, z = distance away from the player.
  The ball rests at z = 0 and the rim is at `CONFIG.hoop.z`. Everything is simulated
  in 3D and only turned into pixels by `camera.project()` when drawing. That's how the
  ball shrinks as it flies away.
- **Camera:** low (y = 1 m) and just behind the ball (z = -1), looking up at the hoop, GamePigeon
  style. The ball rests low (`CONFIG.ball.startY` = 0.4). Because the camera is so close,
  small x offsets for the ball are big on screen, so keep `startXRange` around 0.3 or the
  ball goes off the edge.
- **Hoop view cheat:** from such a low camera the rim would look tipped up at you. The hoop,
  backboard and the ball (once it's near the hoop) are drawn with `projectHoop()`, which flattens
  everything near the hoop onto the rim's depth and tilts it as if seen from slightly above
  (`CONFIG.camera.hoopViewTilt`, fading in over `hoopViewBlend`). Physics and the court/floor
  always use the real `project()`.
- **Game states** (`game.state` in main.js): `menu` → `waiting` → `playing` → `gameover`.
  There is no countdown anywhere. `startGame()` sets everything up in `waiting` and shows the
  "Tap to start" screen (`#tap-start`). One tap calls `beginPlay()`, which starts the clock.
  Blitz with Friends skips it (`tapToStart: false`) because the handoff screen's
  I'm Ready button already is the tap to start. `inGame()` is true in both `waiting` and `playing`.
- **Screens:** home (Customize button top left, difficulty picker + 4 mode cards) → Blitz and Free Throw start
  right away. Hot Hand opens its hub (play, missions, locker). Blitz with Friends opens `showOnline()`: the
  login form, or Your stats (W/L/T summed over friends), Friends with a "+ Add friend" button, a teal
  **PASS AND PLAY** button (`[data-passplay]`, also under the login form), then Challenges. Pass and play opens
  its own screen (`showPassAndPlay()`: difficulty picker + names → handoff → round → … → results).
  Online has no difficulty picker: CHALLENGE/REMATCH opens `pickChallenge()`'s difficulty popup (`#challenge-popup`). Tapping a friend opens the friend page
  (`showFriend()`: W/L/T, head-to-head averages/highs, their bests, game history). Only one
  `.overlay` screen shows at a time (`ui.showScreen(name)`). "Your turn" counts show as red
  badge on the Blitz with Friends card (`ui.setOnlineStatus()`).
- **Modes** (`game.mode`, from modes.js):
  - **Blitz** is 60 seconds on the clock. On Hard only, the hoop starts moving at 10 points
    (`movingHoop.difficulties: ['hard']`; `hoopRule()` in main.js applies it). Friends and
    Online work the same way.
  - **Hot Hand** has no clock, and one miss ends the run. Each new ball may roll a basket
    multiplier (2× common, 3×, 5× rare, 10× very rare), shown as a badge above the
    backboard. The hoop starts moving after 5 makes. It's the only mode with
    power-ups (`powerUps`) and missions (`missions`).
  - **Blitz with Friends** (`passAndPlay`) is pass and play. Turns go A, B, A, B, with 30s
    rounds. `game.match` holds the players and turn. Each round starts from that player's
    running total (`startGame`), and `endGame()` → `endRound()` records it. It's built so an
    online version could reuse the same turn/round structure.
  - **Free Throw** (`streakScoring`, `fixedSpot`, `endless`, `fire: false`, `movingHoop: null`):
    no clock, no losing, no multipliers or fire. The ball is always centered. `game.score` is
    the current streak (reset on a miss) and the saved best is the longest streak
    (`gameResult()` = `bestStreak`; `saveBest()` runs on every make). The corner button (`#leave-btn`)
    says END here and finishes the session with results.
  - **Online** (`online`): a 60-second Blitz played for a challenge (`game.challenge`
    = `{ id, opponent, score }`; `id` null = a new challenge). `endGame()` →
    `sendChallengeResult()`; a failed send turns PLAY AGAIN into RETRY.
  - Mode flags (`timed`, `endsOnMiss`, `basketMultipliers`, `powerUps`, `missions`, `fire`,
    `passAndPlay`, `streakScoring`, `fixedSpot`, `endless`, `online`, `movingHoop`) drive all
    branching in main.js. Don't check mode ids directly.
- **Difficulties** (`game.difficulty`, from modes.js) apply to every mode and are saved:
  - **Hard** is the original feel: the hoop is 3.6 m away and swipe speed matters a little.
  - **Normal** puts the hoop at 2.6 m, and `powerMatters: false` means every shot flies the
    exact distance. You can't come up short or hit the back rim, so only aim matters.
  - **Easy** is like Normal with the hoop twice as close (1.3 m), for a big arcade look.
  - `applyDifficulty()` moves the hoop (`hoop.setDistance`) and refits the camera. The camera
    auto-zooms so the rim stays in the same screen spot, so a closer hoop looks bigger.
    It also redraws the court.
- **Records:** best score per mode *per difficulty* (`ballin.best.<mode>.<difficulty>`) and
  lifetime baskets per mode *per difficulty* (`ballin.baskets.<mode>.<difficulty>`,
  `game.lifetime[mode][diff]`). Mode cards, the hub, the HUD and game over show the current
  difficulty's numbers. The home screen shows the grand total (`totalBaskets()`). Old
  per-mode counts (`ballin.baskets.<mode>`) are moved to the last-used difficulty in
  `loadLifetime()`. Always refresh the menus with `showRecords()`.
- **Online play** (online.js ↔ api/ ↔ Turso):
  - Accounts are username + password. Passwords are scrypt-hashed. Login returns a random
    token (only its sha256 is stored in `sessions`). The client sends `Authorization: Bearer`.
  - Every api/ file is `export default endpoint(async (req, user) => data)`. It returns JSON,
    and `throw new ApiError(status, 'friendly message')` for errors. Always use `?` placeholders in SQL.
  - Friends are mutual rows in `friends` (adding needs no approval). Challenges are async: the
    challenger plays first and `create`s with their score, then the friend plays the same
    difficulty and `finish`es. `GET` returns them from the viewer's side (`yourTurn`,
    `waiting`, `won`, `lost`, `tie`, `declined`) and hides the challenger's score until you've played.
  - `syncScores()` in main.js runs at startup, after login and after every game. It uploads
    `game.best`/`game.lifetime` and merges back higher numbers. `ballin.recordsOwner` remembers
    whose records the device holds. If a different account logs in, the device takes that
    account's records instead of uploading the previous player's.
  - Scores are trusted from the client (casual game). There's no rate limiting on login yet.
- **Coins** (wallet.js + main.js): every new ball in every mode has a `CONFIG.coins.chance` (30%) of a
  coin floating above the rim (`game.coin`, locked into `shot.coin` when shot; drawn by `hoop.drawCoin()`
  via `shownCoin()`, right after `hoop.drawBack`). Making that basket calls `grabCoin()`: +`coins.value`,
  ×2 with a Blue Monster (`shot.coinBoost`). Winning an online challenge gives `coins.onlineWin`; the server
  adds it to `wallets.bonus` in `finish` (so the challenger gets it on their next sync). The wallet counts
  `earned`, `spent` and `bonus`, which only go up, so `syncScores()` can keep the MAX of each like records do
  (balance = earned + bonus − spent). Coins buy things on the Customize screen (`CATALOG` in wallet.js:
  `ball`, `stadium`, `floor`; price 0 = free and always owned). `wallet.owns(kind, id)` / `buy(kind, id)`; the
  owned list stores ball ids as-is ('ice') and the rest as 'kind:id' ('stadium:inferno'). The server keeps any
  id `isOwnedKey()` accepts. Ball styles are cosmetic, used in every mode (`ball.style`). A loaded
  Gold/Silver/Bronze ball still shows its own colors.
- **Customize** (`showCustomize(tab)` / `customizeItem(kind, id)` in main.js): the home screen's Customize button
  (top left) opens it on **Stadium**; the coin button opens it on **Balls**. Stadium and Floors share a big preview
  + a tile per choice, drawn by `drawLookPictures()` with a still `previewHoop`, borrowing the shared camera and
  fitting it back after. A stadium tile uses the floor in use and a floor tile the stadium in use. Tapping an owned
  one uses it; otherwise it asks, then buys. The picked stadium (`game.court`, `ballin.court`) replaces the
  difficulty's court in every mode. Unset or not owned = each difficulty's classic (`courtId()` falls back to the
  difficulty id). The picked floor (`game.floor`, `ballin.floor`, `floorId()`) goes in any stadium; 'stadium' = its own
  wood. Courts picked before stadiums cost coins are granted for free at startup. A theme can also set `hoop` colors (`hoop.setColors()`), `mote` (dust tint in `drawMotes`) and
  `grade` (FX color grade). `redrawCourt()` redraws the cached background and hoop colors after any change.
- **Scoring** (`onMake()` in main.js): (1 + swish bonus) × fire 2× × basket multiplier ×
  specialty ball × Green Monster multiplier, rounded. Each extra multiplier shows as a label under "+N".
- **Lockers are per difficulty:** `Inventory` keeps `lockers.easy/normal/hard`, and
  `applyDifficulty()` calls `inventory.setDifficulty(id)` so `counts`/`active` point at the
  right one. Mission rewards go into the locker of the difficulty chosen when you tap
  Collect. Each new locker gets the starter pack.
- **Power-ups** (items.js + `useItem()`/`shoot()` in main.js): tapping a ball in the left tray
  loads it (`inventory.selectedBall`, `ball.skin`), and it's consumed when you shoot. Tapping a
  drink activates it for 10 shots. `inventory.startShot()` returns a snapshot (`b.shot` on the
  flying ball) of what that shot gets, so boosts can't expire mid-flight (`boostOn()`). Active
  boosts are saved, so leftover shots carry into the next game.
- **Missions** (missions.js, Hot Hand only): 3 are always active and shown only in the Hot
  Hand hub and on its game-over screen. The player sees the target but never the reward.
  `endGame()` → `missions.applyGame(gameStats())`, and the game-over screen animates the
  bars. A finished mission becomes `completed` (a green card with a COLLECT REWARD button)
  and stops counting. `collectReward()` → `missions.collect(i)` rolls the prize from the
  mission's secret `tier` (1–3 items), adds it to the inventory, shows the reveal popup and
  puts a new mission in the same slot.
- **Random start spot:** `newBall()` → `randomStartX()` puts the ball on one of `CONFIG.ball.spots`
  (8) evenly spaced x positions across the difficulty's `startXRange`. It never uses the same
  spot twice in a row (`game.spot`), so every shot needs fresh aim. Free Throw (`fixedSpot`) is always centered. Power barely matters by design
  (`CONFIG.shot.powerForgiveness`, `minPower`/`maxPower`).
- **Leave button** (`#leave-btn`, `leaveGame()` in main.js): shown in every mode during a game.
  It asks to confirm, then quits without a result (no game over, best or mission progress;
  lifetime baskets are kept) and goes back to where the game started: home, the Hot Hand hub,
  the Pass and play screen (the match is dropped) or Blitz with Friends. Two exceptions: Free
  Throw's button says END and shows results (`endGame()`), and leaving while answering an
  online challenge sends your score so far (so you can't quit and replay for a better one).
- **Rapid fire / ball states:** `ball` (main.js, a `let`) is the ball waiting at the bottom;
  `flying` holds every ball in the air, and several can fly at once. `shoot()` moves `ball` into
  `flying` with its own `shot` snapshot, then makes a new hidden ball (`state: 'reloading'`)
  that pops in after `CONFIG.game.reloadDelay` (0.2 s) via `newBall()`. Ball states: `ready`,
  `flying`, `reloading`. Each flying ball tracks `outcome` (null → 'make'/'miss'), `linger` and
  `physicsTime`. `window.ballin.ball` is a getter, so it's always the current ready ball.
- **Main loop** (`frame()` in main.js): `update(dt)`, then `render(time)`. dt is capped at 0.05s.
- **Physics** runs in fixed 1/240s steps (`updateFlyingBall()` in main.js, per ball) for stable collisions.
  `stepBall()` never touches score or sound. It pushes events (`rim`, `board`, `floor`,
  `wall`, `score`) into an array and main.js reacts to them. Keep it that way.
- **Scoring rule:** a basket counts only when the ball's center crosses the rim plane
  moving *down* while inside the ring (`physics.js`, bottom of `stepBall`). Coming up
  through the ring sets `enteredFromBelow` and voids the shot.
  A **swish** = scored with `touchedRim` and `touchedBoard` both false.
- **Shot resolution** (`updateShots()` / `updateFlyingBall()` in main.js): each flying ball is
  decided on its own: `onMake(b, swish)` on a score event, `onMiss(b)` once it falls below the
  rim or goes lost/off-screen. It stays on screen for `ballLinger`, then it's removed. If time
  runs out, the game ends once no ball in the air is undecided (buzzer beaters count).
  Hot Hand: the first miss sets `game.ending` (no more shots, later makes don't count) and
  the game over screen follows after `missEndDelay`.
- **Draw order fakes depth** (`ballLayer(b)` + `render()` in main.js): the hoop is drawn
  in two layers (`drawBack`: pole, board, back rim, back net; `drawFront`: front net,
  front rim). Flying balls are sorted farthest first and each is drawn before, between or
  after those layers depending on its z. The ready ball is always drawn last.
- **Shot aiming** (`aimShot()` in physics.js): swipe speed ÷ `perfectSwipeSpeed` gives
  power, which is softened by `powerForgiveness`. The swipe direction is extended up the
  screen to the rim's height and turned back into a world x, then aim assist pulls near
  misses toward the hoop. `computeLaunch()` then solves the arc to that target with a
  fixed apex height.
- **Retina:** the canvas backing size is CSS size × devicePixelRatio (capped by
  `CONFIG.maxPixelRatio`), and the context is scaled so all drawing code uses CSS pixels.
- **Mobile lockdown:** `touch-action: none` + `overscroll-behavior: none` in CSS, and
  `touchmove`/`gesturestart` `preventDefault` in main.js stop scrolling, zoom and pull-to-refresh.
  Menus with `class="scroll"` are the one exception: they may scroll on short screens.

## Recipes for common changes

- **Tune difficulty/feel:** shot sensitivity lives in `config.js` → `shot`, bounciness in
  `physics`, and shared scoring/timings in `game`. Per-mode rules (clock, moving hoop) live in
  `modes.js`, multiplier odds in `BASKET_MULTIPLIERS`, power-up strength in
  `items.js` → `DRINK_EFFECTS`, and mission targets/reward odds in `missions.js`.
- **Test shot tuning without playing:** write a small Node script that imports
  `config.js`, `camera.js`, `physics.js`, `ball.js` and `hoop.js` (they have no DOM
  dependencies), calls `fitCamera(375, 812)`, then loops `aimShot()` and `stepBall()`
  over a grid of swipe speeds and angles.
- **New sound:** add a method to `SoundFX` in audio.js built from `tone()`/`noise()`, and call it from main.js.
- **New scoring rule or bonus:** add it in `onMake()` / `onMiss()` in main.js, and put any numbers in `CONFIG.game`.
- **New physics event** (e.g. hitting the pole): push `{ type: 'pole', speed }` in `stepBall()`,
  then handle it in the event loop inside `updateFlyingBall()`.
- **New online feature:** add an `api/<name>.js` using `endpoint()` from `_lib/auth.js` and
  `query()` from `_lib/db.js` (new tables go in `SCHEMA` with `IF NOT EXISTS`), a method in
  online.js, then UI in ui.js/main.js. Test locally with `node tools/dev.mjs` (edits in `api/_lib/`,
  or in `js/` files that api/ imports like wallet.js/court.js/modes.js, need a server restart).
- **New game mode:** add an entry to `MODES` in modes.js (reuse the existing flags where you can),
  and add a `.mode-card` with `data-mode="<id>"` plus `data-best`/`data-lifetime` spans to index.html.
  Route it in the `ui.onModeSelect` handler in main.js. New rule flags need branches in main.js.
- **New difficulty or tweak one:** edit `DIFFICULTIES` in modes.js and add a button with
  `data-difficulty="<id>"` inside each `.difficulty-picker` in index.html.
- **New power-up:** add it to `ITEMS` and `BALL_IDS`/`DRINK_IDS` in items.js. Put its effect in
  `Inventory.startShot()` (snapshot) and use it in main.js (`onMake()`, `boostOn()` or `hoopSpeed()`).
  Give it a CSS icon (`.icon-ball.<id>` or `.icon-can.<id> { --can: color }`) and add it to
  `REWARD_WEIGHTS` in missions.js so missions can award it. `comingSoon: true` greys an item out.
- **New ball style:** add it to `BALL_STYLES` in wallet.js (name, price, colors, seam,
  optional `glow`). The Balls tab card and in-game drawing pick it up automatically.
- **Coin odds/values:** `CONFIG.coins` in config.js.
- **New stadium:** add an entry (with a `name` and `price`) to `COURT_THEMES` in court.js. Key order = picker order.
  The Stadium tile, dot color (from `paint`), shop and in-game look pick it up automatically.
- **New floor:** add an entry to `FLOORS` in court.js (`name`, `price`, and `wood: [r, g, b]` for planks or
  `solid: [r, g, b]` with optional `speckle`/`grid`). New looks go in `drawSolidFloor()`/`drawPlanks()`.
- **New mission type:** add a template to `TEMPLATES` in missions.js. If it needs a new stat, count it
  on `game` in main.js (reset it in `startGame()`) and add it to `gameStats()`.
- **New overlay/HUD item:** markup in index.html, styles in style.css, and a method in ui.js
  that main.js calls. Only touch the DOM when a value changes (see `UI.setText`).
- **New visual effect:** add it to effects.js (screen space) and call it from main.js.
- **Changing the icon:** edit and run `python3 tools/make_icons.py`, and update `icons/icon.svg`.
- **Debugging in the browser console:** `window.ballin` exposes `{ game, ball, hoop, inventory, missions, online, wallet, CONFIG }`.
  Examples: `ballin.inventory.add('gold', 5)`, `ballin.wallet.add(500)`, `ballin.game.coin = true`, `ballin.game.streak = 2` to test fire,
  `ballin.game.basketMultiplier = { value: 10, color: '#ff4df0' }`.
  To reset saved progress, run `localStorage.clear()` and reload.

## Conventions

- ES modules, one class or concern per file, named exports.
- Every file starts with a comment block explaining its job. Keep comments beginner-friendly.
- No magic numbers in logic. Put them in `config.js`.
- Wrap all `localStorage` access in try/catch (use storage.js).
- Don't add dependencies or a build step. Keep it deployable as plain static files + `api/`.
  The server code uses only Node built-ins and `fetch` (Turso's HTTP API), no npm packages.
- Never put the Turso token (or any secret) in `js/`. Secrets live only in Vercel env vars / `.env.local`.
