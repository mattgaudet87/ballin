# Ballin' 🏀

A flick basketball game for your phone (and your Mac). Swipe up on the ball to
shoot. The ball starts in a different spot every time, so **aim is everything**.

## Modes

- **Blitz:** 60 seconds on the clock. Score as many points as you can. Hit 10 points and the hoop starts sliding.
- **Hot Hand:** no clock. Keep shooting until you miss once. Baskets randomly light up with
  multipliers: **2×** (common), **3×**, **5×** (rare) and **10×** (very rare).

In both modes a **swish** earns a bonus point and **3 in a row** sets you on fire for double points.

## Missions & power-ups

Three missions are always active, and you can see them between games. Finish one to earn power-ups:

| Power-up | Effect |
| --- | --- |
| Gold / Silver / Bronze Ball | 3× / 2× / 1.5× points on one shot (tap it in the left tray before shooting) |
| White Monster | Bigger hoop for 10 shots |
| Green Monster | Multiplier that climbs every shot for 10 shots (1.2× → 3×) |
| Orange Monster | Moving hoop 25% slower for 10 shots |
| Blue Monster | Coin booster (coming soon) |

Drinks are in the right tray. You can run one of each kind at once, and any shots left
when a game ends carry over to your next game.

Built with plain HTML, CSS and JavaScript on an HTML5 canvas. There are no frameworks,
no build step and no dependencies.

## Run it locally

The game uses JavaScript modules, which browsers won't load straight from a file.
You need a tiny local web server. Python comes with macOS, so:

1. Open Terminal in this project folder.
2. Start the server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open **http://localhost:8000** in your browser.

Press `Ctrl + C` in Terminal to stop the server.

### Play on your iPhone (same Wi-Fi)

1. Find your Mac's local IP address:

   ```bash
   ipconfig getifaddr en0
   ```

2. With the server running, open `http://<that-ip>:8000` in Safari on your iPhone.
3. Tap **Share → Add to Home Screen** to install it as a full-screen app.

> Tip: if you hear no sound on iPhone, check the silent switch on the side of the phone.

## Deploy to Vercel

This is a static site, so no configuration is needed:

- **Option A:** push this folder to GitHub, then in Vercel choose *Add New → Project*,
  import the repo and click *Deploy*. Leave every setting on its default.
- **Option B:** with the Vercel CLI, run `vercel` in this folder.

## Project structure

| File | What it does |
| --- | --- |
| `index.html` | The page, HUD and menus, plus the home-screen app tags |
| `style.css` | Styling for everything except the canvas drawing |
| `js/main.js` | Starts the game, runs the loop, applies the rules |
| `js/config.js` | **Tunable numbers.** Start here to change the feel |
| `js/modes.js` | Blitz and Hot Hand rules, multiplier odds |
| `js/items.js` | Specialty balls, energy drinks and your inventory |
| `js/missions.js` | Mission types, targets and rewards |
| `js/physics.js` | Shot aiming, gravity, bounces and scoring detection |
| `js/ball.js`, `js/hoop.js`, `js/court.js` | The objects and how they're drawn |
| `js/input.js` | Touch and mouse swipes |
| `js/ui.js` | Score, timer and screens |
| `js/audio.js` | Sound effects made with the Web Audio API |
| `js/effects.js` | Particles, fire, floating text |
| `js/camera.js` | Turns 3D positions into screen positions |
| `js/storage.js` | Saves best scores, missions and power-ups |
| `tools/make_icons.py` | Regenerates the app icons |

See [CLAUDE.md](CLAUDE.md) for a deeper tour of how everything fits together and
how to add new features.
