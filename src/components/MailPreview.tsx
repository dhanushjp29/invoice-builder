import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { findOne } from '../db/invoiceDB';
import { CURRENCY_OPTIONS } from '../types/invoice';
import { recalculate } from '../utils/recalculate';
import InvoicePrintView from './InvoicePrintView';
import { getConnection, startGmailConnect, disconnect, sendInvoiceEmail } from '../utils/gmailClient';
import { generatePdfBlob } from '../utils/pdfExport';
import { blobToBase64 } from '../utils/pdfBase64';

export default function MailPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const raw = id ? findOne(id) : null;
  const invoice = raw ? recalculate(raw) : null;

  const currencyInfo = invoice
    ? CURRENCY_OPTIONS.find((c) => c.code === invoice.currency) ?? CURRENCY_OPTIONS[0]
    : CURRENCY_OPTIONS[0];

  const defaultBodyText = invoice
    ? `Dear ${invoice.clientName},\n\n` +
      `Please find your invoice ${invoice.invoiceNumber} dated ${invoice.invoiceDate}.\n\n` +
      `Amount Due: ${currencyInfo.symbol}${invoice.grandTotal.toFixed(2)}\n` +
      `Due Date: ${invoice.dueDate}\n\n` +
      `Kindly arrange the payment at the earliest. The full invoice is attached as a PDF.\n\n` +
      `Regards,\n${invoice.companyName}`
    : '';

  // ── All hooks must run before any early return ──
  const [conn, setConn] = useState(getConnection());
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState(invoice?.clientEmail ?? '');
  const [subject, setSubject] = useState(
    invoice ? `Invoice ${invoice.invoiceNumber} from ${invoice.companyName}` : ''
  );
  const [bodyText, setBodyText] = useState(defaultBodyText);

  useEffect(() => {
    const sync = () => setConn(getConnection());
    sync();
    window.addEventListener('gmail-connection-changed', sync);
    return () => window.removeEventListener('gmail-connection-changed', sync);
  }, []);

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Invoice not found.</p>
      </div>
    );
  }

  /** Build the HTML body — the user's message on top, followed by the invoice preview. */
  function buildHtmlBody(): string {
    const previewEl = document.getElementById('invoice-print-area');
    const invoiceHtml = previewEl ? previewEl.outerHTML : '';
    const messageHtml = bodyText
      .split('\n')
      .map((line) => line ? `<p style="margin:0 0 8px 0;">${escapeHtml(line)}</p>` : '<br/>')
      .join('');

    return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:16px;">
  <div style="max-width:780px;margin:0 auto;">
    <div style="background:#fff;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
      ${messageHtml}
    </div>
    <div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
      ${invoiceHtml}
    </div>
  </div>
</body></html>`;
  }

  async function handleSend() {
    if (!conn) { toast.error('Connect Gmail first.'); return; }
    if (!to.trim()) { toast.error('Recipient email is required.'); return; }

    console.log('[Mail] Send started', { from: conn.email, to: to.trim(), subject });
    setSending(true);
    try {
      const html = buildHtmlBody();
      console.log('[Mail] HTML built, length:', html.length);

      const pdfBlob = await generatePdfBlob(`${invoice!.invoiceNumber || 'invoice'}.pdf`);
      console.log('[Mail] PDF generated, size:', pdfBlob.size, 'bytes');

      const pdfBase64 = await blobToBase64(pdfBlob);
      console.log('[Mail] PDF base64 ready, length:', pdfBase64.length);

      await sendInvoiceEmail({
        to: to.trim(),
        subject: subject.trim(),
        html,
        pdfBase64,
        pdfFilename: `${invoice!.invoiceNumber || 'invoice'}.pdf`,
      });

      console.log('[Mail] Sent OK');
      toast.success('Email sent!');
      setTimeout(() => window.close(), 800);
    } catch (err) {
      console.error('[Mail] Send failed:', err);
      toast.error(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setConn(null);
    toast.success('Gmail disconnected.');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Toaster position="top-right" toastOptions={{ duration: 2500 }} />

      {/* Action bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-slate-800">Send Invoice via Gmail</p>
            <p className="text-xs text-slate-500">
              {conn
                ? <>Connected as <span className="font-semibold text-green-700">{conn.email}</span></>
                : <span className="text-amber-700">Gmail not connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {conn ? (
              <>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
                >
                  {sending ? 'Sending…' : 'Send Email'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition border border-slate-200"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={startGmailConnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                Connect Gmail
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition border border-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-4">
        {/* Compose fields */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider">From</label>
            <div className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 flex items-center justify-between">
              <span className={conn ? 'font-semibold text-slate-800' : 'text-amber-700'}>
                {conn ? conn.email : 'Not connected — click Connect Gmail'}
              </span>
              {conn && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-green-500" />
                  Connected
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-start gap-3">
            <label className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider mt-2">Message</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={6}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
          </div>
          <p className="text-[11px] text-slate-400 ml-[76px]">
            The invoice will be embedded as HTML and attached as a PDF.
          </p>
        </div>

        {/* Invoice preview (provides #invoice-print-area for both HTML and PDF) */}
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
