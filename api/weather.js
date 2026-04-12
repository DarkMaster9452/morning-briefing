// Rajec, Slovakia — lat 49.0943, lon 18.6297
const LAT = 49.0943, LON = 18.6297;

const OW_ICONS = {
  200:'⛈️',201:'⛈️',202:'⛈️',210:'🌩️',211:'🌩️',212:'🌩️',221:'🌩️',230:'⛈️',231:'⛈️',232:'⛈️',
  300:'🌦️',301:'🌦️',302:'🌧️',310:'🌦️',311:'🌧️',312:'🌧️',313:'🌦️',314:'🌧️',321:'🌦️',
  500:'🌧️',501:'🌧️',502:'🌧️',503:'🌧️',504:'🌧️',511:'🌨️',520:'🌦️',521:'🌦️',522:'🌧️',531:'🌦️',
  600:'❄️',601:'❄️',602:'❄️',611:'🌨️',612:'🌨️',613:'🌨️',615:'🌨️',616:'🌨️',620:'❄️',621:'❄️',622:'❄️',
  701:'🌫️',711:'🌫️',721:'🌫️',731:'🌪️',741:'🌫️',751:'🌪️',761:'🌪️',762:'🌋',771:'💨',781:'🌪️',
  800:'☀️',801:'🌤️',802:'⛅',803:'🌥️',804:'☁️',
};
function owIcon(id) { return OW_ICONS[id] || '🌡️'; }

const DAYS_SK = ['Ne','Po','Ut','St','Št','Pi','So'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.OPENWEATHER_API_KEY;

  // ── OpenWeather (primary) ─────────────────────────────────────────────────
  if (key) {
    try {
      const base = `https://api.openweathermap.org/data/2.5`;
      const [curRes, fcRes] = await Promise.all([
        fetch(`${base}/weather?lat=${LAT}&lon=${LON}&units=metric&lang=sk&appid=${key}`),
        fetch(`${base}/forecast?lat=${LAT}&lon=${LON}&units=metric&cnt=40&appid=${key}`),
      ]);
      const cur = await curRes.json();
      const fc  = await fcRes.json();
      if (cur.cod !== 200) throw new Error(cur.message || 'OpenWeather error');

      // Hourly — next 8 buckets (= 24 h, 3 h steps)
      const hourly = (fc.list || []).slice(0, 8).map(item => ({
        time: item.dt_txt.slice(11, 16),
        icon: owIcon(item.weather[0].id),
        temp: Math.round(item.main.temp),
        pop:  Math.round((item.pop || 0) * 100), // precipitation probability %
      }));

      // 3-day daily forecast
      const today = new Date().toISOString().slice(0, 10);
      const days = {};
      (fc.list || []).forEach(item => {
        const day = item.dt_txt.slice(0, 10);
        if (day === today) return;
        if (!days[day]) days[day] = { temps: [], ids: [] };
        days[day].temps.push(item.main.temp_min, item.main.temp_max);
        days[day].ids.push(item.weather[0].id);
      });
      const forecast = Object.entries(days).slice(0, 3).map(([date, { temps, ids }]) => {
        const dt = new Date(date + 'T12:00:00');
        return {
          name: DAYS_SK[dt.getDay()],
          icon: owIcon(ids[Math.floor(ids.length / 2)]),
          hi: Math.round(Math.max(...temps)),
          lo: Math.round(Math.min(...temps)),
        };
      });

      res.setHeader('Cache-Control', 's-maxage=600,stale-while-revalidate');
      return res.json({
        _source: 'openweather',
        temp:       Math.round(cur.main.temp),
        feels_like: Math.round(cur.main.feels_like),
        humidity:   cur.main.humidity,
        wind:       Math.round(cur.wind.speed * 3.6),
        icon:       owIcon(cur.weather[0].id),
        desc:       cur.weather[0].description,
        hourly,
        forecast,
      });
    } catch (e) {
      console.error('OpenWeather failed:', e.message);
      // fall through to Open-Meteo
    }
  }

  // ── Open-Meteo fallback (always free, no key needed) ─────────────────────
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=Europe%2FBratislava&forecast_days=3`;
    const data = await fetch(url).then(r => r.json());

    const WC = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌦️',
      61:'🌧️',63:'🌧️',65:'🌧️',71:'❄️',73:'❄️',75:'❄️',80:'🌦️',81:'🌦️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
    const WD = {0:'Jasno',1:'Prevaž. jasno',2:'Čiastočne oblačno',3:'Zamračené',45:'Hmla',
      51:'Slabé mrholenie',61:'Slabý dážď',63:'Dážď',65:'Silný dážď',
      71:'Slabý sneh',73:'Sneh',75:'Silný sneh',80:'Lejak',95:'Búrka'};

    const c = data.current;

    // Find current hour index
    const nowH = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    const hTimes = data.hourly.time || [];
    let startIdx = hTimes.findIndex(t => t.startsWith(nowH));
    if (startIdx < 0) startIdx = 0;

    const hourly = hTimes.slice(startIdx + 1, startIdx + 9).map((t, i) => {
      const idx = startIdx + 1 + i;
      return {
        time: t.slice(11, 16),
        icon: WC[data.hourly.weather_code[idx]] || '🌡️',
        temp: Math.round(data.hourly.temperature_2m[idx]),
        pop:  data.hourly.precipitation_probability?.[idx] ?? 0,
      };
    });

    const forecast = data.daily.time.slice(1, 4).map((t, i) => {
      const dt = new Date(t + 'T12:00:00');
      return {
        name: DAYS_SK[dt.getDay()],
        icon: WC[data.daily.weather_code[i + 1]] || '🌡️',
        hi: Math.round(data.daily.temperature_2m_max[i + 1]),
        lo: Math.round(data.daily.temperature_2m_min[i + 1]),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=600,stale-while-revalidate');
    return res.json({
      _source:    'open-meteo',
      temp:       Math.round(c.temperature_2m),
      feels_like: Math.round(c.apparent_temperature),
      humidity:   c.relative_humidity_2m,
      wind:       Math.round(c.wind_speed_10m),
      icon:       WC[c.weather_code] || '🌡️',
      desc:       WD[c.weather_code] || '',
      hourly,
      forecast,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
