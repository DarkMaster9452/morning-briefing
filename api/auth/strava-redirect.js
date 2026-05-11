export default function handler(req, res) {
  const { STRAVA_CLIENT_ID, BASE_URL } = process.env;
  if (!STRAVA_CLIENT_ID || !BASE_URL) {
    return res.status(500).send('Missing STRAVA_CLIENT_ID or BASE_URL env var');
  }
  const redirectUri = `${BASE_URL}/api/auth/strava`;
  const params = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    approval_prompt: 'force',
    scope:         'read,activity:read_all,profile:read_all',
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
