export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=48.1486&longitude=17.1077' +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
      '&timezone=Europe%2FBratislava&forecast_days=4';
    const r = await fetch(url);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
