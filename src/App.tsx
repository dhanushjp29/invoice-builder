import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import InvoiceBuilder from './components/InvoiceBuilder';
import MailPreview from './components/MailPreview';
import SplashScreen from './components/SplashScreen';
import { captureOAuthRedirect } from './utils/gmailClient';
import { migrateLegacyAttachments } from './db/migrateAttachments';
import { LottiePreloader } from './components/LottieLoader';
import { preloadLottieAssets } from './components/lottieAssets';

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
    // Warm the HTTP cache for every Lottie file so the loader overlay paints
    // instantly the first time the user triggers a long operation.
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
        <Route path="/*" element={<InvoiceBuilder />} />
      </Routes>

      {/* Off-screen Lottie warm-up. Pays the WASM compile + animation parse
          cost once at boot so every LottieLoader overlay opens instantly. */}
      <LottiePreloader />
    </>
  );
}
