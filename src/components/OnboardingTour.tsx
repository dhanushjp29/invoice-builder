import { useEffect, useRef, useState } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS, type EventData, type Step, type TooltipRenderProps } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'invoiceBuilder.tour.v4';

// Which route each step should be on. The tour pauses if the user isn't there,
// and auto-resumes the moment they land on the right route.
// Strict route patterns. Editor steps match ONLY the bare editor route — not
// the /preview or /mail sub-routes. Otherwise a Back from step 12 (preview)
// to step 11 (editor's Preview button) would think it's already on the right
// route and skip the navigation, leaving the spotlight on the Edit button.
const STEP_ROUTES: Record<number, RegExp> = {
  0: /^\/$/, 1: /^\/$/, 2: /^\/$/, 3: /^\/$/, 4: /^\/$/, 5: /^\/$/,
  6: /^\/invoice\/[^/]+$/, 7: /^\/invoice\/[^/]+$/, 8: /^\/invoice\/[^/]+$/,
  9: /^\/invoice\/[^/]+$/, 10: /^\/invoice\/[^/]+$/, 11: /^\/invoice\/[^/]+$/,
  12: /^\/invoice\/[^/]+\/preview$/, 13: /^\/invoice\/[^/]+\/preview$/,
  14: /^\/invoice\/[^/]+\/mail$/,
};

// CTA-only steps where we pause and wait for the user to navigate themselves
// (no Next button — they advance by clicking the highlighted target).
const CTA_STEPS = new Set([5, 11, 13]);

interface StepMeta {
  emoji: string;
  accent: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
  cta?: string;     // text shown instead of Next, e.g. "Click the row to continue"
}

const STEP_META: StepMeta[] = [
  { emoji: '👋', accent: 'blue' },
  { emoji: '🏠', accent: 'blue' },
  { emoji: '📂', accent: 'violet' },
  { emoji: '🔍', accent: 'cyan' },
  { emoji: '📊', accent: 'emerald' },
  { emoji: '👆', accent: 'amber', cta: 'Click INV2026-0001 to continue' },
  { emoji: '📑', accent: 'violet' },
  { emoji: '🏢', accent: 'blue' },
  { emoji: '👤', accent: 'cyan' },
  { emoji: '📦', accent: 'emerald' },
  { emoji: '💰', accent: 'amber' },
  { emoji: '👀', accent: 'rose', cta: 'Click the green "Preview" button' },
  { emoji: '🖨️', accent: 'violet' },
  { emoji: '✉️', accent: 'rose', cta: 'Click the "Mail" button' },
  { emoji: '🎉', accent: 'emerald' },
];

export default function OnboardingTour({ force = false }: { force?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const activeStep = useRef(0);
  const tourActive = useRef(false);

  // Defer the kickoff by one render cycle. This is what survives React's
  // StrictMode double-mount in dev: the FIRST mount + immediate unmount can't
  // schedule a setTimeout because `mounted` hasn't flipped yet, and by the
  // time the SECOND mount runs `setMounted(true)`, the cleanup is already in
  // the past. Without this two-phase guard, StrictMode's cleanup fires before
  // the 500ms timer ever resolves and the tour silently never starts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    console.log('[Tour]', { mounted, path: location.pathname, done: localStorage.getItem(STORAGE_KEY), force });
    if (!mounted) return;
    const done = localStorage.getItem(STORAGE_KEY) === '1';
    if (!force && done) return;
    if (location.pathname === '/') {
      console.log('[Tour] scheduling start in 500ms');
      const t = setTimeout(() => { console.log('[Tour] tour started!'); setStepIndex(0); setRun(true); tourActive.current = true; }, 500);
      return () => { console.log('[Tour] cleanup fired'); clearTimeout(t); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, force]);

  // Pause/resume + auto-advance on route change.
  //
  // Flow for CTA steps (5/11/13): the user navigates by clicking the highlighted
  // element. Joyride emits no event for that click — so the route change is the
  // ONLY signal we get that the user has acted. When we arrive at the next
  // route, we both advance the step AND resume the tour.
  useEffect(() => {
    if (!tourActive.current) return;

    // Step 5 (list) → arrived at /invoice/... → advance to step 6 (editor)
    if (activeStep.current === 5 && /^\/invoice\//.test(location.pathname)) {
      activeStep.current = 6;
      setStepIndex(6);
      const t = setTimeout(() => setRun(true), 450);
      return () => clearTimeout(t);
    }
    // Step 11 (editor) → arrived at /preview → advance to step 12
    if (activeStep.current === 11 && /^\/invoice\/.*\/preview$/.test(location.pathname)) {
      activeStep.current = 12;
      setStepIndex(12);
      const t = setTimeout(() => setRun(true), 450);
      return () => clearTimeout(t);
    }
    // Step 13 (preview) → arrived at /mail → advance to step 14
    if (activeStep.current === 13 && /^\/invoice\/.*\/mail$/.test(location.pathname)) {
      activeStep.current = 14;
      setStepIndex(14);
      const t = setTimeout(() => setRun(true), 450);
      return () => clearTimeout(t);
    }

    // Default: resume if we're on the expected route, pause otherwise.
    const expected = STEP_ROUTES[activeStep.current];
    if (expected && expected.test(location.pathname)) {
      // Pause first so joyride drops any stale spotlight, then re-show with a
      // delay long enough for the destination route's targets to mount. Use
      // requestAnimationFrame + a short timeout so we re-show on the next
      // paint cycle (faster + more reliable than a fixed 500ms wait).
      setRun(false);
      let raf = 0;
      const t = setTimeout(() => {
        raf = requestAnimationFrame(() => setRun(true));
      }, 250);
      return () => { clearTimeout(t); if (raf) cancelAnimationFrame(raf); };
    } else {
      setRun(false);
    }
  }, [location.pathname]);

  // Drive a body data-attribute reflecting the current tour step so CSS can
  // restrict interaction (e.g. on step 5, only INV2026-0001 is clickable).
  useEffect(() => {
    if (!tourActive.current || !run) {
      document.body.removeAttribute('data-tour-step');
      return;
    }
    document.body.setAttribute('data-tour-step', String(stepIndex));
    return () => { document.body.removeAttribute('data-tour-step'); };
  }, [stepIndex, run]);

  const steps: Step[] = [
    { target: 'body', placement: 'center',
      title: 'Welcome to Invoice Builder',
      content: "Let's take a 2-minute tour — from your invoice list all the way to sending an email. You'll click along, not just watch." },
    { target: '[data-tour="brand"]', placement: 'bottom-start',
      title: 'Your Home Base',
      content: 'Everything starts here. All your invoices are saved privately in your browser — no account, no cloud.' },
    { target: '[data-tour="views-nav"]', placement: 'right',
      title: 'Two Views',
      content: '"All Invoices" is the quick summary. "Detailed Invoice" gives you a full line-item breakdown with advanced export.' },
    { target: '[data-tour="search"]', placement: 'bottom',
      title: 'Instant Search',
      content: 'Type an invoice number, client name, project, or status — the list filters live as you type.' },
    { target: '[data-tour="export-xlsx"]', placement: 'bottom-end',
      title: 'Export to Excel',
      content: 'Download every visible invoice as a polished .xlsx file. Great for accountants and audits.' },
    { target: '[data-tour="invoice-table"]', placement: 'top',
      title: 'Open Your First Invoice',
      content: "We've pre-loaded a few demo invoices. Click the top row — INV2026-0001 — to open the editor." },
    { target: '[data-tour="sidebar-list"]', placement: 'right',
      title: 'Quick Switcher',
      content: 'This left panel shows all your invoices. Jump between them without going back to the list.' },
    { target: '[data-tour="company-info"]', placement: 'left',
      title: 'Your Company',
      content: 'Your business name, address, GST, logo, seal and signature live here. They appear on every printed invoice.' },
    { target: '[data-tour="client-info"]', placement: 'left',
      title: 'Bill To',
      content: "Your client's name, address, GST and email. The email is pre-filled when you send the invoice." },
    { target: '[data-tour="line-items"]', placement: 'top',
      title: 'Line Items',
      content: 'Add what you sold — quantity, rate, HSN code, GST. Totals are recomputed live as you type.' },
    { target: '[data-tour="totals"]', placement: 'top',
      title: 'Totals & Terms',
      content: 'Grand total with GST split, plus notes, payment method, and terms & conditions.' },
    { target: '[data-tour="preview-btn"]', placement: 'bottom-end',
      title: 'Open the Preview',
      content: 'Click the green "Preview" button to see the print-ready view of your invoice.' },
    { target: '[data-tour="preview-bar"]', placement: 'bottom',
      title: 'Print-Ready Preview',
      content: 'This is exactly what your client will see. From here you can export PDF, print, or send it by email.' },
    { target: '[data-tour="mail-btn"]', placement: 'bottom',
      title: 'Send via Gmail',
      content: 'Click the "Mail" button to open the composer. Final step coming up!' },
    { target: '[data-tour="mail-compose"]', placement: 'top',
      title: "You're All Set! 🚀",
      content: 'Connect Gmail once (top-right), tweak the subject or message, and hit "Send Email". The PDF + your message go out instantly.' },
  ];

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    tourActive.current = false;
    setRun(false);
    setStepIndex(0);
  }

  function handleCallback(data: EventData) {
    const { action, index, status, type } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      finish();
      if (location.pathname !== '/') navigate('/');
      return;
    }
    if (type === EVENTS.TARGET_NOT_FOUND) {
      // Target missing — wait for the DOM to settle (route change in progress,
      // animations, etc.) and retry. The route-watcher useEffect handles steady
      // state; this handles the transient gap right after a route change.
      setRun(false);
      setTimeout(() => {
        const expected = STEP_ROUTES[activeStep.current];
        if (expected && expected.test(location.pathname)) setRun(true);
      }, 600);
      return;
    }
    if (type === EVENTS.STEP_AFTER) {
      const dir = action === ACTIONS.PREV ? -1 : 1;
      const next = index + dir;
      // Past the last step → finish the tour and go home.
      if (next >= steps.length) {
        finish();
        if (location.pathname !== '/') navigate('/');
        return;
      }
      // Before the first step → ignore (already at step 0).
      if (next < 0) return;
      activeStep.current = next;
      setStepIndex(next);
      // When going BACK across a route boundary, actively navigate the user to
      // the previous route so the next step's target exists.
      if (action === ACTIONS.PREV) {
        const expected = STEP_ROUTES[next];
        const onCorrectRoute = expected && expected.test(location.pathname);
        if (!onCorrectRoute) {
          // Step 0–5 live on '/', steps 6–11 on /invoice/:id, step 12–13 on /preview, step 14 on /mail.
          // Going back from a deeper route → pop one level.
          if (next <= 5) {
            navigate('/');
          } else if (next <= 11 && /\/preview$/.test(location.pathname)) {
            navigate(location.pathname.replace(/\/preview$/, ''));
          } else if (next === 12 || next === 13) {
            // Back from step 14 (mail) → preview
            navigate(location.pathname.replace(/\/mail$/, '/preview'));
          }
          // After navigation, the route-watcher will flip run back on.
          setRun(false);
          return;
        }
      }
      // Entering a step that lives on a different route → pause until the
      // route-watcher confirms we've arrived.
      const expected = STEP_ROUTES[next];
      if (expected && !expected.test(location.pathname)) {
        setRun(false);
      }
    }
  }

  return (
    <>
      <style>{tourStyles}</style>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        onEvent={handleCallback}
        tooltipComponent={(props) => (
          <TourTooltip
            {...props}
            meta={STEP_META[props.index] ?? STEP_META[0]}
            total={steps.length}
          />
        )}
        options={{
          zIndex: 10000,
          primaryColor: '#2563eb',
          overlayColor: 'rgba(15,23,42,0.55)',
          scrollOffset: 100,
          spotlightPadding: 10,
          overlayClickAction: false,
          // Never show the click-to-expand beacon — the tooltip card must open
          // directly. Beacons are confusing during route transitions because
          // the user has to click a small dot to see the next step.
          skipBeacon: true,
          // Give the DOM up to 2s to mount the target after a route change
          // before declaring TARGET_NOT_FOUND.
          targetWaitTimeout: 2000,
        }}
        styles={{
          spotlight: {
            fill: 'rgba(59,130,246,0.04)',
            stroke: 'rgba(59,130,246,0.65)',
            strokeWidth: 2.5,
          },
        }}
      />
    </>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

const ACCENT_BG: Record<StepMeta['accent'], string> = {
  blue:    'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  violet:  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  emerald: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  amber:   'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  rose:    'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)',
  cyan:    'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
};

interface TourTooltipExtras { meta: StepMeta; total: number; }

function TourTooltip(props: TooltipRenderProps & TourTooltipExtras) {
  const { backProps, primaryProps, skipProps, step, index, isLastStep, meta, total } = props;
  const isCta = CTA_STEPS.has(index);
  const accent = ACCENT_BG[meta.accent];
  const progressPct = Math.round(((index + 1) / total) * 100);

  return (
    <div className="tour-card">
      {/* Accent strip + step number badge */}
      <div className="tour-card__top">
        <div className="tour-card__strip" style={{ background: accent }} />
        <div className="tour-card__badge" style={{ background: accent }}>
          <span>{index + 1}</span>
          <span className="tour-card__badge-sep">/</span>
          <span className="tour-card__badge-total">{total}</span>
        </div>
      </div>

      <div className="tour-card__body">
        <div className="tour-card__emoji" style={{ background: accent }}>
          <span>{meta.emoji}</span>
        </div>
        <h3 className="tour-card__title">{step.title}</h3>
        <p className="tour-card__content">{step.content}</p>

        {isCta && meta.cta && (
          <div className="tour-card__cta">
            <svg className="tour-card__cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            <span>{meta.cta}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="tour-card__progress">
        <div className="tour-card__progress-fill" style={{ width: `${progressPct}%`, background: accent }} />
      </div>

      {/* Footer */}
      <div className="tour-card__footer">
        <button {...skipProps} className="tour-card__skip" title="Skip the tour">
          Skip tour
        </button>
        <div className="tour-card__actions">
          {index > 0 && (
            <button {...backProps} className="tour-card__back">
              ← Back
            </button>
          )}
          {!isCta && (
            <button {...primaryProps} className="tour-card__next" style={{ background: accent }}>
              {isLastStep ? "Let's go" : 'Next'}
              {!isLastStep && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const tourStyles = `
  .tour-card {
    width: 360px;
    max-width: calc(100vw - 32px);
    background: linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.7);
    border-radius: 22px;
    box-shadow:
      0 30px 80px -20px rgba(15,23,42,0.45),
      0 12px 30px -8px rgba(59,130,246,0.18),
      0 0 0 1px rgba(255,255,255,0.6) inset;
    overflow: hidden;
    position: relative;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    color: #0f172a;
    animation: tourCardIn 380ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes tourCardIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }

  /* Top: gradient strip + step counter pill */
  .tour-card__top {
    position: relative;
    height: 4px;
  }
  .tour-card__strip {
    position: absolute;
    inset: 0 0 auto 0;
    height: 4px;
  }
  .tour-card__badge {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: baseline;
    gap: 2px;
    padding: 5px 11px;
    border-radius: 9999px;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    box-shadow: 0 6px 16px rgba(15,23,42,0.18);
    line-height: 1;
  }
  .tour-card__badge-sep   { opacity: 0.65; margin: 0 1px; }
  .tour-card__badge-total { opacity: 0.85; font-size: 10px; }

  /* Body */
  .tour-card__body {
    padding: 24px 24px 18px;
  }
  .tour-card__emoji {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    box-shadow: 0 10px 24px -6px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.4) inset;
    transform: rotate(-3deg);
    transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .tour-card__emoji:hover { transform: rotate(0deg) scale(1.05); }
  .tour-card__emoji span {
    font-size: 28px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
    line-height: 1;
  }

  .tour-card__title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    line-height: 1.25;
  }
  .tour-card__content {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: #475569;
    font-weight: 450;
  }

  .tour-card__cta {
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%);
    border: 1px dashed rgba(245, 158, 11, 0.55);
    border-radius: 10px;
    color: #b45309;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.005em;
  }
  .tour-card__cta-icon { width: 16px; height: 16px; flex-shrink: 0; color: #d97706; }

  /* Progress bar */
  .tour-card__progress {
    height: 3px;
    background: rgba(148,163,184,0.18);
    margin: 0 24px 4px;
    border-radius: 9999px;
    overflow: hidden;
  }
  .tour-card__progress-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 0 8px rgba(59,130,246,0.5);
  }

  /* Footer */
  .tour-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 20px 18px;
  }
  .tour-card__actions { display: flex; align-items: center; gap: 8px; }

  .tour-card__skip {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 4px;
    transition: color 140ms ease;
  }
  .tour-card__skip:hover { color: #475569; text-decoration: underline; }

  .tour-card__back {
    background: rgba(148,163,184,0.1);
    border: none;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 9px;
    transition: all 140ms cubic-bezier(0.4,0,0.2,1);
  }
  .tour-card__back:hover {
    background: rgba(148,163,184,0.18);
    color: #1e293b;
    transform: translateX(-2px);
  }

  .tour-card__next {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    color: #fff;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.005em;
    cursor: pointer;
    padding: 10px 16px 10px 18px;
    border-radius: 10px;
    box-shadow: 0 6px 18px -2px rgba(37,99,235,0.45), 0 0 0 1px rgba(255,255,255,0.12) inset;
    transition: all 180ms cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
  }
  .tour-card__next svg { width: 14px; height: 14px; }
  .tour-card__next::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%);
    transform: translateX(-100%);
    transition: transform 600ms ease;
  }
  .tour-card__next:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px -4px rgba(37,99,235,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset;
  }
  .tour-card__next:hover::before { transform: translateX(100%); }
  .tour-card__next:active { transform: translateY(0); }

  /* Static spotlight ring — no pulse */
  .react-joyride__spotlight {
    filter: drop-shadow(0 0 8px rgba(59,130,246,0.35));
  }

  /* Step 5: only INV2026-0001 should be clickable. Dim & block every other row. */
  body[data-tour-step="5"] [data-tour-row]:not([data-tour-row="INV2026-0001"]) {
    pointer-events: none;
    opacity: 0.35;
    filter: grayscale(0.6);
    transition: opacity 200ms ease, filter 200ms ease;
  }
  body[data-tour-step="5"] [data-tour-row="INV2026-0001"] {
    position: relative;
    z-index: 1;
  }
`;
