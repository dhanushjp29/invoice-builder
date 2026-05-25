import { useEffect, useRef, useState } from 'react';
import { LOTTIE } from './lottieAssets';

/** Minimum time the loader stays visible after first opening. Stops the
 *  overlay from flashing for sub-second operations and gives the animation
 *  time to actually be perceived. */
const MIN_VISIBLE_MS = 1000;

/**
 * Off-screen preloader — placeholder for future asset preloading. The actual
 * HTTP cache warming happens in `preloadLottieAssets()` called from App boot.
 * Kept as an exported component so existing App.tsx imports don't break.
 */
export function LottiePreloader() {
  return null;
}

interface Props {
  open: boolean;
  variant?: 'common' | 'email';
  /**
   * Optional pixel cap for the loader's longest side. When omitted, the video
   * renders at its natural intrinsic dimensions (no upscaling, no blur).
   */
  size?: number;
}

/**
 * Fullscreen blurred overlay with a WebM loader video centred on screen.
 *
 * Performance notes:
 * - <video> playback runs in the browser's dedicated media pipeline (off the
 *   main thread), so heavy main-thread work like html2canvas during PDF
 *   generation does NOT freeze the animation.
 * - Backdrop uses `opacity` + `visibility` transitions only.
 * - `contain: strict` keeps the overlay on its own compositor layer so
 *   opening/closing never repaints the page underneath.
 * - Minimum visible time of 1s baked in so sub-second operations don't flash.
 */
export default function LottieLoader({
  open,
  variant = 'common',
  size,
}: Props) {
  // Enforce a minimum display time so the animation is always perceivable
  // (even for sub-second operations). When the caller flips `open` from true
  // to false, we hold `effectiveOpen` true until at least MIN_VISIBLE_MS has
  // passed since the open event.
  const [holdingOpen, setHoldingOpen] = useState(false);
  const effectiveOpen = open || holdingOpen;
  const openedAt = useRef<number | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Bridging an async prop transition (open → false) into a delayed close
    // is a legitimate use of setState-in-effect; the rule is disabled for
    // this block because the delay can't be expressed purely via render-time
    // derivation.
    if (open) {
      openedAt.current = performance.now();
      setHoldingOpen(false);
      return;
    }
    const opened = openedAt.current;
    openedAt.current = null;
    if (opened === null) return;
    const remaining = MIN_VISIBLE_MS - (performance.now() - opened);
    if (remaining <= 0) {
      setHoldingOpen(false);
      return;
    }
    setHoldingOpen(true);
    const t = window.setTimeout(() => setHoldingOpen(false), remaining);
    return () => window.clearTimeout(t);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Lock body scroll while visible so the backdrop never repaints due to scroll.
  const prevOverflow = useRef<string>('');
  useEffect(() => {
    if (!effectiveOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [effectiveOpen]);

  const src = variant === 'email' ? LOTTIE.email : LOTTIE.common;

  return (
    <div
      role={effectiveOpen ? 'status' : undefined}
      aria-live={effectiveOpen ? 'polite' : undefined}
      aria-hidden={!effectiveOpen}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        opacity: effectiveOpen ? 1 : 0,
        visibility: effectiveOpen ? 'visible' : 'hidden',
        pointerEvents: effectiveOpen ? 'auto' : 'none',
        // Open is instant, close fades out smoothly.
        transition: effectiveOpen
          ? 'opacity 60ms linear, visibility 0s linear 0s'
          : 'opacity 180ms linear, visibility 0s linear 180ms',
        willChange: 'opacity',
        contain: 'strict',
      }}
    >
      <video
        key={src}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          // Render at the video's intrinsic resolution — no upscaling, which
          // was causing visible blur/breakup in the browser. If a `size` cap is
          // supplied, the video is constrained but never enlarged past native.
          maxWidth: size ? `${size}px` : undefined,
          maxHeight: size ? `${size}px` : undefined,
          width: 'auto',
          height: 'auto',
          background: 'transparent',
        }}
      />
    </div>
  );
}
