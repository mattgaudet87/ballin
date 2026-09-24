/**
 * tools/dev.mjs
 * ---------------------------------------------------------------------------
 * Local test server for the WHOLE game, online features included:
 *   - serves the game files (with caching off, so a refresh shows your changes)
 *   - runs the api/ files the same way Vercel does (/api/friends → api/friends.js)
 *
 *     node tools/dev.mjs          (then open http://localhost:8000)
 *     node tools/dev.mjs 9000     (use a different port)
 *
 * Database: if a file called .env.local exists with TURSO_DATABASE_URL and
 * TURSO_AUTH_TOKEN, it uses your real Turso database. Otherwise it uses a
 * local test database file (.local/ballin-dev.db). Delete that file to start fresh.
 *
 * Needs Node 22.13 or newer. Uses only Node's built-in modules.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PORT = Number(process.argv[2]) || 8000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
loadEnvFile(path.join(ROOT, '.env.local'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await runApi(url.pathname, req, res);
      else serveFile(url.pathname, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Server error');
    }
  })
  .listen(PORT, () => console.log(`Ballin' running at http://localhost:${PORT}  (Ctrl+C to stop)`));

/** /api/friends → run the default export of api/friends.js, like Vercel does. */
async function runApi(pathname, req, res) {
  const name = pathname.slice('/api/'.length).replace(/\/$/, '');
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  req.body = await readBody(req);
  // The ?v= makes Node reload the file after you edit it (no restart needed
  // for that file; changes in api/_lib/ still need a restart).
  const mod = await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);
  await mod.default(req, res);
}

function readBody(req) {
  return new Promise((resolve) => {
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => {
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveFile(pathname, res) {
  let file = path.join(ROOT, decodeURIComponent(pathname));
  if (!file.startsWith(ROOT)) file = ROOT; // don't allow "../" tricks
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');

  // Keep secrets and server code private
  const relative = path.relative(ROOT, file);
  const hidden = relative.startsWith('.') || relative.startsWith('api');
  if (hidden || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}

/** Read KEY=value lines from .env.local into process.env (if the file exists). */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  console.log('Loaded settings from .env.local');
}
