/**
 * music.js
 * ---------------------------------------------------------------------------
 * Background music: an HTML5 <audio> element that shuffles through the mp3
 * files in music/ and keeps playing across every menu and game, separate
 * from the sound effects in audio.js (its own mute button and its own
 * saved on/off setting).
 *
 * Browsers only allow audio to start after the player touches the screen, so
 * main.js calls unlock() on the first tap, same as audio.js's unlock().
 */
import { CONFIG } from './config.js';
import { loadBool, saveBool } from './storage.js';

// Every track in the music/ folder. Drop a new .mp3 in there and add its
// filename here to include it in the shuffle.
const TRACKS = [
  'Burning Bridges.mp3',
  'B’s On The Table.mp3',
  'Dust.mp3',
  'Janice STFU.mp3',
  'Make Them Cry.mp3',
  'Make Them Pay.mp3',
  'National Treasures.mp3',
  'Ran To Atlanta.mp3',
  'Shabang.mp3',
  'Whisper My Name.mp3',
];

/** Returns a new array with the same items in random order. */
function shuffled(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.volume = CONFIG.music.volume;
    this.audio.addEventListener('ended', () => this.playNext());
    this.muted = loadBool(CONFIG.storageKeys.musicMuted, false);
    this.playlist = shuffled(TRACKS);
    this.index = -1;
    this.started = false; // true once the player has tapped and music was allowed to start
  }

  /** Start the playlist (unless muted). Must be called from a tap or click. */
  unlock() {
    if (this.started) return;
    this.started = true;
    if (!this.muted) this.playNext();
  }

  /** Move to the next track, reshuffling once the whole playlist has played. */
  playNext() {
    this.index++;
    if (this.index >= this.playlist.length) {
      this.playlist = shuffled(TRACKS);
      this.index = 0;
    }
    this.audio.src = `music/${encodeURIComponent(this.playlist[this.index])}`;
    this.audio.play().catch(() => {}); // the browser may still refuse before the first tap
  }

  setMuted(muted) {
    this.muted = muted;
    saveBool(CONFIG.storageKeys.musicMuted, muted);
    if (muted) {
      this.audio.pause();
    } else if (this.started) {
      if (this.audio.src) this.audio.play().catch(() => {});
      else this.playNext();
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
