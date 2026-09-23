# Ballin' 🏀

A flick basketball game for your phone (and your Mac). Swipe up to shoot. You
have 60 seconds on the clock.

- **Swipe up** on the ball. A faster flick shoots further, and the angle of your swipe aims it.
- **Swish** it (nothing but net) for a bonus point.
- Make **3 in a row** to catch fire and score **double points**.
- Reach **10 points** and the hoop starts sliding, and it speeds up as you score.

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
| `js/config.js` | **Every tunable number.** Start here to change the feel |
| `js/physics.js` | Shot aiming, gravity, bounces and scoring detection |
| `js/ball.js`, `js/hoop.js`, `js/court.js` | The objects and how they're drawn |
| `js/input.js` | Touch and mouse swipes |
| `js/ui.js` | Score, timer and screens |
| `js/audio.js` | Sound effects made with the Web Audio API |
| `js/effects.js` | Particles, fire, floating text |
| `js/camera.js` | Turns 3D positions into screen positions |
| `js/storage.js` | Saves your best score |
| `tools/make_icons.py` | Regenerates the app icons |

See [CLAUDE.md](CLAUDE.md) for a deeper tour of how everything fits together and
how to add new features.
