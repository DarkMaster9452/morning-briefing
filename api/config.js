import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  });
}
