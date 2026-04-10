const FEEDS = {
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  ai:    'https://techcrunch.com/category/artificial-intelligence/feed/',
  tech:  'https://www.theverge.com/rss/index.xml',
};

function parseRSS(xml, max = 5) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < max) {
    const raw = m[1];
    const get = (tag) =>
      raw.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1]?.trim() ?? '';
    const link =
      get('link') ||
      raw.match(/<link[^>]+href="([^"]+)"/)?.[1] ||
      '';
    const desc = get('description').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim().slice(0, 180);
    items.push({ title: get('title'), link, desc, pub: get('pubDate') });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.query.type || 'world';
  const url  = FEEDS[type];
  if (!url) return res.status(400).json({ error: 'Invalid type' });
  try {
    const r   = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await r.text();
    const items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}
