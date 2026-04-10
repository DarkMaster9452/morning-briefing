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

    // List unread messages from last 24h
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:1d&maxResults=8',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { messages = [] } = await listRes.json();

    // Fetch metadata for each
    const emails = await Promise.all(
      messages.slice(0, 6).map(async (msg) => {
        const d = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}` +
          `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await d.json();
        const hdrs = data.payload?.headers || [];
        const hdr  = (name) => hdrs.find((h) => h.name === name)?.value || '';
        return {
          id:      msg.id,
          subject: hdr('Subject') || '(no subject)',
          from:    hdr('From'),
          date:    hdr('Date'),
          snippet: (data.snippet || '').slice(0, 120),
          labels:  data.labelIds || [],
        };
      })
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({ emails, total: messages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
