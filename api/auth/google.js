const HTML = (title, color, body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{background:#0f1117;color:#e2e8f0;font-family:'Segoe UI',sans-serif;padding:48px;max-width:600px;margin:auto}
  h2{color:${color};margin-bottom:16px} code{background:#1a1d27;padding:16px;display:block;border-radius:10px;word-break:break-all;font-size:13px;margin:12px 0;border:1px solid #2e3250}
  a{color:#6c63ff} p{color:#8892b0;line-height:1.6;margin:8px 0} .step{background:#1a1d27;border:1px solid #2e3250;border-radius:10px;padding:16px;margin:12px 0}
  .step b{color:#e2e8f0}
</style></head><body>${body}</body></html>`;

export default async function handler(req, res) {
  const { code, error } = req.query;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const proto       = req.headers['x-forwarded-proto'] || 'https';
  const host        = req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/google`;

  if (error) {
    return res.send(HTML('Error', '#ff6584', `<h2>❌ Auth Error</h2><p>${error}</p>`));
  }
  if (!code) {
    return res.status(400).send(HTML('Error', '#ff6584', '<h2>❌ No code</h2>'));
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });

  const data = await tokenRes.json();

  if (data.refresh_token) {
    res.send(HTML('✅ Google Connected', '#43d9ad', `
      <h2>✅ Google Connected!</h2>
      <p>Copy the refresh token below and add it to your <a href="https://vercel.com/darksimperium/morning-briefing/settings/environment-variables" target="_blank">Vercel environment variables</a>.</p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">GOOGLE_REFRESH_TOKEN</code><br><br>
        <b>Value:</b>
        <code>${data.refresh_token}</code>
      </div>
      <div class="step">
        <p><b>Steps:</b></p>
        <p>1. Click the Vercel link above → Add <b>GOOGLE_REFRESH_TOKEN</b></p>
        <p>2. Redeploy the project (or just push to GitHub)</p>
        <p>3. <a href="/">Go to your dashboard</a> — Gmail &amp; Calendar will be live 🎉</p>
      </div>
    `));
  } else {
    res.send(HTML('Error', '#ff6584', `
      <h2>❌ Could not get refresh token</h2>
      <p>${data.error_description || 'Unknown error'}</p>
      <code>${JSON.stringify(data, null, 2)}</code>
    `));
  }
}
