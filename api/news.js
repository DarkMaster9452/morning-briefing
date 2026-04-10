const FEEDS = {
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  ai:    'https://techcrunch.com/category/artificial-intelligence/feed/',
  tech:  'https://feeds.arstechnica.com/arstechnica/index',   // Ars Technica — reliable RSS
};

function parseRSS(xml, max = 6) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < max) {
    const raw = m[1];
    const get = (tag) => {
      const match = raw.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
      return match ? match[1].trim() : '';
    };
    // link can be a self-closing tag or between tags
    const link =
      get('link') ||
      (raw.match(/<link[^/]* href="([^"]+)"/) || [])[1] ||
      '';
    const desc = get('description')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
      .trim()
      .slice(0, 160);
    items.push({ title: get('title'), link, desc, pub: get('pubDate') });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.query.type || 'world';
  const url  = FEEDS[type];
  if (!url) return res.status(400).json({ error: 'Invalid type', items: [] });
  try {
    const r   = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Morning-Briefing/1.0)' } });
    const xml = await r.text();
    const items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message, items: [] });
  }
}
