/**
 * Gmail OAuth client (frontend).
 * Refresh token + connected email are stored in localStorage per browser.
 * The actual access-token exchange happens server-side in /send-email.
 */

const KEY_REFRESH = 'gmail_refresh_token';
const KEY_EMAIL = 'gmail_connected_email';

export interface GmailConnection {
  refreshToken: string;
  email: string;
}

/**
 * Netlify Functions only exist when the app is served by `netlify dev`
 * (port 8888) or in production. Vite's dev server (5173) has no idea about
 * /.netlify/functions/* — those URLs will just serve index.html.
 *
 * Detect that case and warn loudly + redirect to the 8888 origin if available.
 */
function functionsBaseUrl(): string {
  const { protocol, hostname, port } = window.location;
  if (port === '5173') {
    return `${protocol}//${hostname}:8888`;
  }
  return '';
}

function isViteDevServer(): boolean {
  return window.location.port === '5173';
}

export function getConnection(): GmailConnection | null {
  const refreshToken = localStorage.getItem(KEY_REFRESH);
  const email = localStorage.getItem(KEY_EMAIL);
  if (!refreshToken || !email) return null;
  return { refreshToken, email };
}

export function saveConnection(conn: GmailConnection): void {
  localStorage.setItem(KEY_REFRESH, conn.refreshToken);
  localStorage.setItem(KEY_EMAIL, conn.email);
  window.dispatchEvent(new CustomEvent('gmail-connection-changed'));
}

export function disconnect(): void {
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_EMAIL);
  window.dispatchEvent(new CustomEvent('gmail-connection-changed'));
}

/** Kick off OAuth — redirects browser to Google consent screen. */
export function startGmailConnect(): void {
  if (isViteDevServer()) {
    console.warn(
      '[Gmail OAuth] You are on the Vite dev server (port 5173) which does NOT serve Netlify Functions. ' +
      'Stop `npm run dev` and run `netlify dev` instead, then open http://localhost:8888'
    );
    alert(
      'Gmail OAuth requires the Netlify dev server.\n\n' +
      'Stop `npm run dev` and run `netlify dev` instead, then open http://localhost:8888'
    );
    return;
  }
  // Round-trip the current in-app path through OAuth state so the callback
  // can bring the user back to the same page (e.g. the mail page).
  const returnTo = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ returnTo });
  const url = `${functionsBaseUrl()}/.netlify/functions/google-auth?${params.toString()}`;
  console.log('[Gmail OAuth] Redirecting to:', url);
  window.location.href = url;
}

/**
 * Captures the OAuth result from URL hash and saves it.
 * Call this once on app mount. Returns the connection if a fresh one was saved.
 *
 * Callback URL format: #gmail-connected?refresh_token=...&email=...
 */
export function captureOAuthRedirect(): GmailConnection | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#gmail-connected?')) return null;

  const params = new URLSearchParams(hash.slice('#gmail-connected?'.length));
  const refreshToken = params.get('refresh_token');
  const email = params.get('email');

  console.log('[Gmail OAuth] Capturing redirect:', { email, hasToken: !!refreshToken });

  if (!refreshToken || !email) {
    console.warn('[Gmail OAuth] Redirect missing refresh_token or email.');
    return null;
  }

  const conn = { refreshToken, email };
  saveConnection(conn);
  console.log('[Gmail OAuth] Saved connection for', email);

  // Strip the hash so a refresh doesn't reprocess it
  history.replaceState(null, '', window.location.pathname + window.location.search);

  return conn;
}

export interface MailAttachment {
  filename: string;
  mimeType: string;
  base64: string; // raw base64 (no data: prefix)
}

/** Send an invoice email via the Netlify function. */
export async function sendInvoiceEmail(args: {
  to: string;
  subject: string;
  html: string;
  pdfBase64?: string;
  pdfFilename?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const conn = getConnection();
  if (!conn) throw new Error('Gmail not connected.');

  if (isViteDevServer()) {
    throw new Error(
      'Vite dev server cannot reach Netlify Functions. Run `netlify dev` and use http://localhost:8888'
    );
  }

  const url = `${functionsBaseUrl()}/.netlify/functions/send-email`;
  console.log('[Gmail Send] POST', url, { to: args.to, subject: args.subject });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: conn.refreshToken,
      fromEmail: conn.email,
      ...args,
    }),
  });

  console.log('[Gmail Send] response status:', res.status);

  if (!res.ok) {
    let msg = `Send failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    console.error('[Gmail Send] failed:', msg);
    throw new Error(msg);
  }
}
