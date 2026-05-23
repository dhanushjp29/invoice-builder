import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import InvoiceBuilder from './components/InvoiceBuilder';
import MailPreview from './components/MailPreview';
import { captureOAuthRedirect } from './utils/gmailClient';

export default function App() {
  // After Google OAuth redirects back, capture refresh_token + email from URL hash
  useEffect(() => {
    captureOAuthRedirect();
  }, []);

  return (
    <Routes>
      <Route path="/invoice/:id/mail" element={<MailPreview />} />
      <Route path="/*" element={<InvoiceBuilder />} />
    </Routes>
  );
}
