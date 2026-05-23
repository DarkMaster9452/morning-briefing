// api/strava.js — fetches recent Strava activities for the dashboard artifact
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // 1. Exchange refresh token for a fresh access token
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: process.env.STRAVA_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error('No access token returned');

    // 2. Fetch last 10 activities
    const activitiesRes = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=10&page=1',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const activities = await activitiesRes.json();

    // 3. Return a clean summary the artifact and coach can use
    const runs = activities
      .filter(a => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type))
      .map(a => ({
        date:        a.start_date_local?.slice(0, 10),
        name:        a.name,
        distanceKm:  Math.round(a.distance / 10) / 100,
        durationMin: Math.round(a.moving_time / 60),
        paceMinKm:   a.distance > 0
          ? (a.moving_time / 60 / (a.distance / 1000)).toFixed(2)
          : null,
        avgHR:       a.average_heartrate || null,
        elevGain:    Math.round(a.total_elevation_gain || 0),
        kudos:       a.kudos_count,
      }));

    res.status(200).json({ ok: true, runs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
