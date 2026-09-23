# Ballin' 🏀

A flick basketball game for your phone (and your Mac). Swipe up on the ball to
shoot. The ball starts on one of 8 spots across the floor (never the same one twice
in a row), so **aim is everything**. The next ball pops in right after you shoot, so you can
fire away without waiting to see if the last one went in.

## Modes

- **Blitz:** 60 seconds on the clock. Score as many points as you can. On **Hard**, the hoop
  starts sliding once you hit 10 points. On Easy and Normal it stays put (same for the
  friends and online Blitz games).
- **Hot Hand:** no clock. Keep shooting until you miss once. Baskets randomly light up with
  multipliers: **2×** (common), **3×**, **5×** (rare) and **10×** (very rare). This is
  where missions and power-ups live.
- **Free Throw:** no clock, no losing, no multipliers. The ball always sits in the middle.
  Your score is how many you've made in a row, and your **record** is your longest streak.
  A miss just resets the streak. Tap **END** when you're done.
- **Blitz with Friends** has two tabs:
  - **Pass and play:** 2 players on one phone. Each player gets 2 rounds of 30 seconds,
    alternating A, B, A, B, and the highest total wins.
  - **Online:** make an account (username + password), tap **Add friend** to add friends by
    username, and **challenge** them. You play a 60-second Blitz now, your friend plays
    theirs whenever they like, and the higher score wins. Tap a friend to see your record
    against them, head-to-head averages, their best scores and your full game history.

In Blitz, Hot Hand and the challenges, a **swish** earns a bonus point and **3 in a row** sets you on
fire for double points. Each mode tracks your best score and your lifetime baskets 🏀 per difficulty, and the home
screen shows your grand total of baskets across everything.
When you're logged in, your records are also saved to your account, so they follow you to
other devices.

## Difficulty

Pick **Easy**, **Normal** or **Hard** on the home screen. It applies to every mode.

- **Hard:** the hoop is far away, and your swipe speed matters a little.
- **Normal:** the hoop is closer, and every shot flies the right distance. It's all about aim.
- **Easy:** like Normal, with the hoop twice as close, for a big arcade feel.

Each difficulty also has its own court: a light Rec Center (Easy), a red-brick Gym (Normal)
and a dark Night Court (Hard).

## Hot Hand missions & power-ups

Three missions are always active in the Hot Hand screen. You see the goal, but the prize
is a surprise: finish one, tap **Collect reward**, and find out what you won.

| Power-up | Effect |
| --- | --- |
| Gold / Silver / Bronze Ball | 3× / 2× / 1.5× points on one shot (tap it in the left tray before shooting) |
| White Monster | Bigger hoop for 10 shots |
| Green Monster | Multiplier that climbs every shot for 10 shots (1.2× → 3×) |
| Orange Monster | Moving hoop 25% slower for 10 shots |
| Blue Monster | Coin booster (coming soon) |

Easy, Normal and Hard each have their **own locker**, so power-ups earned on one difficulty
are used on that difficulty. Drinks are in the right tray. You can run one of each kind at once, and any shots left
when a game ends carry over to your next game.

Built with plain HTML, CSS and JavaScript on an HTML5 canvas. There are no frameworks,
no build step and no dependencies. Online play uses a few small Vercel serverless
functions (the `api/` folder) and a [Turso](https://turso.tech) database.

## Run it locally

The game uses JavaScript modules, which browsers won't load straight from a file.
You need a tiny local web server. This one also runs the online features
(it needs [Node.js](https://nodejs.org) 22.13 or newer):

1. Open Terminal in this project folder.
2. Start the server:

   ```bash
   node tools/dev.mjs
   ```

3. Open **http://localhost:8000** in your browser.

Press `Ctrl + C` in Terminal to stop the server.

Locally, online play uses a test database file (`.local/ballin-dev.db`), so you can make
test accounts without touching the real one. Delete that file to start fresh. To test
against your real Turso database instead, copy `.env.example` to `.env.local` and fill it in.

(`python3 tools/serve.py` still works if you only want the game without online features.)

### Play on your iPhone (same Wi-Fi)

1. Find your Mac's local IP address:

   ```bash
   ipconfig getifaddr en0
   ```

2. With the server running, open `http://<that-ip>:8000` in Safari on your iPhone.
3. Tap **Share → Add to Home Screen** to install it as a full-screen app.

> Tip: if you hear no sound on iPhone, check the silent switch on the side of the phone.

## Deploy to Vercel

The game files are static and the `api/` folder becomes serverless functions
automatically, so no build settings are needed:

- **Option A:** push this folder to GitHub, then in Vercel choose *Add New → Project*,
  import the repo and click *Deploy*. Leave every setting on its default.
- **Option B:** with the Vercel CLI, run `vercel` in this folder.

### Set up the online database (Turso, one time)

1. Make a free account at [turso.tech](https://turso.tech) and install their CLI:

   ```bash
   brew install tursodatabase/tap/turso
   ```

2. Log in and create a database:

   ```bash
   turso auth login
   ```

   ```bash
   turso db create ballin
   ```

3. Get its URL and a token:

   ```bash
   turso db show ballin --url
   ```

   ```bash
   turso db tokens create ballin
   ```

4. In Vercel, open your project → *Settings → Environment Variables* and add
   `TURSO_DATABASE_URL` (the `libsql://...` URL) and `TURSO_AUTH_TOKEN` (the token).
   Then redeploy. The tables are created automatically on the first request.

Keep the token secret. It lives only in Vercel (and your `.env.local`, which git ignores),
never in the game's JavaScript.

## Project structure

| File | What it does |
| --- | --- |
| `index.html` | The page, HUD and menus, plus the home-screen app tags |
| `style.css` | Styling for everything except the canvas drawing |
| `js/main.js` | Starts the game, runs the loop, applies the rules |
| `js/config.js` | **Tunable numbers.** Start here to change the feel |
| `js/modes.js` | Rules for every mode and difficulty, multiplier odds |
| `js/online.js` | Talks to the server: login, friends, challenges, saved scores |
| `api/` | The server (Vercel functions): accounts, friends, scores, challenges |
| `tools/dev.mjs` | Local server that runs the game and `api/` together |
| `js/items.js` | Specialty balls, energy drinks and your inventory |
| `js/missions.js` | Mission types, targets and rewards |
| `js/physics.js` | Shot aiming, gravity, bounces and scoring detection |
| `js/ball.js`, `js/hoop.js` | The ball and hoop, and how they're drawn |
| `js/court.js` | The brick wall and hardwood floor, one look per difficulty |
| `js/input.js` | Touch and mouse swipes |
| `js/ui.js` | Score, timer and screens |
| `js/audio.js` | Sound effects made with the Web Audio API |
| `js/effects.js` | Particles, fire, floating text |
| `js/camera.js` | Turns 3D positions into screen positions |
| `js/storage.js` | Saves best scores, missions and power-ups |
| `tools/make_icons.py` | Regenerates the app icons |

See [CLAUDE.md](CLAUDE.md) for a deeper tour of how everything fits together and
how to add new features.
