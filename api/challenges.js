/**
 * api/challenges.js  →  /api/challenges
 * ---------------------------------------------------------------------------
 * Online challenges between friends. They're "take your turn whenever":
 *   1. You play a 60-second Blitz, then send it to a friend ('create').
 *   2. Your friend sees it as "Your turn", plays the same difficulty, and
 *      their score is sent back ('finish'). Higher score wins.
 *
 *   GET  /api/challenges → { challenges: [...] }, newest first, each seen from YOUR side:
 *        { id, opponent, difficulty, myScore, theirScore, status }
 *        status: 'yourTurn' | 'waiting' | 'won' | 'lost' | 'tie' | 'declined'
 *   POST /api/challenges { action: 'create',  friend, difficulty, score } → { challenge }
 *   POST /api/challenges { action: 'finish',  id, score }                 → { challenge }
 *   POST /api/challenges { action: 'decline', id }                        → {}
 */
import { query } from './_lib/db.js';
import { endpoint, body, ApiError, findUser } from './_lib/auth.js';
import { DIFFICULTIES } from '../js/modes.js';
import { SELECT, fromMySide } from './_lib/challenge-view.js';

const LIST_LIMIT = 30; // how many recent challenges to send back
const MAX_SCORE = 10_000; // no real 60-second game gets anywhere near this

export default endpoint(async (req, user) => {
  if (req.method === 'GET') {
    const rows = await query(`${SELECT} WHERE from_id = ? OR to_id = ? ORDER BY updated_at DESC LIMIT ?`, [user.id, user.id, LIST_LIMIT]);
    return { challenges: rows.map((row) => fromMySide(row, user.id)) };
  }

  const data = body(req);
  const now = Date.now();

  if (data.action === 'create') {
    const friend = await findUser(data.friend);
    const isFriend = await query('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [user.id, friend.id]);
    if (!isFriend.length) throw new ApiError(403, `Add ${friend.username} as a friend first`);
    if (!DIFFICULTIES[data.difficulty]) throw new ApiError(400, 'Unknown difficulty');

    const [row] = await query(
      `INSERT INTO challenges (from_id, to_id, difficulty, from_score, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'waiting', ?, ?) RETURNING id`,
      [user.id, friend.id, data.difficulty, cleanScore(data.score), now, now],
    );
    return { challenge: await loadChallenge(row.id, user.id) };
  }

  if (data.action === 'finish') {
    // Only the challenged friend can finish it, and only once
    const [row] = await query(
      `UPDATE challenges SET to_score = ?, status = 'done', updated_at = ?
        WHERE id = ? AND to_id = ? AND status = 'waiting' RETURNING id`,
      [cleanScore(data.score), now, Number(data.id), user.id],
    );
    if (!row) throw new ApiError(409, 'That challenge is already finished');
    return { challenge: await loadChallenge(row.id, user.id) };
  }

  if (data.action === 'decline') {
    await query(`UPDATE challenges SET status = 'declined', updated_at = ? WHERE id = ? AND to_id = ? AND status = 'waiting'`, [
      now, Number(data.id), user.id,
    ]);
    return {};
  }

  throw new ApiError(400, 'Unknown action');
});

async function loadChallenge(id, userId) {
  const [row] = await query(`${SELECT} WHERE challenges.id = ?`, [id]);
  return fromMySide(row, userId);
}

function cleanScore(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_SCORE) : 0;
}
