/**
 * api/_lib/challenge-view.js
 * ---------------------------------------------------------------------------
 * Shared by api/challenges.js and api/friends.js: how to load challenges and
 * describe them from the side of the player who's asking.
 */

/** SELECT that also brings back both players' usernames. Add your own WHERE. */
export const SELECT = `SELECT challenges.*, a.username AS from_name, b.username AS to_name
                  FROM challenges
                  JOIN users a ON a.id = challenges.from_id
                  JOIN users b ON b.id = challenges.to_id`;

export /** Describe a challenge from the point of view of the player asking. */
function fromMySide(row, userId) {
  const iSent = row.from_id === userId;
  const myScore = iSent ? row.from_score : row.to_score;
  const theirScore = iSent ? row.to_score : row.from_score;

  let status;
  if (row.status === 'declined') status = 'declined';
  else if (row.status === 'waiting') status = iSent ? 'waiting' : 'yourTurn';
  else status = myScore > theirScore ? 'won' : myScore < theirScore ? 'lost' : 'tie';

  return {
    id: row.id,
    opponent: iSent ? row.to_name : row.from_name,
    difficulty: row.difficulty,
    // Don't reveal the challenger's score before you've played: no peeking at the target!
    myScore,
    theirScore: status === 'yourTurn' ? null : theirScore,
    status,
    updatedAt: row.updated_at,
  };
}

/** Add up wins, losses and ties from challenges already seen from your side. */
export function record(challenges) {
  const r = { wins: 0, losses: 0, ties: 0 };
  for (const c of challenges) {
    if (c.status === 'won') r.wins++;
    else if (c.status === 'lost') r.losses++;
    else if (c.status === 'tie') r.ties++;
  }
  return r;
}
