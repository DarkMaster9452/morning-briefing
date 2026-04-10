export default function handler(req, res) {
  const { SPOTIFY_CLIENT_ID } = process.env;
  const proto       = req.headers['x-forwarded-proto'] || 'https';
  const host        = req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/spotify`;

  const scope = [
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-read-playback-state',
  ].join(' ');

  const params = new URLSearchParams({
    client_id:     SPOTIFY_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
