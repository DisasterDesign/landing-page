/**
 * Haptic feedback helper. Uses the Web Vibration API where supported (Android,
 * desktop browsers vary). On iOS Safari, Vibration is not yet exposed — these
 * calls become silent no-ops, which is fine.
 *
 * Use sparingly: only on material actions ("I just locked something in"),
 * never on every tap.
 */

function safeVibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof v !== "function") return;
  try {
    const arg = Array.isArray(pattern) ? pattern : [pattern];
    v.call(navigator, arg);
  } catch {
    /* swallow */
  }
}

/** Short crisp tap — small confirmations (toggle, single tap) */
export function tapLight() {
  safeVibrate(8);
}

/** Medium tap — standard confirmations (mark done, item added) */
export function tapMedium() {
  safeVibrate(15);
}

/** Heavier tap — important confirmations (delete confirmed, action committed) */
export function tapHeavy() {
  safeVibrate(25);
}

/** Two-pulse success pattern */
export function success() {
  safeVibrate([10, 50, 20]);
}

/** Three-pulse error pattern */
export function error() {
  safeVibrate([30, 60, 30, 60, 30]);
}
