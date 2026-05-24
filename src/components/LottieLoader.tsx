import { useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { LOTTIE } from './lottieAssets';

/**
 * Invisible, off-screen Lottie players mounted once at the App root. Pays the
 * WASM compile + animation parse cost once at boot so every `LottieLoader`
 * overlay paints instantly thereafter.
 */
export function LottiePreloader() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        contain: 'strict',
      }}
    >
      <DotLottieReact src={LOTTIE.common} autoplay={false} loop={false} style={{ width: 1, height: 1 }} />
      <DotLottieReact src={LOTTIE.email} autoplay={false} loop={false} style={{ width: 1, height: 1 }} />
    </div>
  );
}

interface Props {
  open: boolean;
  variant?: 'common' | 'email';
  /** Pixel size of the Lottie animation itself. */
  size?: number;
}

/**
 * Fullscreen blurred overlay with a Lottie animation centred on screen.
 *
 * Performance notes:
 * - Both Lottie players (common + email) are mounted permanently and toggled
 *   via `display`, so reopening the loader never re-creates a player.
 * - Backdrop uses `opacity` + `visibility` transitions only — no `display:none`
 *   toggling that would force the player to re-init.
 * - `will-change` + `contain` hints keep the overlay on its own compositor
 *   layer so opening/closing never repaints the page underneath.
 */
export default function LottieLoader({
  open,
  variant = 'common',
  size = 320,
}: Props) {
  // Mount lazily on first open, then keep mounted forever — flipping
  // visibility is orders of magnitude cheaper than re-mounting the player.
  const [hasOpened, setHasOpened] = useState(false);
  if (open && !hasOpened) setHasOpened(true);

  // Lock body scroll while open so the backdrop never repaints due to scroll.
  const prevOverflow = useRef<string>('');
  useEffect(() => {
    if (!open) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [open]);

  return (
    <div
      role={open ? 'status' : undefined}
      aria-live={open ? 'polite' : undefined}
      aria-hidden={!open}
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
        opacity: open ? 1 : 0,
        visibility: open ? 'visible' : 'hidden',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 120ms linear, visibility 0s linear ' + (open ? '0s' : '120ms'),
        willChange: 'opacity',
        contain: 'strict',
      }}
    >
      {hasOpened && (
        <div
          style={{
            width: size,
            height: size,
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          {/* Keep BOTH players mounted; flip display so switching variants is
              also instant. Each player is already pre-warmed by LottiePreloader. */}
          <div style={{ display: variant === 'common' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <DotLottieReact
              src={LOTTIE.common}
              autoplay
              loop
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div style={{ display: variant === 'email' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <DotLottieReact
              src={LOTTIE.email}
              autoplay
              loop
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
