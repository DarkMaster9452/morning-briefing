import { requireUser } from './_auth.js';

// Pulls sleep data from Google Fit. Requires the existing GOOGLE_REFRESH_TOKEN
// to have been granted scope: https://www.googleapis.com/auth/fitness.sleep.read
// (re-auth via /api/auth/google-redirect after the scope was added there).

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
  const user = await requireUser(req, res);
  if (!user) return;

  const { GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await getAccessToken();

    // Last 7 days of sleep sessions
    const endMs = Date.now();
    const startMs = endMs - 7 * 86400 * 1000;
    const sessRes = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions` +
      `?startTime=${new Date(startMs).toISOString()}` +
      `&endTime=${new Date(endMs).toISOString()}` +
      `&activityType=72`, // 72 == sleeping
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await sessRes.json();

    if (data.error) {
      // Likely missing scope on the refresh token. Surface clearly.
      const msg = data.error.message || 'fitness_error';
      const needsScope = /insufficient|scope/i.test(msg);
      return res.status(needsScope ? 401 : 500).json({
        error: msg,
        needsAuth: needsScope,
        hint: needsScope ? 'Re-authorize Google at /api/auth/google-redirect to grant fitness.sleep.read scope.' : undefined,
      });
    }

    const sessions = (data.session || []).map(s => ({
      start: parseInt(s.startTimeMillis, 10),
      end:   parseInt(s.endTimeMillis, 10),
      name:  s.name || s.description || 'Sleep',
    })).sort((a, b) => b.end - a.end);

    const lastNight = sessions[0] ? {
      minutes: Math.round((sessions[0].end - sessions[0].start) / 60000),
      start: new Date(sessions[0].start).toISOString(),
      end:   new Date(sessions[0].end).toISOString(),
      date:  new Date(sessions[0].end).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    } : null;

    const totalMinWeek = sessions.reduce((s, n) => s + (n.end - n.start) / 60000, 0);
    const avgPerNight = sessions.length ? Math.round(totalMinWeek / sessions.length) : 0;

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.json({
      lastNight,
      avgMinutes: avgPerNight,
      nightCount: sessions.length,
      sessions: sessions.slice(0, 7).map(s => ({
        minutes: Math.round((s.end - s.start) / 60000),
        end: new Date(s.end).toISOString(),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
