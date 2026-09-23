/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Tiny helpers for saving data in the browser (localStorage).
 *
 * localStorage can throw errors (private browsing, storage full, blocked
 * cookies...), so every call is wrapped in try/catch. If saving fails the
 * game simply keeps going without remembering.
 */

export function loadNumber(key, fallback = 0) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function saveNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable — ignore.
  }
}

export function loadBool(key, fallback = false) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

export function saveBool(key, value) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Storage unavailable — ignore.
  }
}

/** Load a saved object/array (stored as JSON text). */
export function loadJSON(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — ignore.
  }
}
