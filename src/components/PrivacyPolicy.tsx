import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-500 hover:text-slate-800 transition-colors text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-semibold text-slate-800">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-8 md:p-12 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Privacy Policy</h2>
            <p className="mt-2 text-sm text-slate-500">Last updated: May 2025</p>
          </div>

          <p className="text-slate-600 leading-relaxed">
            This Privacy Policy describes how Invoice Builder ("we", "our", or "the app") collects, uses, and protects
            your information when you use our invoice generation and email delivery service.
          </p>

          <Section title="1. Information We Collect">
            <p>
              We collect only the information necessary to provide our services:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Google account information</strong> — your email address and OAuth refresh token, obtained when
                you connect your Gmail account to send invoices.
              </li>
              <li>
                <strong>Invoice data</strong> — business details, client information, line items, and amounts that you
                enter manually to generate invoices.
              </li>
              <li>
                <strong>Uploaded files</strong> — attachments you add to invoices, used solely to include them in the
                invoice email you send.
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-6 space-y-1">
              <li>To generate PDF invoices based on the data you provide.</li>
              <li>To send invoice emails on your behalf via your connected Gmail account.</li>
              <li>To attach uploaded files to outgoing invoice emails.</li>
              <li>
                Invoice data and uploaded files are stored locally on your device (browser localStorage and
                IndexedDB). We do not upload your invoice data to any server.
              </li>
            </ul>
          </Section>

          <Section title="3. Data Storage">
            <p>
              All invoice data, including uploaded file attachments, is stored locally in your browser using
              localStorage and IndexedDB. Your data stays on your device and is not transmitted to or stored on our
              servers, except when you explicitly send an email (in which case the content is sent through the Gmail
              API on your behalf).
            </p>
            <p className="mt-2">
              Your Gmail OAuth refresh token is stored in your browser's localStorage. We do not store it on any
              server.
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>
              We use the following third-party service to enable email functionality:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Google Gmail API</strong> — used to send invoice emails from your Gmail account. Your use of
                Gmail is subject to{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google's Privacy Policy
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="5. Data Sharing">
            <p>
              We do not sell, rent, or share your personal information or invoice data with any third party for
              marketing or commercial purposes. Data is only shared with Google when you explicitly send an email
              through the Gmail API.
            </p>
          </Section>

          <Section title="6. Data Security">
            <p>
              We implement reasonable technical measures to protect the information you provide. However, since
              invoice data is stored locally on your device, you are responsible for the security of your browser
              environment and device.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You can, at any time:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Clear your invoice data by clearing your browser's localStorage and IndexedDB.</li>
              <li>
                Disconnect your Gmail account by revoking access in your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Account settings
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last
              updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of
              the updated policy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              If you have any questions about this Privacy Policy, you can reach us at{' '}
              <a href="mailto:dhanushwar771@gmail.com" className="text-blue-600 hover:underline">
                dhanushwar771@gmail.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Invoice Builder. All rights reserved.
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <div className="text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}
