import { requireUser } from './_auth.js';

async function getAccessToken() {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;
  const r = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(d.message || 'Strava token refresh failed');
  return d.access_token;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { STRAVA_REFRESH_TOKEN } = process.env;
  if (!STRAVA_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await getAccessToken();
    // Pull last ~30 days of activities
    const after = Math.floor((Date.now() - 31 * 86400 * 1000) / 1000);
    const actRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=60`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const activities = await actRes.json();
    if (!Array.isArray(activities)) {
      return res.status(500).json({ error: activities.message || 'Strava error' });
    }

    const runs = activities.filter(a => /run/i.test(a.type) || /run/i.test(a.sport_type || ''));
    const now = Date.now();
    const weekStart = now - 7 * 86400 * 1000;
    const weekRuns = runs.filter(a => new Date(a.start_date).getTime() >= weekStart);
    const weekKmMeters = weekRuns.reduce((s, a) => s + (a.distance || 0), 0);

    let longestKm = 0;
    for (const r of runs) {
      const km = (r.distance || 0) / 1000;
      if (km > longestKm) longestKm = km;
    }

    const lastRunRaw = runs[0]; // already sorted desc by Strava
    const lastRun = lastRunRaw ? {
      id: lastRunRaw.id,
      name: lastRunRaw.name,
      distance: lastRunRaw.distance,
      movingTime: lastRunRaw.moving_time,
      averageHr: lastRunRaw.average_heartrate || null,
      maxHr: lastRunRaw.max_heartrate || null,
      averagePace: lastRunRaw.average_speed ? (1000 / lastRunRaw.average_speed) : null, // sec / km
      date: lastRunRaw.start_date,
      daysAgo: Math.floor((now - new Date(lastRunRaw.start_date).getTime()) / 86400000),
    } : null;

    // 30-day summary
    const monthMeters = runs.reduce((s, a) => s + (a.distance || 0), 0);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({
      weekCount: weekRuns.length,
      weekKmMeters,
      monthMeters,
      runCount: runs.length,
      longestKm: +longestKm.toFixed(2),
      lastRun,
      // Last 8 runs (trim) for coach context
      recent: runs.slice(0, 8).map(r => ({
        name: r.name,
        distance: r.distance,
        movingTime: r.moving_time,
        averageHr: r.average_heartrate || null,
        averagePace: r.average_speed ? (1000 / r.average_speed) : null,
        date: r.start_date,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
