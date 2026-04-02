const https = require('https');

// Default to Anderson, SC; override with query param lat/lon if needed
const DEFAULT_LAT = 34.5034;
const DEFAULT_LON = -82.6501;

// ─── Mock Weather Data (Anderson, SC Spring) ─────────────────────────────────

const MOCK_FORECAST = [
  { date: '2026-03-28', weatherCode: 2,  tempMax: 76, tempMin: 58, precipitation: 0.0, windSpeed: 8,  condition: 'Partly Cloudy', icon: '⛅' },
  { date: '2026-03-29', weatherCode: 1,  tempMax: 78, tempMin: 60, precipitation: 0.0, windSpeed: 6,  condition: 'Mostly Clear', icon: '🌤️' },
  { date: '2026-03-30', weatherCode: 3,  tempMax: 72, tempMin: 57, precipitation: 0.2, windSpeed: 10, condition: 'Overcast',      icon: '☁️' },
  { date: '2026-03-31', weatherCode: 2,  tempMax: 74, tempMin: 56, precipitation: 0.0, windSpeed: 7,  condition: 'Partly Cloudy', icon: '⛅' },
  { date: '2026-04-01', weatherCode: 0,  tempMax: 82, tempMin: 61, precipitation: 0.0, windSpeed: 5,  condition: 'Clear',        icon: '☀️' },
  { date: '2026-04-02', weatherCode: 61, tempMax: 68, tempMin: 55, precipitation: 3.1, windSpeed: 12, condition: 'Light Rain',    icon: '🌧️' },
  { date: '2026-04-03', weatherCode: 2,  tempMax: 73, tempMin: 54, precipitation: 0.0, windSpeed: 8,  condition: 'Partly Cloudy', icon: '⛅' },
];

function fetch7DayForecast(lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  const DATA_MODE = process.env.DATA_MODE || 'live';
  if (DATA_MODE === 'mock') {
    return Promise.resolve(MOCK_FORECAST);
  }
  return new Promise((resolve, reject) => {
    // Open-Meteo: temperature_unit=fahrenheit, timezone=America/New_York (Anderson, SC)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=7`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const days = json.daily;
          const forecast = days.time.map((date, i) => ({
            date,
            weatherCode: days.weather_code[i],
            tempMax: days.temperature_2m_max[i],
            tempMin: days.temperature_2m_min[i],
            precipitation: days.precipitation_sum[i],
            windSpeed: days.wind_speed_10m_max[i],
            condition: wmoCodeToCondition(days.weather_code[i]),
            icon: wmoCodeToIcon(days.weather_code[i]),
          }));
          resolve(forecast);
        } catch (e) {
          reject(new Error('Failed to parse weather response'));
        }
      });
    }).on('error', reject);
  });
}

function wmoCodeToCondition(code) {
  const map = {
    0: 'Clear',
    1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Icy Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
    80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Severe Thunderstorm',
  };
  return map[code] || 'Unknown';
}

function wmoCodeToIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 55) return '🌧️';
  if (code >= 61 && code <= 65) return '🌧️';
  if (code >= 71 && code <= 75) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

module.exports = { fetch7DayForecast };
