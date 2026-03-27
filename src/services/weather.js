const https = require('https');

// Default to Berlin; override with query param lat/lon if needed
const DEFAULT_LAT = 52.52;
const DEFAULT_LON = 13.405;

function fetch7DayForecast(lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  return new Promise((resolve, reject) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBerlin&forecast_days=7`;

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
