// Notion database IDs (from Web Project Manager workspace)
const TASKS_DB_ID    = '3131c3f6-0898-81cf-b96d-edd1a8593e83'; // Tasks & Actions
const PROJECTS_DB_ID = '3131c3f6-0898-819e-8ad0-dcea1e623f12'; // Projects

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

function getTitle(page) {
  const props = page.properties || {};
  for (const key of ['Task Name', 'Project Name', 'Name', 'title']) {
    const p = props[key];
    if (p?.type === 'title' && p.title?.[0]?.plain_text) return p.title[0].plain_text;
  }
  return 'Untitled';
}

function getStatus(page, key = 'Status') {
  return page.properties?.[key]?.status?.name || null;
}

function getSelect(page, key) {
  return page.properties?.[key]?.select?.name || null;
}

function getNumber(page, key) {
  return page.properties?.[key]?.number ?? null;
}

function getUrl(page, key = 'Link') {
  return page.properties?.[key]?.url || null;
}

function getDate(page, key = 'Due Date') {
  return page.properties?.[key]?.date?.start || null;
}

async function queryDatabase(token, dbId, body) {
  const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify(body),
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { NOTION_TOKEN } = process.env;
  if (!NOTION_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    // ── 1. Fetch active tasks (exclude Done) ────────────────────────────────
    const tasksRaw = await queryDatabase(NOTION_TOKEN, TASKS_DB_ID, {
      filter: {
        property: 'Status',
        status: { does_not_equal: 'Done' },
      },
      sorts: [
        // Urgency first: "Need's to be done Now!!!" comes first alphabetically after sort trick
        // We'll sort by Status group: In progress > To do > Waiting
        { property: 'Status',    direction: 'ascending' },
        { property: 'Due Date',  direction: 'ascending' },
      ],
      page_size: 12,
    });

    if (tasksRaw.status === 401 || tasksRaw.code === 'unauthorized') {
      return res.status(401).json({ error: 'invalid_token', needsAuth: true });
    }

    // Urgency priority map
    const URGENCY = {
      "Need's to be done Now!!!": { label: 'NOW!', color: 'red' },
      "It's okay":                { label: 'OK',   color: 'yellow' },
      'Sooo much time':           { label: 'calm', color: 'green' },
    };

    // Status color map
    const STATUS_COLOR = {
      'Review by Martin': 'red',
      'To Do':            'default',
      'Finishing':        'orange',
      'In progress':      'blue',
      'Waiting':          'purple',
    };

    const tasks = (tasksRaw.results || []).map(p => ({
      id:       p.id,
      url:      p.url,
      title:    getTitle(p),
      status:   getStatus(p, 'Status'),
      statusColor: STATUS_COLOR[getStatus(p, 'Status')] || 'default',
      urgency:  URGENCY[getSelect(p, 'In hurry ?')] || null,
      dueDate:  getDate(p, 'Due Date'),
      edited:   p.last_edited_time,
    }));

    // ── 2. Fetch projects (all phases) ─────────────────────────────────────
    const projectsRaw = await queryDatabase(NOTION_TOKEN, PROJECTS_DB_ID, {
      sorts: [
        { property: 'Phase', direction: 'ascending' },
      ],
      page_size: 20,
    });

    const PHASE_COLOR = {
      'Finishing':   'orange',
      'Design':      'blue',
      'Concept':     'purple',
      'Potentional': 'gray',
      'Completed':   'green',
    };

    const PHASE_ICON = {
      'Finishing':   '🔶',
      'Design':      '🎨',
      'Concept':     '💡',
      'Potentional': '👀',
      'Completed':   '✅',
    };

    const projects = (projectsRaw.results || []).map(p => {
      const phase = getStatus(p, 'Phase');
      const price = getNumber(p, 'Price');
      const monthly = getNumber(p, 'Monthly paid');
      return {
        id:         p.id,
        url:        p.url,
        title:      getTitle(p),
        phase,
        phaseColor: PHASE_COLOR[phase] || 'default',
        phaseIcon:  PHASE_ICON[phase]  || '•',
        price:      price   != null ? `€${price}`   : null,
        monthly:    monthly != null ? `€${monthly}/mes` : null,
        link:       getUrl(p, 'Link'),
        edited:     p.last_edited_time,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    res.json({ tasks, projects });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
