export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { NOTION_TOKEN } = process.env;
  if (!NOTION_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    // Search for recently edited pages
    const r = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        filter: { property: 'object', value: 'page' },
        page_size: 8,
      }),
    });

    const data = await r.json();

    if (data.status === 401 || data.code === 'unauthorized') {
      return res.status(401).json({ error: 'invalid_token', needsAuth: true });
    }

    const pages = (data.results || []).map((p) => {
      const title =
        p.properties?.title?.title?.[0]?.plain_text ||
        p.properties?.Name?.title?.[0]?.plain_text ||
        Object.values(p.properties || {}).find(v => v.type === 'title')?.title?.[0]?.plain_text ||
        'Untitled';
      return {
        id:       p.id,
        title,
        url:      p.url,
        edited:   p.last_edited_time,
        icon:     p.icon?.emoji || p.icon?.external?.url || null,
        type:     p.parent?.type === 'database_id' ? 'db' : 'page',
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({ pages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
