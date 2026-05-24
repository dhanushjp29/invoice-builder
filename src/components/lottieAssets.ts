/**
 * Lottie sources. Served from the same origin (`/lottie/*.lottie` in /public)
 * so there's no cross-origin fetch on first paint.
 *
 * Lives in its own module (not LottieLoader.tsx) so Fast Refresh keeps working
 * for the component file — the react-refresh rule requires component files to
 * export only components.
 */
export const LOTTIE = {
  common: '/lottie/loader-common.lottie',
  email: '/lottie/loader-email.lottie',
};

/**
 * Warm the browser cache for every Lottie source. Called once on app boot from
 * `App.tsx` — by the time the user triggers a long operation the bytes are
 * already in the HTTP cache, so the overlay paints immediately.
 */
export function preloadLottieAssets() {
  for (const url of Object.values(LOTTIE)) {
    fetch(url, { cache: 'force-cache' }).catch(() => { /* best effort */ });
  }
}
