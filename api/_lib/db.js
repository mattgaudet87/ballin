/**
 * api/_lib/db.js
 * ---------------------------------------------------------------------------
 * The database for online play (accounts, friends, scores, challenges).
 *
 * ON VERCEL it talks to a Turso database over Turso's HTTP API, using plain
 * fetch(). No npm packages needed. It reads two environment variables that
 * you set in the Vercel dashboard (Project → Settings → Environment Variables):
 *   TURSO_DATABASE_URL   e.g. libsql://ballin-yourname.turso.io
 *   TURSO_AUTH_TOKEN     from `turso db tokens create ballin`
 *
 * ON YOUR MAC (tools/dev.mjs) with no TURSO_DATABASE_URL set, it uses a local
 * SQLite file instead (.local/ballin-dev.db), so you can test everything
 * without internet. Turso is SQLite too, so the same SQL works in both.
 *
 * Files in api/_lib/ start with "_" so Vercel doesn't turn them into URLs.
 */

const LOCAL_DB_FILE = '.local/ballin-dev.db';

/** The tables. "IF NOT EXISTS" makes this safe to run every time the server starts. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // Logins. We only store a hash of each token, so a leaked database can't log anyone in.
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // Friendships are stored both ways (A→B and B→A).
  `CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  )`,
  // Best score per mode per difficulty
  `CREATE TABLE IF NOT EXISTS scores (
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    best INTEGER NOT NULL,
    PRIMARY KEY (user_id, mode, difficulty)
  )`,
  // Lifetime baskets per mode per difficulty
  `CREATE TABLE IF NOT EXISTS lifetime (
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, mode, difficulty)
  )`,
  // The first version counted baskets per mode only (replaced by `lifetime`;
  // each phone re-uploads its counts, so nothing is lost).
  `DROP TABLE IF EXISTS baskets`,
  // Online challenges. The challenger plays first, then the friend.
  // status: 'waiting' (friend's turn) | 'done' | 'declined'
  `CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    from_score INTEGER NOT NULL,
    to_score INTEGER,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS challenges_from ON challenges (from_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS challenges_to ON challenges (to_id, updated_at)`,
];

/**
 * Run one SQL statement and get the rows back as plain objects.
 * Use ? placeholders for values, never paste user input into the SQL text:
 *   await query('SELECT id FROM users WHERE username = ?', [name])
 * For INSERT/UPDATE, add "RETURNING ..." if you need the new row back.
 */
export async function query(sql, args = []) {
  await ready();
  return backend.query(sql, args);
}

// ---------------------------------------------------------------------------
// Setup: pick Turso or the local file, then make sure the tables exist
// ---------------------------------------------------------------------------

let backend = null;
let readyPromise = null;

function ready() {
  readyPromise ??= (async () => {
    backend = await pickBackend();
    for (const sql of SCHEMA) await backend.query(sql, []);
  })().catch((err) => {
    readyPromise = null; // try again on the next request
    throw err;
  });
  return readyPromise;
}

async function pickBackend() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return tursoBackend(url, process.env.TURSO_AUTH_TOKEN);
  if (process.env.VERCEL) throw new Error('TURSO_DATABASE_URL is not set in Vercel');
  return localBackend();
}

// --- Turso (over HTTP) --------------------------------------------------------

function tursoBackend(url, token) {
  // libsql://name.turso.io → https://name.turso.io/v2/pipeline
  const endpoint = url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';

  return {
    async query(sql, args) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ type: 'execute', stmt: { sql, args: args.map(toTursoValue) } }, { type: 'close' }],
        }),
      });
      if (!response.ok) throw new Error(`Turso HTTP ${response.status}: ${await response.text()}`);

      const result = (await response.json()).results[0];
      if (result.type === 'error') throw new Error(`Turso: ${result.error.message}`);

      const { cols, rows } = result.response.result;
      return rows.map((row) => Object.fromEntries(row.map((cell, i) => [cols[i].name, fromTursoValue(cell)])));
    },
  };
}

/** Turso's HTTP API wants every value tagged with its type (integers as text). */
function toTursoValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer', value: String(value) } : { type: 'float', value };
  }
  return { type: 'text', value: String(value) };
}

function fromTursoValue(cell) {
  if (cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  return cell.value;
}

// --- Local SQLite file (only on your Mac) ----------------------------------------

async function localBackend() {
  const fs = await import('node:fs');
  const { DatabaseSync } = await import('node:sqlite'); // built into Node 22.13+
  fs.mkdirSync('.local', { recursive: true });
  const db = new DatabaseSync(LOCAL_DB_FILE);
  console.log(`Using local test database ${LOCAL_DB_FILE} (set TURSO_DATABASE_URL to use Turso)`);

  return {
    async query(sql, args) {
      // .all() runs any statement and returns its rows ([] if it has none)
      return db.prepare(sql).all(...args.map((v) => v ?? null));
    },
  };
}
