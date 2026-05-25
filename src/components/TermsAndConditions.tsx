import { useNavigate } from 'react-router-dom';

export default function TermsAndConditions() {
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
          <h1 className="text-lg font-semibold text-slate-800">Terms &amp; Conditions</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-8 md:p-12 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Terms &amp; Conditions</h2>
            <p className="mt-2 text-sm text-slate-500">Last updated: May 2025</p>
          </div>

          <p className="text-slate-600 leading-relaxed">
            By using Invoice Builder ("the app", "the service"), you agree to the following terms. Please read them
            carefully before using the application.
          </p>

          <Section title="1. Service Description">
            <p>
              Invoice Builder is an invoice generation platform that allows you to create, manage, and send invoices
              via email. The service includes PDF export, XLSX reporting, file attachments, and Gmail-based email
              delivery.
            </p>
          </Section>

          <Section title="2. User Responsibilities">
            <p>You are solely responsible for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>The accuracy and completeness of all data you enter into invoices.</li>
              <li>Ensuring that the invoice amounts, GST calculations, and recipient details are correct before sending.</li>
              <li>Complying with applicable tax laws and invoicing regulations in your jurisdiction.</li>
              <li>Maintaining the confidentiality of your Google account credentials.</li>
              <li>Any consequences arising from invoices you generate and send through the app.</li>
            </ul>
          </Section>

          <Section title="3. Accuracy of Invoice Information">
            <p>
              The app provides tools to help you generate invoices, but it does not verify, audit, or validate the
              accuracy of the information you enter. The app owner and developers are not responsible for any errors,
              omissions, or incorrect information in invoices generated using this service.
            </p>
            <p className="mt-2">
              You agree that any financial, legal, or tax consequences resulting from incorrect invoice data are your
              sole responsibility.
            </p>
          </Section>

          <Section title="4. No Warranty">
            <p>
              The service is provided <strong>"as-is"</strong> and <strong>"as available"</strong> without warranties
              of any kind, either express or implied. We do not warrant that:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>The service will be uninterrupted, error-free, or available at all times.</li>
              <li>PDF or XLSX exports will meet every formatting requirement for every jurisdiction.</li>
              <li>Emails will be delivered successfully (subject to Gmail's own policies and limits).</li>
            </ul>
          </Section>

          <Section title="5. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, the app owner shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the service, including but not
              limited to loss of income, loss of business, or disputes with clients arising from invoice errors.
            </p>
          </Section>

          <Section title="6. Service Changes">
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the service at any time without
              prior notice. We are not liable to you or any third party for any such modification, suspension, or
              discontinuation.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>
              The app uses the Gmail API to send emails. Your use of Gmail is governed by{' '}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google's Terms of Service
              </a>
              . We are not responsible for any limitations, suspensions, or actions taken by Google on your account.
            </p>
          </Section>

          <Section title="8. Data and Privacy">
            <p>
              Your use of the app is also governed by our{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
              , which is incorporated into these terms by reference.
            </p>
          </Section>

          <Section title="9. Changes to These Terms">
            <p>
              We may update these Terms &amp; Conditions from time to time. Changes will be reflected by updating the
              "Last updated" date at the top of this page. Continued use of the app after any changes constitutes your
              acceptance of the new terms.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              If you have questions about these Terms &amp; Conditions, contact us at{' '}
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
