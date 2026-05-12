/**
 * Notification sound engine.
 *
 * Uses HTMLAudioElement for broad browser compatibility.
 * All play() calls are fire-and-forget — autoplay policy rejections are
 * swallowed silently so the app never crashes or throws on audio failure.
 *
 * Per-kind cooldowns prevent the same sound from stacking rapidly:
 *   - push:   500 ms  (activity chime)
 *   - failed: 30 000 ms  (error tone — avoids spam on repeated poll failures)
 */

type SoundKind = 'push' | 'failed';

const PATHS: Record<SoundKind, string> = {
  push:   '/Sound/Push notification.wav',
  failed: '/Sound/Failed action.wav',
};

const COOLDOWNS: Record<SoundKind, number> = {
  push:   500,
  failed: 30_000,
};

const _cache: Partial<Record<SoundKind, HTMLAudioElement>> = {};
const _lastAt: Partial<Record<SoundKind, number>> = {};

function _get(kind: SoundKind): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!_cache[kind]) {
    const a = new Audio(PATHS[kind]);
    a.preload = 'auto';
    _cache[kind] = a;
  }
  return _cache[kind]!;
}

function _play(kind: SoundKind, volume: number): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (_lastAt[kind] ?? 0) < COOLDOWNS[kind]) return;
  _lastAt[kind] = now;
  const audio = _get(kind);
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.play().catch(() => { /* autoplay policy — intentionally silent */ });
}

/** Standard activity / push notification chime. */
export function playPushSound(volume = 0.7): void {
  _play('push', volume);
}

/** Error / failure notification sound. */
export function playFailedSound(volume = 0.75): void {
  _play('failed', volume);
}

/**
 * Preloads both audio files without playing them.
 * Call early (e.g. on first user interaction) to satisfy strict autoplay policies.
 */
export function primeNotificationSounds(): void {
  _get('push');
  _get('failed');
}
