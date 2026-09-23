/**
 * api/_lib/auth.js
 * ---------------------------------------------------------------------------
 * Passwords, logins and small helpers every api/ file shares.
 *
 * HOW LOGIN WORKS
 *   - Passwords are never stored. We store a scrypt hash (a slow, salted
 *     one-way scramble) and compare hashes when someone logs in.
 *   - Logging in creates a random session token. The game keeps it in
 *     localStorage and sends it with every request as
 *     "Authorization: Bearer <token>". The database only keeps a hash of it.
 *
 * Only Node's built-in `crypto` module is used, so there's nothing to install.
 */
import crypto from 'node:crypto';
import { query } from './db.js';

export const USERNAME_RULE = /^[a-zA-Z0-9_]{3,16}$/;
export const MIN_PASSWORD_LENGTH = 6;

// --- Passwords ------------------------------------------------------------------

/** Turn a password into "scrypt$<salt>$<hash>" for storing. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function checkPassword(password, stored) {
  const [, salt, hash] = stored.split('$');
  const attempt = crypto.scryptSync(password, salt, 64);
  // timingSafeEqual takes the same time whether the first letter or the last is wrong
  return crypto.timingSafeEqual(attempt, Buffer.from(hash, 'hex'));
}

// --- Sessions ---------------------------------------------------------------------

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** Log a user in: returns the token the game should keep. */
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await query('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)', [sha256(token), userId, Date.now()]);
  return token;
}

export async function deleteSession(req) {
  const token = bearerToken(req);
  if (token) await query('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
}

/** Who is making this request? Returns { id, username } or null. */
export async function currentUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const rows = await query(
    'SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?',
    [sha256(token)],
  );
  return rows[0] ?? null;
}

function bearerToken(req) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// --- Request / response helpers -----------------------------------------------------

/** An error with an HTTP status, e.g. throw new ApiError(404, 'No such user'). */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wrap an api/ handler so errors turn into JSON replies like
 * { error: "No such user" } instead of crashing.
 * `handler(req, user)` returns the data to send back.
 * With { login: true } it refuses requests that aren't logged in.
 */
export function endpoint(handler, { login = true } = {}) {
  return async (req, res) => {
    try {
      const user = await currentUser(req);
      if (login && !user) throw new ApiError(401, 'Please log in again');
      send(res, 200, await handler(req, user));
    } catch (err) {
      if (!(err instanceof ApiError)) console.error(err);
      send(res, err.status ?? 500, { error: err instanceof ApiError ? err.message : 'Server error, try again' });
    }
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data ?? {}));
}

/** The JSON the game sent (Vercel and tools/dev.mjs both put it on req.body). */
export function body(req) {
  const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  return data ?? {};
}

/** Find a user by name (any capitalization), or throw a friendly 404. */
export async function findUser(username) {
  const rows = await query('SELECT id, username FROM users WHERE username = ?', [String(username ?? '').trim()]);
  if (!rows[0]) throw new ApiError(404, `No player called "${String(username).slice(0, 20)}"`);
  return rows[0];
}
