/**
 * online.js
 * ---------------------------------------------------------------------------
 * Talks to the game's server (the files in the api/ folder) for online play:
 * accounts, friends, saved scores and challenges.
 *
 * After you log in, the server gives back a token. We keep it in localStorage
 * so you stay logged in, and send it with every request. Every method here
 * returns a Promise and throws an Error with a friendly message if something
 * goes wrong (no internet, wrong password...), so main.js can show it.
 */
import { CONFIG } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

const KEY = CONFIG.storageKeys.account;

export class Online {
  constructor() {
    // { username, token } or null when logged out
    this.account = loadJSON(KEY, null);
  }

  get username() {
    return this.account?.username ?? null;
  }

  // --- Account ----------------------------------------------------------------

  signUp(username, password) {
    return this.logInWith({ action: 'signup', username, password });
  }

  logIn(username, password) {
    return this.logInWith({ action: 'login', username, password });
  }

  async logInWith(details) {
    const { token, username } = await this.request('POST', 'account', details);
    this.account = { token, username };
    saveJSON(KEY, this.account);
    return username;
  }

  async logOut() {
    // Forget the login on this device even if the server can't be reached
    const request = this.request('POST', 'account', { action: 'logout' }).catch(() => {});
    this.account = null;
    saveJSON(KEY, null);
    await request;
  }

  // --- Friends -------------------------------------------------------------------

  /** [{ username, bests: { blitz: { easy: 12 } } }] */
  async friends() {
    return (await this.request('GET', 'friends')).friends;
  }

  addFriend(username) {
    return this.request('POST', 'friends', { action: 'add', username });
  }

  removeFriend(username) {
    return this.request('POST', 'friends', { action: 'remove', username });
  }

  // --- Scores ----------------------------------------------------------------------

  /** Save records to the account. Returns everything saved there (the higher of each). */
  syncScores(bests, baskets) {
    return this.request('POST', 'scores', { bests, baskets });
  }

  // --- Challenges --------------------------------------------------------------------

  /** Newest first: [{ id, opponent, difficulty, myScore, theirScore, status }] */
  async challenges() {
    return (await this.request('GET', 'challenges')).challenges;
  }

  async sendChallenge(friend, difficulty, score) {
    return (await this.request('POST', 'challenges', { action: 'create', friend, difficulty, score })).challenge;
  }

  async finishChallenge(id, score) {
    return (await this.request('POST', 'challenges', { action: 'finish', id, score })).challenge;
  }

  declineChallenge(id) {
    return this.request('POST', 'challenges', { action: 'decline', id });
  }

  // --- Sending requests -----------------------------------------------------------------

  async request(method, path, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.account) headers.Authorization = `Bearer ${this.account.token}`;

    let response;
    try {
      response = await fetch(`/api/${path}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
    } catch {
      throw new Error('Can’t reach the server. Check your internet.');
    }

    const reply = await response.json().catch(() => ({}));
    if (response.status === 401 && this.account) {
      // The login expired or was removed: log out on this device too
      this.account = null;
      saveJSON(KEY, null);
    }
    if (!response.ok) {
      // A 404 with no JSON means the api/ folder isn't running (e.g. tools/serve.py)
      throw new Error(reply.error ?? 'Online play isn’t available here. Run: node tools/dev.mjs');
    }
    return reply;
  }
}
