export default function handler(req, res) {
  const { SPOTIFY_CLIENT_ID, BASE_URL } = process.env;

  const redirectUri = `${BASE_URL}/api/auth/spotify`;

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
