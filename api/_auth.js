// Server-side auth helper. Underscore-prefixed files in /api are NOT exposed
// as routes by Vercel — this module is only imported by other handlers.
//
// Verifies a Google ID token from the `Authorization: Bearer <token>` header
// against Google's tokeninfo endpoint, then checks that:
//   - the token's `aud` matches GOOGLE_CLIENT_ID
//   - the token's `email` matches ALLOWED_EMAIL
//   - the token is not expired
//
// Verified tokens are cached in module memory until their `exp` timestamp so
// repeat calls within the lambda's lifetime don't re-hit tokeninfo.

const tokenCache = new Map(); // token -> { email, exp }

async function verifyToken(token) {
  // Cache hit?
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(token);
  if (cached && cached.exp > now + 30) return cached;

  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!r.ok) throw new Error('tokeninfo_failed');
  const info = await r.json();

  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  const expectedEmail = process.env.ALLOWED_EMAIL;
  if (!expectedAud || !expectedEmail) throw new Error('server_misconfigured');
  if (info.aud !== expectedAud) throw new Error('bad_audience');
  if (info.email !== expectedEmail) throw new Error('forbidden');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('email_not_verified');
  const exp = parseInt(info.exp, 10);
  if (!exp || exp <= now) throw new Error('expired');

  const verified = { email: info.email, exp };
  tokenCache.set(token, verified);
  // Best-effort cleanup
  if (tokenCache.size > 50) {
    for (const [k, v] of tokenCache) if (v.exp <= now) tokenCache.delete(k);
  }
  return verified;
}

// Reflect an allowed origin (same site only). Override with ALLOWED_ORIGINS env
// (comma-separated) if you need additional origins (e.g. preview deployments).
function setCors(req, res) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const explicit = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const sameOrigin = origin && (origin.endsWith('://' + host));
  if (sameOrigin || explicit.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

// Returns the verified user on success, or null after responding with 401.
// Handler usage:
//   const user = await requireUser(req, res);
//   if (!user) return;
export async function requireUser(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return null; }

  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.status(401).json({ error: 'unauthorized', needsAuth: true });
    return null;
  }
  try {
    return await verifyToken(m[1]);
  } catch (e) {
    res.status(401).json({ error: 'unauthorized', reason: e.message, needsAuth: true });
    return null;
  }
}
