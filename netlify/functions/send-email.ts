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

  let payload: {
    refreshToken?: string;
    fromEmail?: string;
    to?: string;
    subject?: string;
    html?: string;
    pdfBase64?: string;
    pdfFilename?: string;
  };

  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON.' };
  }

  const { refreshToken, fromEmail, to, subject, html, pdfBase64, pdfFilename } = payload;

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

    const raw = buildRawMessage({
      from: fromEmail,
      to,
      subject,
      html,
      pdfBase64,
      pdfFilename: pdfFilename || 'invoice.pdf',
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
  pdfBase64?: string;
  pdfFilename: string;
}): string {
  const { from, to, subject, html, pdfBase64, pdfFilename } = args;
  // RFC 2047 encoded-word for non-ASCII subjects
  const encodedSubject = `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  let mime: string;
  if (pdfBase64) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      '',
      pdfBase64.replace(/(.{76})/g, '$1\n'),
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
  } else {
    mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      '',
    ].join('\r\n');
  }

  // Gmail API expects URL-safe base64 (no padding) of the full RFC 2822 message
  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
