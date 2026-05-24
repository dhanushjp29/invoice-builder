import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import InvoiceBuilder from './components/InvoiceBuilder';
import MailPreview from './components/MailPreview';
import { captureOAuthRedirect } from './utils/gmailClient';
import { migrateLegacyAttachments } from './db/migrateAttachments';

export default function App() {
  // After Google OAuth redirects back, capture refresh_token + email from URL hash
  useEffect(() => {
    captureOAuthRedirect();
    // Move any legacy inline-base64 attachments into IndexedDB. One-shot,
    // guarded by a localStorage flag — safe to call on every mount.
    void migrateLegacyAttachments();
  }, []);

  return (
    <Routes>
      <Route path="/invoice/:id/mail" element={<MailPreview />} />
      <Route path="/*" element={<InvoiceBuilder />} />
    </Routes>
  );
}
