import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';

/**
 * POST /.netlify/functions/send-email
 *
 * Sends via the Gmail API (users.messages.send), not SMTP.
 * The gmail.send OAuth scope authorizes this path directly — no SMTP
 * auth layer to fail with 535-5.7.8.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed.' };
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return { statusCode: 500, body: 'Server is missing Google OAuth env vars.' };
  }

  interface AttachmentPayload {
    filename: string;
    mimeType: string;
    base64: string;
  }

  let payload: {
    refreshToken?: string;
    fromEmail?: string;
    to?: string;
    subject?: string;
    html?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    attachments?: AttachmentPayload[];
  };

  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON.' };
  }

  const { refreshToken, fromEmail, to, subject, html, pdfBase64, pdfFilename, attachments } = payload;

  if (!refreshToken || !fromEmail || !to || !subject || !html) {
    return { statusCode: 400, body: 'Missing required fields.' };
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Merge the invoice PDF into the unified attachments list so the MIME
    // builder only needs one code path.
    const allAttachments: AttachmentPayload[] = [];
    if (pdfBase64) {
      allAttachments.push({
        filename: pdfFilename || 'invoice.pdf',
        mimeType: 'application/pdf',
        base64: pdfBase64,
      });
    }
    if (Array.isArray(attachments)) {
      for (const a of attachments) {
        if (a?.filename && a?.mimeType && a?.base64) allAttachments.push(a);
      }
    }

    const raw = buildRawMessage({
      from: fromEmail,
      to,
      subject,
      html,
      attachments: allAttachments,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: res.data.id }),
    };
  } catch (err) {
    console.error('send-email failed:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: msg }),
    };
  }
};

function buildRawMessage(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; mimeType: string; base64: string }[];
}): string {
  const { from, to, subject, html, attachments } = args;
  // RFC 2047 encoded-word for non-ASCII subjects
  const encodedSubject = `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  const header = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
  ];

  let mime: string;
  if (attachments.length === 0) {
    mime = [
      ...header,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      '',
    ].join('\r\n');
  } else {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const parts: string[] = [
      ...header,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      '',
    ];
    for (const a of attachments) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        a.base64.replace(/(.{76})/g, '$1\n'),
        '',
      );
    }
    parts.push(`--${boundary}--`, '');
    mime = parts.join('\r\n');
  }

  // Gmail API expects URL-safe base64 (no padding) of the full RFC 2822 message
  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
