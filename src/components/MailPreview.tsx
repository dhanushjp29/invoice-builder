import { useEffect, useState } from 'react';
import { notify } from '../utils/notify';
import { useNavigate, useParams } from 'react-router-dom';
import { getAttachmentBlob } from '../db/attachmentStore';
import { findOne, updateOne } from '../db/invoiceDB';
import type { InvoiceDocument } from '../types/invoice';
import { CURRENCY_OPTIONS } from '../types/invoice';
import { openAttachmentInNewTab } from '../utils/attachmentView';
import { disconnect, getConnection, sendInvoiceEmail, startGmailConnect, type MailAttachment } from '../utils/gmailClient';
import { blobToBase64 } from '../utils/pdfBase64';
import { generatePdfBlob } from '../utils/pdfExport';
import { recalculate } from '../utils/recalculate';
import InvoicePrintView from './InvoicePrintView';
import LottieLoader from './LottieLoader';

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
    if (!conn) { notify.error('Connect Gmail first.'); return; }
    if (!to.trim()) { notify.error('Recipient email is required.'); return; }

    console.log('[Mail] Send started', { from: conn.email, to: to.trim(), subject });
    setSending(true);

    const sendOp = (async () => {
      const html = buildHtmlBody();
      const pdfBlob = await generatePdfBlob(`${invoice!.invoiceNumber || 'invoice'}.pdf`);
      const pdfBase64 = await blobToBase64(pdfBlob);
      const mailAttachments = await collectMailAttachments(invoice!);
      console.log('[Mail] extra attachments:', mailAttachments.map((a) => a.filename));
      await sendInvoiceEmail({
        to: to.trim(),
        subject: subject.trim(),
        html,
        pdfBase64,
        pdfFilename: `${invoice!.invoiceNumber || 'invoice'}.pdf`,
        attachments: mailAttachments,
      });
    })();

    try {
      await notify.promise(sendOp, {
        loading: 'Sending email…',
        success: `Email sent to ${to.trim()}.`,
        error: 'Send failed.',
      });
      // Mark the invoice as 'mail-sent' and bump the cycle counter. The badge
      // shows "Mail Sent" for cycle 1 and "Mail Sent (N)" for cycle ≥ 2.
      // Read fresh from storage so we don't clobber edits made elsewhere.
      const current = findOne(invoice!._id);
      if (current) {
        const nextCycle = (current.cycleCount ?? 0) + 1;
        updateOne(current._id, { status: 'mail-sent', cycleCount: nextCycle });
      }
      setTimeout(() => navigate(`/invoice/${invoice!._id}/preview`), 800);
    } catch (err) {
      console.error('[Mail] Send failed:', err);
      // notify.promise already showed the error toast.
    } finally {
      setSending(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setConn(null);
    notify.success('Gmail disconnected.');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toaster is mounted globally in App.tsx */}

      {/* Fullscreen Lottie overlay — only shown while the email is being sent.
          PDF generation + Gmail API call usually takes a few seconds, long
          enough that a toast alone feels under-acknowledged. */}
      <LottieLoader open={sending} variant="email" />


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
              onClick={() => navigate(`/invoice/${invoice._id}/preview`)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition border border-slate-200"
            >
              Back
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

          {/* Attachments — the invoice PDF + every file the user ticked
              "Include In Mail" on in the editor. Each chip opens the file
              in a new tab so the user can verify what's being sent. */}
          <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-500 w-16 uppercase tracking-wider mt-1.5">Files</label>
            <div className="flex-1 flex flex-wrap gap-2">
              <AttachmentChip
                name={`${invoice.invoiceNumber || 'invoice'}.pdf`}
                hint="Invoice (auto)"
              />
              {(invoice.attachments ?? [])
                .filter((a) => a.includeInMail)
                .map((a) => (
                  <AttachmentChip
                    key={a._id}
                    name={a.name}
                    hint={formatBytes(a.size)}
                    onView={async () => {
                      const blob = a.blobId
                        ? await getAttachmentBlob(a.blobId)
                        : (a.data ? dataUrlStringToBlob(a.data, a.mimeType) : null);
                      if (blob) openAttachmentInNewTab(blob, a.name);
                    }}
                  />
                ))}
              {(invoice.attachments ?? []).every((a) => !a.includeInMail) && (
                <p className="text-[11px] text-slate-400 self-center">
                  No extra files. Tick "Include In Mail" on any file in the editor to attach it.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Invoice preview (provides #invoice-print-area for both HTML and PDF) */}
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <InvoicePrintView invoice={invoice} currencySymbol={currencyInfo.symbol} />
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({ name, hint, onView }: { name: string; hint: string; onView?: () => void }) {
  const baseClass = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border max-w-full';
  const body = (
    <>
      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="text-xs font-semibold text-slate-700 truncate max-w-[16rem]" title={name}>{name}</span>
      <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{hint}</span>
      {onView && (
        <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      )}
    </>
  );

  if (onView) {
    return (
      <button
        type="button"
        onClick={onView}
        title={`Open ${name} in new tab`}
        className={`${baseClass} border-blue-200 bg-blue-50/60 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={`${baseClass} border-slate-200 bg-slate-50`}>{body}</div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Split a data URL into mime type + raw base64. Returns null for non-data URLs. */
function parseDataUrl(dataUrl: string | null | undefined): { mimeType: string; base64: string } | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

/** Legacy: decode an inline base64 data URL into a Blob for View on
 *  pre-migration attachments. New uploads bypass this and go straight to
 *  IndexedDB. */
function dataUrlStringToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  const m = dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!m) return null;
  const mime = m[1] || fallbackMime;
  const isBase64 = !!m[2];
  const payload = m[3];
  let bytes: Uint8Array;
  if (isBase64) {
    const bin = atob(payload);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const dec = decodeURIComponent(payload);
    bytes = new Uint8Array(dec.length);
    for (let i = 0; i < dec.length; i++) bytes[i] = dec.charCodeAt(i);
  }
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: mime });
}

function blobToBase64NoPrefix(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(',');
      resolve(comma === -1 ? s : s.slice(comma + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Collect the user-checked file attachments for the email.
 *  Branding (logo / seal / signature) is intentionally NOT attached separately —
 *  those images already appear inline inside the invoice preview HTML, so
 *  attaching them again would just show duplicates at the bottom of Gmail.
 *
 *  New attachments live in IndexedDB (read via `blobId`). Legacy attachments
 *  may still carry inline `data:` base64 from before the migration. */
async function collectMailAttachments(invoice: InvoiceDocument): Promise<MailAttachment[]> {
  const out: MailAttachment[] = [];

  for (const att of invoice.attachments ?? []) {
    if (!att.includeInMail) continue;

    if (att.blobId) {
      const blob = await getAttachmentBlob(att.blobId);
      if (!blob) {
        console.warn('[Mail] Skipping attachment — blob missing in IndexedDB:', att.name);
        continue;
      }
      out.push({
        filename: att.name,
        mimeType: att.mimeType || blob.type || 'application/octet-stream',
        base64: await blobToBase64NoPrefix(blob),
      });
      continue;
    }

    // Legacy inline data URL path
    const parsed = parseDataUrl(att.data);
    if (!parsed) {
      console.warn('[Mail] Skipping attachment with no blob and no data URL:', att.name);
      continue;
    }
    out.push({
      filename: att.name,
      mimeType: att.mimeType || parsed.mimeType,
      base64: parsed.base64,
    });
  }

  return out;
}
