import { requireUser } from './_auth.js';

// Internal helper: call the existing strava/sleep endpoints with the same
// Authorization header so they apply the same auth check + caching.
async function fetchInternal(req, path) {
  // Vercel sets VERCEL_URL but it's the *deployment* host. Use the request's
  // own host to stay on whichever domain we were called from.
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const url = `${proto}://${host}${path}`;
  const r = await fetch(url, {
    headers: { Authorization: req.headers.authorization || '' },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function paceFmt(secPerKm) {
  if (!secPerKm) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ANTHROPIC_API_KEY } = process.env;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'missing_anthropic_key',
      reason: 'Set ANTHROPIC_API_KEY in Vercel env vars to enable the coach.',
    });
  }

  // Read plan from body (POST) or defaults
  let plan = { targetKm: 10, days: 30 };
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (body.plan) plan = { ...plan, ...body.plan };
    } catch {}
  }

  // Gather data
  const [strava, sleep] = await Promise.all([
    fetchInternal(req, '/api/strava'),
    fetchInternal(req, '/api/sleep'),
  ]);

  // Compress to a compact prompt-friendly form
  const sleepCtx = sleep.body?.lastNight ? {
    lastNightMin: sleep.body.lastNight.minutes,
    avgMin: sleep.body.avgMinutes,
    nights: sleep.body.nightCount,
  } : { error: sleep.body?.error || 'no_sleep_data' };

  const stravaCtx = !strava.body?.error ? {
    weekKm: ((strava.body?.weekKmMeters || 0) / 1000).toFixed(2),
    weekRuns: strava.body?.weekCount || 0,
    monthKm: ((strava.body?.monthMeters || 0) / 1000).toFixed(2),
    monthRuns: strava.body?.runCount || 0,
    longestKm: strava.body?.longestKm || 0,
    lastRun: strava.body?.lastRun ? {
      km: ((strava.body.lastRun.distance || 0) / 1000).toFixed(2),
      daysAgo: strava.body.lastRun.daysAgo,
      avgHr: strava.body.lastRun.averageHr || null,
      pace: paceFmt(strava.body.lastRun.averagePace),
    } : null,
    recent: (strava.body?.recent || []).map(r => ({
      date: r.date?.slice(0, 10),
      km: ((r.distance || 0) / 1000).toFixed(2),
      mins: Math.round((r.movingTime || 0) / 60),
      avgHr: r.averageHr,
      pace: paceFmt(r.averagePace),
    })),
  } : { error: strava.body?.error || 'no_strava_data' };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const systemPrompt = `You are a calm, evidence-based running coach. The athlete's goal: run ${plan.targetKm} km continuously within ~${plan.days || 30} days. Your job is to look at their recent runs and sleep, then prescribe TODAY only.

Hard rules (non-negotiable):
1. HEALTHY OVER FAST. If sleep < 6h last night → recommend rest or 20-min easy walk. Never push through bad sleep.
2. Conservative progression. Weekly mileage increase ≤ 10%. No more than one hard session per week.
3. If the athlete ran yesterday at moderate-hard effort, today is easy or rest.
4. If they haven't run in 4+ days, restart with an easy 2-3 km, not a long run.
5. Heart rate context if available: easy = zone 1-2 (≤ ~145 bpm for most adults); ignore if no HR data.
6. Encourage walk-run intervals if longest run is < 5 km.
7. Be specific: state distance OR time, target effort, and one cue (form, pace, hydration, etc).
8. Keep the note ≤ 90 words. No bullet lists. Plain conversational paragraph.

Return ONLY a JSON object: {"title": "<3-6 word headline>", "note": "<body paragraph>"}. No markdown, no fences, no preamble.`;

  const userPrompt = `Date: ${today}
Goal: run ${plan.targetKm} km in ~${plan.days || 30} days.
Sleep: ${JSON.stringify(sleepCtx)}
Strava (last 30d, runs only): ${JSON.stringify(stravaCtx)}

Prescribe today.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await r.json();
    if (data.error) {
      return res.status(500).json({ error: 'anthropic_error', reason: data.error.message });
    }
    const raw = data.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.trim()); }
    catch {
      // Strip code fences if present, retry
      const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(stripped);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      title: parsed.title || 'Today\'s plan',
      note: parsed.note || '—',
      usage: data.usage || null,
    });
  } catch (e) {
    res.status(500).json({ error: 'coach_failed', reason: e.message });
  }
}
