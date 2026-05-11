import { requireUser } from './_auth.js';

const LAT = 49.0889;
const LON = 18.6372;

const DAYS_SK = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

const OW_ICONS = {
  200: '⛈️', 201: '⛈️', 202: '⛈️', 210: '🌩️', 211: '🌩️', 212: '🌩️', 221: '🌩️', 230: '⛈️', 231: '⛈️', 232: '⛈️',
  300: '🌦️', 301: '🌦️', 302: '🌧️', 310: '🌦️', 311: '🌧️', 312: '🌧️', 313: '🌦️', 314: '🌧️', 321: '🌦️',
  500: '🌧️', 501: '🌧️', 502: '🌧️', 503: '🌧️', 504: '🌧️', 511: '🌨️', 520: '🌦️', 521: '🌦️', 522: '🌧️', 531: '🌦️',
  600: '❄️', 601: '❄️', 602: '❄️', 611: '🌨️', 612: '🌨️', 613: '🌨️', 615: '🌨️', 616: '🌨️', 620: '❄️', 621: '❄️', 622: '❄️',
  701: '🌫️', 711: '🌫️', 721: '🌫️', 731: '🌪️', 741: '🌫️', 751: '🌪️', 761: '🌪️', 762: '🌋', 771: '💨', 781: '🌪️',
  800: '☀️', 801: '🌤️', 802: '⛅', 803: '🌥️', 804: '☁️',
};

const OPEN_METEO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 80: '🌦️', 81: '🌦️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const OPEN_METEO_DESCRIPTIONS = {
  0: 'Jasno',
  1: 'Prevaz. jasno',
  2: 'Ciastocne oblacno',
  3: 'Zamracene',
  45: 'Hmla',
  51: 'Slabe mrholenie',
  61: 'Slaby dazd',
  63: 'Dazd',
  65: 'Silny dazd',
  71: 'Slaby sneh',
  73: 'Sneh',
  75: 'Silny sneh',
  80: 'Lejak',
  95: 'Burka',
};

const FEEDS = {
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  ai: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  tech: 'https://feeds.arstechnica.com/arstechnica/index',
};

const TASKS_DB_ID = '3131c3f6-0898-81cf-b96d-edd1a8593e83';
const PROJECTS_DB_ID = '3131c3f6-0898-819e-8ad0-dcea1e623f12';

function getRouteSegments(req) {
  const value = req.query?.route;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function owIcon(id) {
  return OW_ICONS[id] || '🌡️';
}

function paceFmt(secPerKm) {
  if (!secPerKm) return null;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

function formatTrack(track) {
  if (!track) return null;
  return {
    name: track.name,
    artist: track.artists?.map((artist) => artist.name).join(', ') || '',
    album: track.album?.name || '',
    image: track.album?.images?.[0]?.url || null,
    url: track.external_urls?.spotify || '',
    duration: track.duration_ms,
  };
}

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
    const prop = props[key];
    if (prop?.type === 'title' && prop.title?.[0]?.plain_text) return prop.title[0].plain_text;
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
  const prop = page.properties?.[key];
  if (!prop) return null;
  if (prop.number != null) return prop.number;
  if (prop.formula?.number != null) return prop.formula.number;
  if (prop.rollup?.number != null) return prop.rollup.number;
  return null;
}

function getUrl(page, key = 'Link') {
  return page.properties?.[key]?.url || null;
}

function getDate(page, key = 'Due Date') {
  return page.properties?.[key]?.date?.start || null;
}

function parseRSS(xml, max = 6) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = regex.exec(xml)) !== null && items.length < max) {
    const raw = match[1];
    const get = (tag) => {
      const value = raw.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
      return value ? value[1].trim() : '';
    };
    const link = get('link') || (raw.match(/<link[^/]* href="([^"]+)"/) || [])[1] || '';
    const desc = get('description')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .trim()
      .slice(0, 160);
    items.push({ title: get('title'), link, desc, pub: get('pubDate') });
  }
  return items;
}

function googleAuthHtml(title, color, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{background:#0f1117;color:#e2e8f0;font-family:'Segoe UI',sans-serif;padding:48px;max-width:600px;margin:auto}
  h2{color:${color};margin-bottom:16px}
  code{background:#1a1d27;padding:16px;display:block;border-radius:10px;word-break:break-all;font-size:13px;margin:12px 0;border:1px solid #2e3250}
  a{color:#6c63ff} p{color:#8892b0;line-height:1.6;margin:8px 0}
  .step{background:#1a1d27;border:1px solid #2e3250;border-radius:10px;padding:16px;margin:12px 0}
  .step b{color:#e2e8f0}
</style></head><body>${body}</body></html>`;
}

function spotifyAuthHtml(title, color, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{background:#0f1117;color:#e2e8f0;font-family:'Segoe UI',sans-serif;padding:48px;max-width:600px;margin:auto}
  h2{color:${color};margin-bottom:16px}
  code{background:#1a1d27;padding:16px;display:block;border-radius:10px;word-break:break-all;font-size:13px;margin:12px 0;border:1px solid #2e3250}
  a{color:#1db954} p{color:#8892b0;line-height:1.6;margin:8px 0}
  .step{background:#1a1d27;border:1px solid #2e3250;border-radius:10px;padding:16px;margin:12px 0}
  .step b{color:#e2e8f0}
</style></head><body>${body}</body></html>`;
}

function stravaAuthHtml(title, color, body) {
  return `<!DOCTYPE html>
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
}

async function refreshGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error(data.error_description || 'Token refresh failed');
  return data.access_token;
}

async function refreshSpotifyAccessToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(SPOTIFY_REFRESH_TOKEN)}`,
  });
  const data = await response.json();
  if (!data.access_token) throw new Error(data.error?.message || 'Spotify token refresh failed');
  return data.access_token;
}

async function refreshStravaAccessToken() {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error(data.message || 'Strava token refresh failed');
  return data.access_token;
}

async function queryDatabase(token, dbId, body) {
  const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify(body),
  });
  return response.json();
}

async function fetchSleepPayload() {
  const { GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_REFRESH_TOKEN) {
    const error = new Error('not_connected');
    error.statusCode = 401;
    error.needsAuth = true;
    throw error;
  }

  const token = await refreshGoogleAccessToken();
  const endMs = Date.now();
  const startMs = endMs - 7 * 86400 * 1000;
  const sessionResponse = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startMs).toISOString()}&endTime=${new Date(endMs).toISOString()}&activityType=72`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await sessionResponse.json();

  if (data.error) {
    const message = data.error.message || 'fitness_error';
    const error = new Error(message);
    error.statusCode = /insufficient|scope/i.test(message) ? 401 : 500;
    error.needsAuth = error.statusCode === 401;
    if (error.needsAuth) {
      error.hint = 'Re-authorize Google at /api/auth/google-redirect to grant fitness.sleep.read scope.';
    }
    throw error;
  }

  const sessions = (data.session || [])
    .map((session) => ({
      start: parseInt(session.startTimeMillis, 10),
      end: parseInt(session.endTimeMillis, 10),
      name: session.name || session.description || 'Sleep',
    }))
    .sort((left, right) => right.end - left.end);

  const lastNight = sessions[0]
    ? {
        minutes: Math.round((sessions[0].end - sessions[0].start) / 60000),
        start: new Date(sessions[0].start).toISOString(),
        end: new Date(sessions[0].end).toISOString(),
        date: new Date(sessions[0].end).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      }
    : null;

  const totalMinutes = sessions.reduce((sum, session) => sum + (session.end - session.start) / 60000, 0);
  const avgPerNight = sessions.length ? Math.round(totalMinutes / sessions.length) : 0;

  return {
    lastNight,
    avgMinutes: avgPerNight,
    nightCount: sessions.length,
    sessions: sessions.slice(0, 7).map((session) => ({
      minutes: Math.round((session.end - session.start) / 60000),
      end: new Date(session.end).toISOString(),
    })),
  };
}

async function fetchStravaPayload() {
  const { STRAVA_REFRESH_TOKEN } = process.env;
  if (!STRAVA_REFRESH_TOKEN) {
    const error = new Error('not_connected');
    error.statusCode = 401;
    error.needsAuth = true;
    throw error;
  }

  const token = await refreshStravaAccessToken();
  const after = Math.floor((Date.now() - 31 * 86400 * 1000) / 1000);
  const activityResponse = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=60`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const activities = await activityResponse.json();
  if (!Array.isArray(activities)) {
    throw new Error(activities.message || 'Strava error');
  }

  const runs = activities.filter((activity) => /run/i.test(activity.type) || /run/i.test(activity.sport_type || ''));
  const now = Date.now();
  const weekStart = now - 7 * 86400 * 1000;
  const weekRuns = runs.filter((activity) => new Date(activity.start_date).getTime() >= weekStart);
  const weekKmMeters = weekRuns.reduce((sum, activity) => sum + (activity.distance || 0), 0);

  let longestKm = 0;
  for (const run of runs) {
    const km = (run.distance || 0) / 1000;
    if (km > longestKm) longestKm = km;
  }

  const lastRunRaw = runs[0];
  const lastRun = lastRunRaw
    ? {
        id: lastRunRaw.id,
        name: lastRunRaw.name,
        distance: lastRunRaw.distance,
        movingTime: lastRunRaw.moving_time,
        averageHr: lastRunRaw.average_heartrate || null,
        maxHr: lastRunRaw.max_heartrate || null,
        averagePace: lastRunRaw.average_speed ? 1000 / lastRunRaw.average_speed : null,
        date: lastRunRaw.start_date,
        daysAgo: Math.floor((now - new Date(lastRunRaw.start_date).getTime()) / 86400000),
      }
    : null;

  return {
    weekCount: weekRuns.length,
    weekKmMeters,
    monthMeters: runs.reduce((sum, activity) => sum + (activity.distance || 0), 0),
    runCount: runs.length,
    longestKm: +longestKm.toFixed(2),
    lastRun,
    recent: runs.slice(0, 8).map((run) => ({
      name: run.name,
      distance: run.distance,
      movingTime: run.moving_time,
      averageHr: run.average_heartrate || null,
      averagePace: run.average_speed ? 1000 / run.average_speed : null,
      date: run.start_date,
    })),
  };
}

async function handleWeather(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.OPENWEATHER_API_KEY;

  if (key) {
    try {
      const base = 'https://api.openweathermap.org/data/2.5';
      const [currentResponse, forecastResponse] = await Promise.all([
        fetch(`${base}/weather?lat=${LAT}&lon=${LON}&units=metric&lang=sk&appid=${key}`),
        fetch(`${base}/forecast?lat=${LAT}&lon=${LON}&units=metric&cnt=40&appid=${key}`),
      ]);
      const current = await currentResponse.json();
      const forecastData = await forecastResponse.json();
      if (current.cod !== 200) throw new Error(current.message || 'OpenWeather error');

      const hourly = (forecastData.list || []).slice(0, 8).map((item) => ({
        time: item.dt_txt.slice(11, 16),
        icon: owIcon(item.weather[0].id),
        temp: Math.round(item.main.temp),
        pop: Math.round((item.pop || 0) * 100),
      }));

      const today = new Date().toISOString().slice(0, 10);
      const days = {};
      for (const item of forecastData.list || []) {
        const day = item.dt_txt.slice(0, 10);
        if (day === today) continue;
        if (!days[day]) days[day] = { temps: [], ids: [] };
        days[day].temps.push(item.main.temp_min, item.main.temp_max);
        days[day].ids.push(item.weather[0].id);
      }

      const forecast = Object.entries(days).slice(0, 3).map(([date, values]) => {
        const dateAtNoon = new Date(`${date}T12:00:00`);
        return {
          name: DAYS_SK[dateAtNoon.getDay()],
          icon: owIcon(values.ids[Math.floor(values.ids.length / 2)]),
          hi: Math.round(Math.max(...values.temps)),
          lo: Math.round(Math.min(...values.temps)),
        };
      });

      res.setHeader('Cache-Control', 's-maxage=600,stale-while-revalidate');
      return res.json({
        _source: 'openweather',
        temp: Math.round(current.main.temp),
        feels_like: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        wind: Math.round(current.wind.speed * 3.6),
        icon: owIcon(current.weather[0].id),
        desc: current.weather[0].description,
        hourly,
        forecast,
      });
    } catch (error) {
      console.error('OpenWeather failed:', error.message);
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBratislava&forecast_days=3`;
    const data = await fetch(url).then((response) => response.json());
    const current = data.current;
    const nowHour = new Date().toISOString().slice(0, 13);
    const times = data.hourly.time || [];
    let startIndex = times.findIndex((time) => time.startsWith(nowHour));
    if (startIndex < 0) startIndex = 0;

    const hourly = times.slice(startIndex + 1, startIndex + 9).map((time, index) => {
      const dataIndex = startIndex + 1 + index;
      return {
        time: time.slice(11, 16),
        icon: OPEN_METEO_ICONS[data.hourly.weather_code[dataIndex]] || '🌡️',
        temp: Math.round(data.hourly.temperature_2m[dataIndex]),
        pop: data.hourly.precipitation_probability?.[dataIndex] ?? 0,
      };
    });

    const forecast = data.daily.time.slice(1, 4).map((time, index) => {
      const date = new Date(`${time}T12:00:00`);
      return {
        name: DAYS_SK[date.getDay()],
        icon: OPEN_METEO_ICONS[data.daily.weather_code[index + 1]] || '🌡️',
        hi: Math.round(data.daily.temperature_2m_max[index + 1]),
        lo: Math.round(data.daily.temperature_2m_min[index + 1]),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.json({
      _source: 'open-meteo',
      temp: Math.round(current.temperature_2m),
      feels_like: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      wind: Math.round(current.wind_speed_10m),
      icon: OPEN_METEO_ICONS[current.weather_code] || '🌡️',
      desc: OPEN_METEO_DESCRIPTIONS[current.weather_code] || '',
      hourly,
      forecast,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleSpotify(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await refreshSpotifyAccessToken();
    const currentResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (currentResponse.status === 204) {
      const recentResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=3', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const recentData = await recentResponse.json();
      const recent = (recentData.items || []).map((item) => ({
        ...formatTrack(item.track),
        playedAt: item.played_at,
      }));
      return res.json({ playing: false, track: null, recent });
    }

    const data = await currentResponse.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      playing: data.is_playing,
      progress: data.progress_ms,
      track: formatTrack(data.item),
      recent: [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleGmail(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await refreshGoogleAccessToken();
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:1d&maxResults=8',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { messages = [] } = await listResponse.json();

    const emails = await Promise.all(
      messages.slice(0, 6).map(async (message) => {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();
        const headers = data.payload?.headers || [];
        const headerValue = (name) => headers.find((header) => header.name === name)?.value || '';
        return {
          id: message.id,
          subject: headerValue('Subject') || '(no subject)',
          from: headerValue('From'),
          date: headerValue('Date'),
          snippet: (data.snippet || '').slice(0, 120),
          labels: data.labelIds || [],
        };
      }),
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.json({ emails, total: messages.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleCalendar(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_REFRESH_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const token = await refreshGoogleAccessToken();
    const now = new Date();
    const offset = 2 * 60;
    const local = new Date(now.getTime() + offset * 60000);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    const day = local.getUTCDate();
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - offset * 60000).toISOString();
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59) - offset * 60000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=15`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { items = [] } = await response.json();
    const events = items.map((event) => ({
      id: event.id,
      title: event.summary || '(no title)',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      location: event.location || '',
      attendees: (event.attendees || []).length,
      color: event.colorId || null,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleNews(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.query.type || 'world';
  const url = FEEDS[type];
  if (!url) return res.status(400).json({ error: 'Invalid type', items: [] });

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Morning-Briefing/1.0)' },
    });
    const xml = await response.text();
    const items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message, items: [] });
  }
}

async function handleNotion(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { NOTION_TOKEN } = process.env;
  if (!NOTION_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const tasksRaw = await queryDatabase(NOTION_TOKEN, TASKS_DB_ID, {
      filter: {
        property: 'Status',
        status: { does_not_equal: 'Done' },
      },
      sorts: [
        { property: 'Status', direction: 'ascending' },
        { property: 'Due Date', direction: 'ascending' },
      ],
      page_size: 12,
    });

    if (tasksRaw.status === 401 || tasksRaw.code === 'unauthorized') {
      return res.status(401).json({ error: 'invalid_token', needsAuth: true });
    }

    const urgency = {
      "Need's to be done Now!!!": { label: 'NOW!', color: 'red' },
      "It's okay": { label: 'OK', color: 'yellow' },
      'Sooo much time': { label: 'calm', color: 'green' },
    };

    const statusColors = {
      'Review by Martin': 'red',
      'To Do': 'default',
      Finishing: 'orange',
      'In progress': 'blue',
      Waiting: 'purple',
    };

    const tasks = (tasksRaw.results || []).map((page) => ({
      id: page.id,
      url: page.url,
      title: getTitle(page),
      status: getStatus(page, 'Status'),
      statusColor: statusColors[getStatus(page, 'Status')] || 'default',
      urgency: urgency[getSelect(page, 'In hurry ?')] || null,
      dueDate: getDate(page, 'Due Date'),
      edited: page.last_edited_time,
    }));

    const projectsRaw = await queryDatabase(NOTION_TOKEN, PROJECTS_DB_ID, {
      sorts: [{ property: 'Phase', direction: 'ascending' }],
      page_size: 20,
    });

    const phaseColors = {
      Finishing: 'orange',
      Design: 'blue',
      Concept: 'purple',
      Potentional: 'gray',
      Completed: 'green',
    };

    const phaseIcons = {
      Finishing: '🔶',
      Design: '🎨',
      Concept: '💡',
      Potentional: '👀',
      Completed: '✅',
    };

    const projects = (projectsRaw.results || []).map((page) => {
      const phase = getStatus(page, 'Phase');
      const price = getNumber(page, 'Price');
      const monthly = getNumber(page, 'Monthly paid');
      return {
        id: page.id,
        url: page.url,
        title: getTitle(page),
        phase,
        phaseColor: phaseColors[phase] || 'default',
        phaseIcon: phaseIcons[phase] || '•',
        price: price != null ? `€${price}` : null,
        priceNum: price ?? 0,
        monthly: monthly != null ? `€${monthly}/mes` : null,
        monthlyNum: monthly ?? 0,
        link: getUrl(page, 'Link'),
        edited: page.last_edited_time,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.json({ tasks, projects });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleSleep(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const payload = await fetchSleepPayload();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.json(payload);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      needsAuth: error.needsAuth,
      hint: error.hint,
    });
  }
}

async function handleStrava(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const payload = await fetchStravaPayload();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.json(payload);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      needsAuth: error.needsAuth,
    });
  }
}

async function handleCoach(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ANTHROPIC_API_KEY } = process.env;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'missing_anthropic_key',
      reason: 'Set ANTHROPIC_API_KEY in Vercel env vars to enable the coach.',
    });
  }

  let plan = { targetKm: 10, days: 30 };
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (body.plan) plan = { ...plan, ...body.plan };
    } catch {}
  }

  const [stravaResult, sleepResult] = await Promise.allSettled([
    fetchStravaPayload(),
    fetchSleepPayload(),
  ]);

  const sleepCtx = sleepResult.status === 'fulfilled' && sleepResult.value?.lastNight
    ? {
        lastNightMin: sleepResult.value.lastNight.minutes,
        avgMin: sleepResult.value.avgMinutes,
        nights: sleepResult.value.nightCount,
      }
    : {
        error: sleepResult.status === 'rejected' ? sleepResult.reason.message : 'no_sleep_data',
      };

  const stravaCtx = stravaResult.status === 'fulfilled'
    ? {
        weekKm: ((stravaResult.value?.weekKmMeters || 0) / 1000).toFixed(2),
        weekRuns: stravaResult.value?.weekCount || 0,
        monthKm: ((stravaResult.value?.monthMeters || 0) / 1000).toFixed(2),
        monthRuns: stravaResult.value?.runCount || 0,
        longestKm: stravaResult.value?.longestKm || 0,
        lastRun: stravaResult.value?.lastRun
          ? {
              km: ((stravaResult.value.lastRun.distance || 0) / 1000).toFixed(2),
              daysAgo: stravaResult.value.lastRun.daysAgo,
              avgHr: stravaResult.value.lastRun.averageHr || null,
              pace: paceFmt(stravaResult.value.lastRun.averagePace),
            }
          : null,
        recent: (stravaResult.value?.recent || []).map((run) => ({
          date: run.date?.slice(0, 10),
          km: ((run.distance || 0) / 1000).toFixed(2),
          mins: Math.round((run.movingTime || 0) / 60),
          avgHr: run.averageHr,
          pace: paceFmt(run.averagePace),
        })),
      }
    : {
        error: stravaResult.reason?.message || 'no_strava_data',
      };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const systemPrompt = `You are a calm, evidence-based running coach. The athlete's goal: run ${plan.targetKm} km continuously within ~${plan.days || 30} days. Your job is to look at their recent runs and sleep, then prescribe TODAY only.

Hard rules (non-negotiable):
1. HEALTHY OVER FAST. If sleep < 6h last night -> recommend rest or 20-min easy walk. Never push through bad sleep.
2. Conservative progression. Weekly mileage increase <= 10%. No more than one hard session per week.
3. If the athlete ran yesterday at moderate-hard effort, today is easy or rest.
4. If they haven't run in 4+ days, restart with an easy 2-3 km, not a long run.
5. Heart rate context if available: easy = zone 1-2 (<= ~145 bpm for most adults); ignore if no HR data.
6. Encourage walk-run intervals if longest run is < 5 km.
7. Be specific: state distance OR time, target effort, and one cue (form, pace, hydration, etc).
8. Keep the note <= 90 words. No bullet lists. Plain conversational paragraph.

Return ONLY a JSON object: {"title": "<3-6 word headline>", "note": "<body paragraph>"}. No markdown, no fences, no preamble.`;

  const userPrompt = `Date: ${today}
Goal: run ${plan.targetKm} km in ~${plan.days || 30} days.
Sleep: ${JSON.stringify(sleepCtx)}
Strava (last 30d, runs only): ${JSON.stringify(stravaCtx)}

Prescribe today.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: 'anthropic_error', reason: data.error.message });
    }

    const raw = data.content?.[0]?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(stripped);
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      title: parsed.title || "Today's plan",
      note: parsed.note || '—',
      usage: data.usage || null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'coach_failed', reason: error.message });
  }
}

async function handleConfig(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  });
}

async function handleVercelProjects(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { VERCEL_TOKEN, VERCEL_TEAM_ID } = process.env;
  if (!VERCEL_TOKEN) {
    return res.status(401).json({ error: 'not_connected', needsAuth: true });
  }

  try {
    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}&limit=10` : '?limit=10';
    const response = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    const data = await response.json();
    if (data.error) {
      return res.status(401).json({ error: data.error.message, needsAuth: true });
    }

    const projects = (data.projects || []).map((project) => {
      const deployment = project.latestDeployments?.[0] || null;
      return {
        id: project.id,
        name: project.name,
        url: deployment ? `https://${deployment.url}` : null,
        state: deployment?.readyState || 'UNKNOWN',
        target: deployment?.target || null,
        age: deployment?.createdAt || null,
        framework: project.framework || 'static',
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.json({ projects });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function handleGoogleAuthStart(req, res) {
  const { GOOGLE_CLIENT_ID, BASE_URL } = process.env;
  const redirectUri = `${BASE_URL}/api/auth/google`;
  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function handleGoogleAuthCallback(req, res) {
  const { code, error } = req.query;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL } = process.env;
  const redirectUri = `${BASE_URL}/api/auth/google`;

  if (error) {
    return res.send(googleAuthHtml('Error', '#ff6584', `<h2>❌ Auth Error</h2><p>${error}</p>`));
  }
  if (!code) {
    return res.status(400).send(googleAuthHtml('Error', '#ff6584', '<h2>❌ No code provided</h2>'));
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await tokenResponse.json();

  if (data.refresh_token) {
    return res.send(googleAuthHtml('✅ Google Connected', '#43d9ad', `
      <h2>✅ Google Connected!</h2>
      <p>Copy the refresh token below and add it to your
        <a href="https://vercel.com/darksimperium/morning-briefing/settings/environment-variables" target="_blank">Vercel environment variables</a>.
      </p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">GOOGLE_REFRESH_TOKEN</code><br><br>
        <b>Value (copy everything):</b>
        <code id="tok">${data.refresh_token}</code>
        <button onclick="navigator.clipboard.writeText('${data.refresh_token}')" style="margin-top:8px;padding:6px 14px;background:#6c63ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Copy token</button>
      </div>
      <div class="step">
        <p>1. Add <b>GOOGLE_REFRESH_TOKEN</b> to Vercel -> Redeploy</p>
        <p>2. <a href="/">Go to your dashboard</a></p>
      </div>
    `));
  }

  return res.send(googleAuthHtml('Error', '#ff6584', `
    <h2>❌ Could not get refresh token</h2>
    <p>${data.error_description || data.error || 'Unknown error'}</p>
    <code>${JSON.stringify(data, null, 2)}</code>
    <p>Common causes:</p>
    <p>• Wrong <b>GOOGLE_CLIENT_SECRET</b> in Vercel env vars</p>
    <p>• <b>BASE_URL</b> redirect URI not added in Google Cloud Console</p>
    <p>• OAuth consent screen not published</p>
  `));
}

function handleSpotifyAuthStart(req, res) {
  const { SPOTIFY_CLIENT_ID, BASE_URL } = process.env;
  const redirectUri = `${BASE_URL}/api/auth/spotify`;
  const scope = [
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-read-playback-state',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}

async function handleSpotifyAuthCallback(req, res) {
  const { code, error } = req.query;
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, BASE_URL } = process.env;
  const redirectUri = `${BASE_URL}/api/auth/spotify`;

  if (error || !code) {
    return res.send(spotifyAuthHtml('Error', '#ff6584', `<h2>❌ Spotify auth error</h2><p>${error || 'No code received'}</p>`));
  }

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  const data = await tokenResponse.json();

  if (data.refresh_token) {
    return res.send(spotifyAuthHtml('✅ Spotify Connected', '#1db954', `
      <h2>✅ Spotify Connected!</h2>
      <p>Add this to your <a href="https://vercel.com/darksimperium/morning-briefing/settings/environment-variables" target="_blank">Vercel environment variables</a>:</p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">SPOTIFY_REFRESH_TOKEN</code><br><br>
        <b>Value (copy everything):</b>
        <code>${data.refresh_token}</code>
        <button onclick="navigator.clipboard.writeText('${data.refresh_token}')" style="margin-top:8px;padding:6px 14px;background:#1db954;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Copy token</button>
      </div>
      <div class="step">
        <p>1. Add <b>SPOTIFY_REFRESH_TOKEN</b> to Vercel -> Redeploy</p>
        <p>2. <a href="/">Go to your dashboard</a></p>
      </div>
    `));
  }

  return res.send(spotifyAuthHtml('Error', '#ff6584', `
    <h2>❌ Could not get Spotify token</h2>
    <p>${data.error_description || data.error || 'Unknown error'}</p>
    <code>${JSON.stringify(data, null, 2)}</code>
    <p>Common causes:</p>
    <p>• Wrong <b>SPOTIFY_CLIENT_SECRET</b> in Vercel env vars</p>
    <p>• Redirect URI not added in Spotify Dashboard</p>
  `));
}

function handleStravaAuthStart(req, res) {
  const { STRAVA_CLIENT_ID, BASE_URL } = process.env;
  if (!STRAVA_CLIENT_ID || !BASE_URL) {
    return res.status(500).send('Missing STRAVA_CLIENT_ID or BASE_URL env var');
  }

  const redirectUri = `${BASE_URL}/api/auth/strava`;
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'force',
    scope: 'read,activity:read_all,profile:read_all',
  });

  return res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}

async function handleStravaAuthCallback(req, res) {
  const { code, error } = req.query;
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

  if (error || !code) {
    return res.send(stravaAuthHtml('Error', '#FF6B6B', `<h2>❌ Strava auth error</h2><p>${error || 'No code received'}</p>`));
  }
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.send(stravaAuthHtml('Error', '#FF6B6B', '<h2>❌ Missing env vars</h2><p>Set <b>STRAVA_CLIENT_ID</b> and <b>STRAVA_CLIENT_SECRET</b> in Vercel.</p>'));
  }

  const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const data = await tokenResponse.json();

  if (data.refresh_token) {
    return res.send(stravaAuthHtml('✅ Strava Connected', '#FC4C02', `
      <h2>✅ Strava Connected!</h2>
      <p>Add this value to your Vercel environment variables:</p>
      <div class="step">
        <b>Variable name:</b> <code style="display:inline;padding:2px 8px">STRAVA_REFRESH_TOKEN</code><br><br>
        <b>Value (copy everything):</b>
        <code>${data.refresh_token}</code>
        <button onclick="navigator.clipboard.writeText('${data.refresh_token}')">Copy token</button>
      </div>
      <div class="step">
        <p>1. Paste <b>STRAVA_REFRESH_TOKEN</b> into Vercel -> Redeploy</p>
        <p>2. <a href="/">Back to dashboard</a></p>
      </div>
    `));
  }

  return res.send(stravaAuthHtml('Error', '#FF6B6B', `
    <h2>❌ Could not get Strava token</h2>
    <p>${data.message || data.error || 'Unknown error'}</p>
    <code>${JSON.stringify(data, null, 2)}</code>
    <p>Common causes:</p>
    <p>• Wrong <b>STRAVA_CLIENT_SECRET</b> in Vercel env vars</p>
    <p>• Callback URL doesn't match the app's Authorization Callback Domain</p>
  `));
}

const topLevelHandlers = {
  calendar: handleCalendar,
  coach: handleCoach,
  config: handleConfig,
  gmail: handleGmail,
  news: handleNews,
  notion: handleNotion,
  sleep: handleSleep,
  spotify: handleSpotify,
  strava: handleStrava,
  'vercel-projects': handleVercelProjects,
  weather: handleWeather,
};

const authHandlers = {
  google: handleGoogleAuthCallback,
  'google-redirect': handleGoogleAuthStart,
  spotify: handleSpotifyAuthCallback,
  'spotify-redirect': handleSpotifyAuthStart,
  strava: handleStravaAuthCallback,
  'strava-redirect': handleStravaAuthStart,
};

export default async function handler(req, res) {
  const segments = getRouteSegments(req);

  if (segments.length === 1) {
    const routeHandler = topLevelHandlers[segments[0]];
    if (routeHandler) return routeHandler(req, res);
  }

  if (segments.length === 2 && segments[0] === 'auth') {
    const authHandler = authHandlers[segments[1]];
    if (authHandler) return authHandler(req, res);
  }

  return res.status(404).json({ error: 'not_found' });
}