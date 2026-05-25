/**
 * Loader sources. WebM videos served from `/public/lottie/*.webm`, same-origin
 * so there's no cross-origin fetch on first paint.
 *
 * Why WebM video instead of .lottie / dotlottie-web:
 * - <video> playback runs in the browser's dedicated media pipeline (off the
 *   main thread), so heavy main-thread work like html2canvas during PDF
 *   generation never freezes the animation. The old Lottie player used
 *   requestAnimationFrame on the main thread → froze every time.
 * - Zero JS runtime cost — no WASM, no parsing, just a <video> tag.
 */
export const LOTTIE = {
  common: '/lottie/loader-common.webm',
  email: '/lottie/loader-email.webm',
};

/**
 * Warm the browser HTTP cache for every loader source on app boot, so the
 * overlay paints instantly the first time the user triggers a long operation.
 */
export function preloadLottieAssets() {
  for (const url of Object.values(LOTTIE)) {
    fetch(url, { cache: 'force-cache' }).catch(() => { /* best effort */ });
  }
}
