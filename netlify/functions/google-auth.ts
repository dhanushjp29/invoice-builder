import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';

/**
 * GET /.netlify/functions/google-auth
 * Redirects the user to Google's OAuth consent screen.
 * After approval, Google redirects back to /google-callback.
 */
export const handler: Handler = async (event) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return { statusCode: 500, body: 'Google OAuth env vars missing.' };
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  // Pass the in-app path the user came from through OAuth `state`,
  // so the callback can return them to the same page.
  const returnTo = event.queryStringParameters?.returnTo || '/';

  // access_type=offline → refresh token returned
  // prompt=consent → force consent screen every time so refresh_token is always issued
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: returnTo,
  });

  return {
    statusCode: 302,
    headers: { Location: authUrl },
    body: '',
  };
};
