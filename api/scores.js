/**
 * api/scores.js  →  /api/scores
 * ---------------------------------------------------------------------------
 * Saves your best scores, lifetime baskets and coins to your account, so they
 * follow you to other devices and your friends can see them.
 *
 *   GET  /api/scores → { bests: { blitz: { easy: 12 } }, baskets: { blitz: { easy: 200 } },
 *                        wallet: { earned, spent, bonus, owned: ['ice', 'stadium:inferno'] } }
 *   POST /api/scores { bests, baskets, wallet: { earned, spent, owned } } → the same, after saving
 *
 * Saving always keeps the HIGHER number, so an old phone can't lower a record.
 * Coins work the same way: `earned` and `spent` only ever go up (the balance is
 * earned + bonus − spent), and bought ball styles, stadiums and floors are added to the list.
 * (Scores come from the player's own browser, so a determined cheater could
 * fake one. That's normal for a casual game like this.)
 */
import { query } from './_lib/db.js';
import { endpoint, body } from './_lib/auth.js';
import { MODES, DIFFICULTIES } from '../js/modes.js';
import { isOwnedKey } from '../js/wallet.js';

const MAX_SCORE = 1_000_000; // anything above this is clearly nonsense

export default endpoint(async (req, user) => {
  if (req.method === 'POST') {
    const { bests = {}, baskets = {}, wallet } = body(req);
    if (wallet) await saveWallet(user.id, wallet);

    for (const mode of Object.keys(MODES)) {
      for (const diff of Object.keys(DIFFICULTIES)) {
        const best = cleanNumber(bests[mode]?.[diff]);
        if (best > 0) {
          await query(
            `INSERT INTO scores (user_id, mode, difficulty, best) VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, mode, difficulty) DO UPDATE SET best = MAX(best, excluded.best)`,
            [user.id, mode, diff, best],
          );
        }
        const count = cleanNumber(baskets[mode]?.[diff]);
        if (count > 0) {
          await query(
            `INSERT INTO lifetime (user_id, mode, difficulty, count) VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, mode, difficulty) DO UPDATE SET count = MAX(count, excluded.count)`,
            [user.id, mode, diff, count],
          );
        }
      }
    }
  }

  // Send back everything saved for this player
  const result = { bests: {}, baskets: {}, wallet: await loadWallet(user.id) };
  for (const row of await query('SELECT mode, difficulty, best FROM scores WHERE user_id = ?', [user.id])) {
    (result.bests[row.mode] ??= {})[row.difficulty] = row.best;
  }
  for (const row of await query('SELECT mode, difficulty, count FROM lifetime WHERE user_id = ?', [user.id])) {
    (result.baskets[row.mode] ??= {})[row.difficulty] = row.count;
  }
  return result;
});

/** Keep the higher coin counts, and add anything newly bought (balls, stadiums, floors). */
async function saveWallet(userId, wallet) {
  const owned = new Set((await loadWallet(userId)).owned);
  for (const id of Array.isArray(wallet.owned) ? wallet.owned : []) if (typeof id === 'string' && isOwnedKey(id)) owned.add(id);
  await query(
    `INSERT INTO wallets (user_id, earned, spent, owned) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET earned = MAX(earned, excluded.earned),
       spent = MAX(spent, excluded.spent), owned = excluded.owned`,
    [userId, cleanNumber(wallet.earned), cleanNumber(wallet.spent), JSON.stringify([...owned])],
  );
}

async function loadWallet(userId) {
  const [row] = await query('SELECT earned, spent, bonus, owned FROM wallets WHERE user_id = ?', [userId]);
  if (!row) return { earned: 0, spent: 0, bonus: 0, owned: [] };
  return { earned: row.earned, spent: row.spent, bonus: row.bonus, owned: JSON.parse(row.owned) };
}

/** A whole number between 0 and MAX_SCORE (anything else becomes 0). */
function cleanNumber(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_SCORE) : 0;
}
