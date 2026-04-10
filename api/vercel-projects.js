export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { VERCEL_TOKEN, VERCEL_TEAM_ID } = process.env;
  if (!VERCEL_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const teamQ = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}&limit=10` : '?limit=10';
    const r = await fetch(`https://api.vercel.com/v9/projects${teamQ}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    const data = await r.json();

    if (data.error) {
      return res.status(401).json({ error: data.error.message, needsAuth: true });
    }

    const projects = (data.projects || []).map((p) => {
      const dep = p.latestDeployments?.[0] || null;
      return {
        id:     p.id,
        name:   p.name,
        url:    dep ? `https://${dep.url}` : null,
        state:  dep?.readyState || 'UNKNOWN',
        target: dep?.target || null,
        age:    dep?.createdAt || null,
        framework: p.framework || 'static',
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.json({ projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
