const HTML = (title, color, body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{background:#0f1117;color:#e2e8f0;font-family:'Segoe UI',sans-serif;padding:48px;max-width:600px;margin:auto}
  h2{color:${color};margin-bottom:16px} code{background:#1a1d27;padding:16px;display:block;border-radius:10px;word-break:break-all;font-size:13px;margin:12px 0;border:1px solid #2e3250}
  a{color:#1db954} p{color:#8892b0;line-height:1.6;margin:8px 0} .step{background:#1a1d27;border:1px solid #2e3250;border-radius:10px;padding:16px;margin:12px 0}
  .step b{color:#e2e8f0}
</style></head><body>${body}</body></html>`;

export default async function handler(req, res) {
  const { code, error } = req.query;
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const proto       = req.headers['x-forwarded-proto'] || 'https';
  const host        = req.headers.host;
  const redirectUri = `${proto}://${host}/api/auth/spotify`;

  if (error || !code) {
    return res.send(HTML('Error', '#ff6584', `<h2>❌ Spotify auth error</h2><p>${error || 'No code'}</p>`));
  }

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });

  const data = await tokenRes.json();

  if (data.refresh_token) {
    res.send(HTML('✅ Spotify Connected', '#1db954', `
      <h2>✅ Spotify Connected!</h2>
      <p>Add this to your <a href="https://vercel.com/darksimperium/morning-briefing/settings/environment-variables" target="_blank">Vercel environment variables</a>:</p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">SPOTIFY_REFRESH_TOKEN</code><br><br>
        <b>Value:</b>
        <code>${data.refresh_token}</code>
      </div>
      <div class="step">
        <p>1. Add <b>SPOTIFY_REFRESH_TOKEN</b> to Vercel env vars</p>
        <p>2. Redeploy → <a href="/">Go to dashboard</a> 🎵</p>
      </div>
    `));
  } else {
    res.send(HTML('Error', '#ff6584', `<h2>❌ Error</h2><code>${JSON.stringify(data, null, 2)}</code>`));
  }
}
