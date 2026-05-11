const HTML = (title, color, body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{background:#050506;color:#FAFAFA;font-family:-apple-system,Inter,sans-serif;padding:48px;max-width:640px;margin:auto}
  h2{color:${color};margin-bottom:16px;font-weight:700}
  code{background:rgba(255,255,255,0.06);padding:14px;display:block;border-radius:10px;word-break:break-all;font-size:13px;margin:12px 0;border:1px solid rgba(255,255,255,0.08);font-family:ui-monospace,Menlo,monospace}
  a{color:#FC4C02}
  p{color:#B8B6B0;line-height:1.6;margin:8px 0}
  .step{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin:12px 0}
  .step b{color:#FAFAFA}
  button{margin-top:8px;padding:7px 14px;background:#FC4C02;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700}
</style></head><body>${body}</body></html>`;

export default async function handler(req, res) {
  const { code, error } = req.query;
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

  if (error || !code) {
    return res.send(HTML('Error', '#FF6B6B', `<h2>❌ Strava auth error</h2><p>${error || 'No code received'}</p>`));
  }
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.send(HTML('Error', '#FF6B6B', `<h2>❌ Missing env vars</h2><p>Set <b>STRAVA_CLIENT_ID</b> and <b>STRAVA_CLIENT_SECRET</b> in Vercel.</p>`));
  }

  const tokenRes = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const data = await tokenRes.json();

  if (data.refresh_token) {
    res.send(HTML('✅ Strava Connected', '#FC4C02', `
      <h2>✅ Strava Connected!</h2>
      <p>Add this value to your Vercel environment variables:</p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">STRAVA_REFRESH_TOKEN</code><br><br>
        <b>Value (copy everything):</b>
        <code>${data.refresh_token}</code>
        <button onclick="navigator.clipboard.writeText('${data.refresh_token}')">Copy token</button>
      </div>
      <div class="step">
        <p>1. Paste <b>STRAVA_REFRESH_TOKEN</b> into Vercel → Redeploy</p>
        <p>2. <a href="/">Back to dashboard</a> 🏃</p>
      </div>
    `));
  } else {
    res.send(HTML('Error', '#FF6B6B', `
      <h2>❌ Could not get Strava token</h2>
      <p>${data.message || data.error || 'Unknown error'}</p>
      <code>${JSON.stringify(data, null, 2)}</code>
      <p>Common causes:</p>
      <p>• Wrong <b>STRAVA_CLIENT_SECRET</b> in Vercel env vars</p>
      <p>• Callback URL doesn't match the app's Authorization Callback Domain</p>
    `));
  }
}
