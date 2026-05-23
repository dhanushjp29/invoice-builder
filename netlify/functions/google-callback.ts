import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';

/**
 * GET /.netlify/functions/google-callback?code=...
 * Google redirects here after user consent. We exchange the auth code
 * for tokens, then redirect back to the frontend with the refresh_token
 * and connected email address as URL params. The frontend stores them
 * in localStorage.
 *
 * Note: storing refresh_token in localStorage is acceptable for a
 * single-seller / single-user invoice tool. For multi-tenant SaaS,
 * store server-side keyed by user id.
 */
export const handler: Handler = async (event) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, APP_URL } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !APP_URL) {
    return { statusCode: 500, body: 'Google OAuth env vars missing.' };
  }

  const code = event.queryStringParameters?.code;
  if (!code) {
    return { statusCode: 400, body: 'Missing authorization code.' };
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return {
        statusCode: 400,
        body: 'No refresh_token received. Revoke app access at https://myaccount.google.com/permissions and try again.',
      };
    }

    // Fetch the connected user's email so we can show it in the UI
    oAuth2Client.setCredentials(tokens);
    const userInfo = await google.oauth2({ version: 'v2', auth: oAuth2Client }).userinfo.get();
    const email = userInfo.data.email ?? '';

    // Hand the tokens back to the frontend via URL hash (not query) — hashes
    // are not sent to the server in subsequent requests / referrer headers.
    const params = new URLSearchParams({
      refresh_token: tokens.refresh_token,
      email,
    });

    // `state` carries the in-app path the user started from. Safety: only
    // honor same-origin relative paths so we can't be redirected off-site.
    const rawState = event.queryStringParameters?.state || '/';
    const returnTo = rawState.startsWith('/') && !rawState.startsWith('//') ? rawState : '/';

    return {
      statusCode: 302,
      headers: { Location: `${APP_URL}${returnTo}#gmail-connected?${params.toString()}` },
      body: '',
    };
  } catch (err) {
    console.error('OAuth callback failed:', err);
    return { statusCode: 500, body: 'OAuth exchange failed.' };
  }
};
