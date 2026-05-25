import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import InvoiceBuilder from './components/InvoiceBuilder';
import MailPreview from './components/MailPreview';
import SplashScreen from './components/SplashScreen';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsAndConditions from './components/TermsAndConditions';
import { captureOAuthRedirect } from './utils/gmailClient';
import { migrateLegacyAttachments } from './db/migrateAttachments';
import { autoSeed } from './db/autoSeed';
import { dedupeInvoiceNumbers } from './db/invoiceDB';
import { LottiePreloader } from './components/LottieLoader';
import { preloadLottieAssets } from './components/lottieAssets';

// OnboardingTour pulls in react-joyride (~150 KB). It only runs on first visit
// and renders on the list route only, so defer the chunk until idle.
const OnboardingTour = lazy(() => import('./components/OnboardingTour'));

export default function App() {
  // Splash shows once per tab session so SPA route changes don't replay it.
  const [showSplash, setShowSplash] = useState(
    () => typeof window !== 'undefined' && !sessionStorage.getItem('splashShown'),
  );
  // After Google OAuth redirects back, capture refresh_token + email from URL hash
  useEffect(() => {
    captureOAuthRedirect();
    // Move any legacy inline-base64 attachments into IndexedDB. One-shot,
    // guarded by a localStorage flag — safe to call on every mount.
    void migrateLegacyAttachments();
    void autoSeed();
    // Heal any pre-existing duplicate invoice numbers (e.g. from earlier
    // versions where the generator only counted 'saved' invoices and could
    // collide with 'modified' / 'mail-sent' ones).
    const fixed = dedupeInvoiceNumbers();
    if (fixed > 0) console.warn(`[invoiceDB] renumbered ${fixed} duplicate invoice number(s)`);
    preloadLottieAssets();
  }, []);

  return (
    <>
      {showSplash && (
        <SplashScreen
          duration={2000}
          onDone={() => {
            sessionStorage.setItem('splashShown', '1');
            setShowSplash(false);
          }}
        />
      )}

      {/* Single global Toaster — white-card default. Per-toast color comes
          from the icon, not the background. Mount it ONCE here so every
          page shares the same look (no per-page Toaster instances). */}
      <Toaster
        position="top-right"
        containerStyle={{ top: 72 }}
        toastOptions={{
          duration: 2800,
          style: {
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '13px',
            fontWeight: 500,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
          },
        }}
      />

      <Routes>
        <Route path="/invoice/:id/mail" element={<MailPreview />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/*" element={<InvoiceBuilder />} />
      </Routes>

      {/* First-login product tour. Self-gates on localStorage; only renders on
          the list route. Waits for the splash to finish to avoid overlap.
          Suspense fallback is null — the tour is non-blocking UX. */}
      {!showSplash && (
        <Suspense fallback={null}>
          <OnboardingTour />
        </Suspense>
      )}

      {/* Off-screen Lottie warm-up. Pays the WASM compile + animation parse
          cost once at boot so every LottieLoader overlay opens instantly. */}
      <LottiePreloader />
    </>
  );
}
