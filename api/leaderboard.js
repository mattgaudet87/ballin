/**
 * api/leaderboard.js  →  /api/leaderboard
 * ---------------------------------------------------------------------------
 * Top players across every account, for the home screen's Leaderboard button.
 * Public — no login needed, since it's just everyone's public best scores.
 *
 *   GET /api/leaderboard?category=baskets|blitz30|blitz|hothand&difficulty=easy|normal|hard
 *     → { rows: [{ username, value }] }, best first
 *
 * `baskets` ranks by lifetime baskets made on that difficulty, added up across
 * every mode. The other categories rank by that mode's best score on that
 * difficulty (see the `scores`/`lifetime` tables in api/_lib/db.js).
 */
import { query } from './_lib/db.js';
import { endpoint, ApiError } from './_lib/auth.js';
import { DIFFICULTIES } from '../js/modes.js';

const SCORE_CATEGORIES = ['blitz30', 'blitz', 'hothand'];
const LIMIT = 50;

export default endpoint(async (req) => {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const category = params.get('category') ?? 'baskets';
  const difficulty = params.get('difficulty') ?? 'normal';
  if (!DIFFICULTIES[difficulty]) throw new ApiError(400, 'Unknown difficulty');
  if (category !== 'baskets' && !SCORE_CATEGORIES.includes(category)) throw new ApiError(400, 'Unknown category');

  const rows = category === 'baskets'
    ? await query(
        `SELECT users.username, SUM(lifetime.count) AS value
           FROM lifetime JOIN users ON users.id = lifetime.user_id
          WHERE lifetime.difficulty = ?
          GROUP BY users.id, users.username
          ORDER BY value DESC
          LIMIT ?`,
        [difficulty, LIMIT],
      )
    : await query(
        `SELECT users.username, scores.best AS value
           FROM scores JOIN users ON users.id = scores.user_id
          WHERE scores.mode = ? AND scores.difficulty = ?
          ORDER BY scores.best DESC
          LIMIT ?`,
        [category, difficulty, LIMIT],
      );
  return { rows: rows.filter((row) => row.value > 0) };
}, { login: false });
