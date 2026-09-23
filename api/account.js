/**
 * api/account.js  →  /api/account
 * ---------------------------------------------------------------------------
 * Sign up, log in, log out, and "who am I?".
 *
 *   GET  /api/account                                   → { username }
 *   POST /api/account { action: 'signup', username, password } → { token, username }
 *   POST /api/account { action: 'login',  username, password } → { token, username }
 *   POST /api/account { action: 'logout' }              → {}
 */
import { query } from './_lib/db.js';
import {
  endpoint, body, ApiError, hashPassword, checkPassword, createSession, deleteSession,
  USERNAME_RULE, MIN_PASSWORD_LENGTH,
} from './_lib/auth.js';

export default endpoint(
  async (req, user) => {
    if (req.method === 'GET') {
      if (!user) throw new ApiError(401, 'Please log in again');
      return { username: user.username };
    }

    const { action, username = '', password = '' } = body(req);
    const name = String(username).trim();

    if (action === 'signup') {
      if (!USERNAME_RULE.test(name)) throw new ApiError(400, 'Usernames are 3–16 letters, numbers or _');
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(400, `Passwords need at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      const taken = await query('SELECT id FROM users WHERE username = ?', [name]);
      if (taken.length) throw new ApiError(409, 'That username is taken');

      const [created] = await query('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?) RETURNING id', [
        name, hashPassword(String(password)), Date.now(),
      ]);
      return { token: await createSession(created.id), username: name };
    }

    if (action === 'login') {
      const [found] = await query('SELECT id, username, pass_hash FROM users WHERE username = ?', [name]);
      if (!found || !checkPassword(String(password), found.pass_hash)) {
        throw new ApiError(401, 'Wrong username or password');
      }
      return { token: await createSession(found.id), username: found.username };
    }

    if (action === 'logout') {
      await deleteSession(req);
      return {};
    }

    throw new ApiError(400, 'Unknown action');
  },
  { login: false }, // signing up and logging in obviously can't require a login
);
