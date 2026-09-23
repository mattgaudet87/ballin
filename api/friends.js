/**
 * api/friends.js  →  /api/friends
 * ---------------------------------------------------------------------------
 * Your friends list, with each friend's best scores (for the leaderboard).
 * Adding someone makes you friends both ways, no request/accept step.
 *
 *   GET  /api/friends                          → { friends: [{ username, bests: { blitz: { easy: 12 } } }] }
 *   POST /api/friends { action: 'add',    username } → {}
 *   POST /api/friends { action: 'remove', username } → {}
 */
import { query } from './_lib/db.js';
import { endpoint, body, ApiError, findUser } from './_lib/auth.js';

export default endpoint(async (req, user) => {
  if (req.method === 'GET') {
    const rows = await query(
      `SELECT users.username, scores.mode, scores.difficulty, scores.best
         FROM friends
         JOIN users ON users.id = friends.friend_id
         LEFT JOIN scores ON scores.user_id = users.id
        WHERE friends.user_id = ?
        ORDER BY users.username COLLATE NOCASE`,
      [user.id],
    );
    // One row per score → one entry per friend
    const byName = new Map();
    for (const row of rows) {
      if (!byName.has(row.username)) byName.set(row.username, { username: row.username, bests: {} });
      if (row.mode) {
        const bests = byName.get(row.username).bests;
        (bests[row.mode] ??= {})[row.difficulty] = row.best;
      }
    }
    return { friends: [...byName.values()] };
  }

  const { action, username } = body(req);
  const friend = await findUser(username);
  if (friend.id === user.id) throw new ApiError(400, 'You can’t add yourself');

  if (action === 'add') {
    const now = Date.now();
    await query('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)', [user.id, friend.id, now]);
    await query('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)', [friend.id, user.id, now]);
    return {};
  }

  if (action === 'remove') {
    await query('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [
      user.id, friend.id, friend.id, user.id,
    ]);
    return {};
  }

  throw new ApiError(400, 'Unknown action');
});
