import { useEffect, useState } from 'react';

interface Props {
  /** Total time the splash stays fully visible before starting fade-out, in ms. */
  duration?: number;
  onDone?: () => void;
}

/**
 * Boot splash — brand-themed, paints instantly (pure CSS + inline SVG, no
 * network). Total visible time ≈ duration + 600ms exit fade. Matches the app's
 * blue-600 / slate-900 palette.
 */
export default function SplashScreen({ duration = 2000, onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  useEffect(() => {
    const fadeT = setTimeout(() => setPhase('out'), duration);
    const goneT = setTimeout(() => {
      setPhase('gone');
      onDone?.();
    }, duration + 600);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(goneT);
    };
  }, [duration, onDone]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden={phase !== 'in'}
      className="splash-root"
      data-phase={phase}
    >
      <style>{splashKeyframes}</style>

      {/* Soft ambient glow blobs */}
      <div className="splash-glow splash-glow--a" />
      <div className="splash-glow splash-glow--b" />
      <div className="splash-glow splash-glow--c" />

      {/* Brand mark */}
      <div className="splash-mark">
        <div className="splash-mark__ring" />
        <div className="splash-mark__ring splash-mark__ring--2" />
        <div className="splash-mark__halo" />
        <div className="splash-mark__icon">
          <InvoiceIcon />
        </div>
      </div>

      {/* Wordmark */}
      <h1 className="splash-title">
        {'Invoice Builder'.split('').map((ch, i) => (
          <span
            key={i}
            className="splash-title__ch"
            style={{ animationDelay: `${260 + i * 45}ms` }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </h1>

      <p className="splash-tag">Create. Send. Get paid.</p>

      {/* Underline shimmer */}
      <div className="splash-bar">
        <div className="splash-bar__fill" />
      </div>
    </div>
  );
}

function InvoiceIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="44"
      height="44"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M14 6h28l8 8v44H14z"
        className="splash-svg__path splash-svg__path--1"
      />
      <path d="M42 6v8h8" className="splash-svg__path splash-svg__path--2" />
      <path
        d="M22 28h20M22 36h20M22 44h12"
        className="splash-svg__path splash-svg__path--3"
      />
      <circle cx="46" cy="46" r="7" fill="#3b82f6" stroke="none" className="splash-svg__dot" />
      <path d="M43 46l2.5 2.5L49 44" stroke="#fff" strokeWidth="2.4" className="splash-svg__check" />
    </svg>
  );
}

const splashKeyframes = `
  /* ---------- root + exit ---------- */
  .splash-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: radial-gradient(ellipse at 30% 20%, #1e3a8a 0%, #0f172a 55%, #020617 100%);
    transition:
      opacity 600ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 600ms cubic-bezier(0.4, 0, 0.2, 1),
      filter 600ms cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 1;
    transform: scale(1);
    will-change: opacity, transform, filter;
  }
  .splash-root[data-phase="out"] {
    opacity: 0;
    transform: scale(1.04);
    filter: blur(6px);
    pointer-events: none;
  }

  /* ---------- keyframes ---------- */
  @keyframes splashGlowDrift {
    0%   { transform: translate3d(0, 0, 0)       scale(1);    opacity: 0.5; }
    50%  { transform: translate3d(20px, -10px, 0) scale(1.15); opacity: 0.85; }
    100% { transform: translate3d(0, 0, 0)       scale(1);    opacity: 0.5; }
  }
  @keyframes splashRing {
    0%   { transform: scale(0.55); opacity: 0; }
    25%  { opacity: 0.85; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes splashHalo {
    0%   { transform: scale(0.6); opacity: 0; }
    60%  { opacity: 0.55; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  @keyframes splashMarkIn {
    0%   { transform: scale(0.3)  rotate(-12deg); opacity: 0; }
    55%  { transform: scale(1.06) rotate(3deg);   opacity: 1; }
    78%  { transform: scale(0.98) rotate(-1deg);  opacity: 1; }
    100% { transform: scale(1)    rotate(0deg);   opacity: 1; }
  }
  @keyframes splashCharIn {
    0%   { transform: translate3d(0, 18px, 0) scale(0.92); opacity: 0; filter: blur(6px); }
    60%  { filter: blur(0); }
    100% { transform: translate3d(0, 0, 0) scale(1);     opacity: 1; filter: blur(0); }
  }
  @keyframes splashTagIn {
    0%   { opacity: 0; transform: translate3d(0, 10px, 0); letter-spacing: 0.08em; }
    100% { opacity: 1; transform: translate3d(0, 0, 0);   letter-spacing: 0.22em; }
  }
  @keyframes splashDraw {
    to { stroke-dashoffset: 0; }
  }
  @keyframes splashDotPop {
    0%   { transform: scale(0);    opacity: 0; }
    65%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes splashBarFill {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* ---------- glow blobs ---------- */
  .splash-glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(90px);
    pointer-events: none;
    animation: splashGlowDrift 4.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
    will-change: transform, opacity;
  }
  .splash-glow--a {
    width: 420px; height: 420px;
    background: #3b82f6;
    top: -100px; left: -80px;
  }
  .splash-glow--b {
    width: 360px; height: 360px;
    background: #6366f1;
    bottom: -80px; right: -60px;
    animation-delay: 1s;
  }
  .splash-glow--c {
    width: 260px; height: 260px;
    background: #38bdf8;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.18;
    animation-duration: 6s;
    animation-delay: 0.5s;
  }

  /* ---------- brand mark ---------- */
  .splash-mark {
    position: relative;
    width: 96px; height: 96px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 32px;
  }
  .splash-mark__ring {
    position: absolute; inset: 0;
    border-radius: 9999px;
    border: 2px solid rgba(96, 165, 250, 0.5);
    animation: splashRing 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
    will-change: transform, opacity;
  }
  .splash-mark__ring--2 { animation-delay: 0.7s; }
  .splash-mark__halo {
    position: absolute; inset: -8px;
    border-radius: 9999px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, transparent 70%);
    animation: splashHalo 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    animation-delay: 0.3s;
    will-change: transform, opacity;
  }
  .splash-mark__icon {
    position: relative;
    width: 72px; height: 72px;
    border-radius: 18px;
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 45%, #2563eb 75%, #1d4ed8 100%);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow:
      0 14px 40px rgba(59, 130, 246, 0.5),
      0 4px 12px rgba(29, 78, 216, 0.4),
      0 0 0 1px rgba(255,255,255,0.14) inset,
      0 -10px 28px rgba(255,255,255,0.1) inset;
    animation: splashMarkIn 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    will-change: transform, opacity;
  }

  /* ---------- svg ---------- */
  .splash-svg__path {
    stroke-dasharray: 220;
    stroke-dashoffset: 220;
    animation: splashDraw 1.1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
  .splash-svg__path--1 { animation-delay: 0.4s; }
  .splash-svg__path--2 { animation-delay: 0.7s; stroke-dasharray: 30; stroke-dashoffset: 30; animation-duration: 0.6s; }
  .splash-svg__path--3 { animation-delay: 0.9s; animation-duration: 0.9s; }
  .splash-svg__dot {
    transform-origin: 46px 46px;
    transform: scale(0);
    animation: splashDotPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 1.35s both;
  }
  .splash-svg__check {
    stroke-dasharray: 14;
    stroke-dashoffset: 14;
    animation: splashDraw 0.45s cubic-bezier(0.65, 0, 0.35, 1) 1.6s forwards;
  }

  /* ---------- wordmark ---------- */
  .splash-title {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #f8fafc;
    display: flex;
    margin: 0;
    text-shadow: 0 4px 24px rgba(59, 130, 246, 0.4);
  }
  .splash-title__ch {
    display: inline-block;
    opacity: 0;
    transform: translate3d(0, 18px, 0);
    animation: splashCharIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    will-change: transform, opacity, filter;
  }

  /* ---------- tag ---------- */
  .splash-tag {
    margin-top: 14px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #93c5fd;
    opacity: 0;
    animation: splashTagIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1.15s forwards;
    will-change: transform, opacity, letter-spacing;
  }

  /* ---------- progress bar ---------- */
  .splash-bar {
    margin-top: 32px;
    width: 200px;
    height: 2px;
    border-radius: 9999px;
    background: rgba(148, 163, 184, 0.15);
    overflow: hidden;
    position: relative;
  }
  .splash-bar__fill {
    position: absolute;
    inset: 0;
    width: 50%;
    background: linear-gradient(90deg, transparent 0%, #60a5fa 40%, #a5b4fc 70%, transparent 100%);
    transform: translateX(-100%);
    animation: splashBarFill 1.6s cubic-bezier(0.65, 0, 0.35, 1) 0.3s infinite;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .splash-glow,
    .splash-mark__ring,
    .splash-mark__halo,
    .splash-mark__icon,
    .splash-svg__path,
    .splash-svg__dot,
    .splash-svg__check,
    .splash-title__ch,
    .splash-tag,
    .splash-bar__fill {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
      stroke-dashoffset: 0 !important;
      filter: none !important;
    }
    .splash-root { transition: opacity 200ms linear !important; }
  }
`;
