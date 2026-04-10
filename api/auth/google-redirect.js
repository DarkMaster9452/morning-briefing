export default function handler(req, res) {
  const { GOOGLE_CLIENT_ID, BASE_URL } = process.env;

  // Use explicit BASE_URL env var — avoids redirect_uri mismatch errors
  const redirectUri = `${BASE_URL}/api/auth/google`;

  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ');

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope,
    access_type:   'offline',
    prompt:        'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
