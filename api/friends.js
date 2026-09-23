/**
 * api/friends.js  →  /api/friends
 * ---------------------------------------------------------------------------
 * Your friends list and each friend's stats.
 * Adding someone makes you friends both ways, no request/accept step.
 *
 *   GET  /api/friends
 *        → { friends: [{ username, bests: { blitz: { easy: 12 } }, record: { wins, losses, ties } }] }
 *   GET  /api/friends?username=Sam
 *        → { friend: { username, bests, baskets, record, games: [...challenges vs you, newest first] } }
 *   POST /api/friends { action: 'add',    username } → {}
 *   POST /api/friends { action: 'remove', username } → {}
 */
import { query } from './_lib/db.js';
import { endpoint, body, ApiError, findUser } from './_lib/auth.js';
import { SELECT, fromMySide, record } from './_lib/challenge-view.js';

const HISTORY_LIMIT = 50; // games shown on a friend's page

export default endpoint(async (req, user) => {
  if (req.method === 'GET') {
    const username = new URL(req.url, 'http://localhost').searchParams.get('username');
    return username ? { friend: await friendDetails(user, username) } : { friends: await friendsList(user) };
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

/** Every friend with their best scores and your win/loss record against them. */
async function friendsList(user) {
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
    if (!byName.has(row.username)) byName.set(row.username, { username: row.username, bests: {}, record: record([]) });
    if (row.mode) (byName.get(row.username).bests[row.mode] ??= {})[row.difficulty] = row.best;
  }

  // Finished challenges → wins/losses/ties per opponent
  const games = await query(`${SELECT} WHERE status = 'done' AND (from_id = ? OR to_id = ?)`, [user.id, user.id]);
  const byOpponent = new Map();
  for (const row of games) {
    const game = fromMySide(row, user.id);
    if (!byOpponent.has(game.opponent)) byOpponent.set(game.opponent, []);
    byOpponent.get(game.opponent).push(game);
  }
  for (const friend of byName.values()) friend.record = record(byOpponent.get(friend.username) ?? []);
  return [...byName.values()];
}

/** One friend's page: their bests, total baskets, and every game you've played each other. */
async function friendDetails(user, username) {
  const friend = await findUser(username);
  const isFriend = await query('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [user.id, friend.id]);
  if (!isFriend.length) throw new ApiError(403, `${friend.username} isn’t your friend yet`);

  const bests = {};
  for (const row of await query('SELECT mode, difficulty, best FROM scores WHERE user_id = ?', [friend.id])) {
    (bests[row.mode] ??= {})[row.difficulty] = row.best;
  }
  const [{ total }] = await query('SELECT COALESCE(SUM(count), 0) AS total FROM lifetime WHERE user_id = ?', [friend.id]);

  // All your games together count toward the record; only the newest are listed
  const rows = await query(`${SELECT} WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY updated_at DESC`, [
    user.id, friend.id, friend.id, user.id,
  ]);
  const games = rows.map((row) => fromMySide(row, user.id));
  return { username: friend.username, bests, baskets: total, record: record(games), games: games.slice(0, HISTORY_LIMIT) };
}
