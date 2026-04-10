async function getAccessToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(SPOTIFY_REFRESH_TOKEN)}`,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error?.message || 'Spotify token refresh failed');
  return d.access_token;
}

function formatTrack(track) {
  if (!track) return null;
  return {
    name:     track.name,
    artist:   track.artists?.map((a) => a.name).join(', ') || '',
    album:    track.album?.name || '',
    image:    track.album?.images?.[0]?.url || null,
    url:      track.external_urls?.spotify || '',
    duration: track.duration_ms,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await getAccessToken();

    // Try currently playing first
    const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (nowRes.status === 204) {
      // Nothing playing — get recently played
      const recRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=3', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rec = await recRes.json();
      const recent = (rec.items || []).map((i) => ({
        ...formatTrack(i.track),
        playedAt: i.played_at,
      }));
      return res.json({ playing: false, track: null, recent });
    }

    const data  = await nowRes.json();
    const track = formatTrack(data.item);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      playing:  data.is_playing,
      progress: data.progress_ms,
      track,
      recent:   [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
