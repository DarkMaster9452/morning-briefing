async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error_description || 'Token refresh failed');
  return d.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await getAccessToken();

    // Today in Europe/Bratislava
    const now = new Date();
    // Get start/end of today in Bratislava (UTC+2)
    const offset = 2 * 60; // minutes
    const local  = new Date(now.getTime() + offset * 60000);
    const y = local.getUTCFullYear(), mo = local.getUTCMonth(), d = local.getUTCDate();
    const start = new Date(Date.UTC(y, mo, d, 0, 0, 0) - offset * 60000).toISOString();
    const end   = new Date(Date.UTC(y, mo, d, 23, 59, 59) - offset * 60000).toISOString();

    const evRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=15`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { items = [] } = await evRes.json();

    const events = items.map((e) => ({
      id:       e.id,
      title:    e.summary || '(no title)',
      start:    e.start?.dateTime || e.start?.date,
      end:      e.end?.dateTime   || e.end?.date,
      allDay:   !e.start?.dateTime,
      location: e.location || '',
      attendees: (e.attendees || []).length,
      color:    e.colorId || null,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
