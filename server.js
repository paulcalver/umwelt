// If you are on Node 18 or newer, fetch exists already.
// If you get "fetch is not defined", install node-fetch:
//   npm install node-fetch
// and then uncomment the next line:
//
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));



// server.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');

const app = express();

// adjust filenames if yours differ
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
};

// store latest motion sample in memory
let latestMotion = null;

// -------- weather forecast config --------
const LAT = 51.5074;    // London latitude
const LON = -0.1278;    // London longitude

let forecastCache = null;
let forecastFetchedAt = 0;
const FORECAST_TTL_MS = 60 * 60 * 1000; // refresh at most once per hour

// -------- fetch weather forecast --------

function buildForecastUrl() {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: LAT,
    longitude: LON,
    hourly: [
      'temperature_2m',              // still useful if you want it
      'precipitation_probability',   // rain chance
      'rain',                        // rain amount
      'cloudcover',                  // total cloud cover
      'windspeed_10m',               // wind speed
      'winddirection_10m',           // NEW: wind direction 10m
      'windgusts_10m',               // NEW: gusts 10m
      'shortwave_radiation',         // NEW: solar radiation
      'visibility',                  // NEW: visibility
      'dewpoint_2m',                 // NEW: dew point
      'relativehumidity_2m',         // you can keep/remove as you like
      'surface_pressure'             // same here
    ].join(','),
    forecast_days: '3',
    timezone: 'auto'
  });
  return `${base}?${params.toString()}`;
}

async function getForecast() {
  const now = Date.now();
  if (forecastCache && now - forecastFetchedAt < FORECAST_TTL_MS) {
    return forecastCache;
  }

  const url = buildForecastUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Forecast error: ${res.status}`);
  }
  const data = await res.json();
  forecastCache = data;
  forecastFetchedAt = now;
  return data;
}

// find indices i0, i1 such that time[i0] <= target < time[i1]
function findBracketingHours(timeArray, targetDate) {
  let i0 = -1;
  let i1 = -1;
  for (let i = 0; i < timeArray.length - 1; i++) {
    const t0 = new Date(timeArray[i]);
    const t1 = new Date(timeArray[i + 1]);
    if (t0 <= targetDate && targetDate < t1) {
      i0 = i;
      i1 = i + 1;
      break;
    }
  }
  return { i0, i1 };
}


// body parser for JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PHONE → send motion
app.post('/motion', (req, res) => {
  latestMotion = {
    x: req.body.x || 0,
    y: req.body.y || 0,
    z: req.body.z || 0,
    t: Date.now(),
  };
  // console.log('[SERVER] motion update', latestMotion);
  res.json({ ok: true });
});

// LAPTOP → ask for latest motion
app.get('/motion', (req, res) => {
  if (!latestMotion) {
    return res.json({ x: 0, y: 0, z: 0, t: null });
  }
  res.json(latestMotion);
});

// -------- +24 hour interpolated weather endpoint --------
app.get('/weather24', async (req, res) => {
  try {
    const forecast = await getForecast();
    const hourly = forecast.hourly;

    const times = hourly.time;
    const now = new Date();
    const target = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    const { i0, i1 } = findBracketingHours(times, target);
    if (i0 === -1 || i1 === -1) {
      return res.status(500).json({ error: 'No forecast window around +24h' });
    }

    const t0 = new Date(times[i0]);
    const t1 = new Date(times[i1]);
    const alpha = (target - t0) / (t1 - t0); // 0..1

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    const temp0 = hourly.temperature_2m[i0];
    const temp1 = hourly.temperature_2m[i1];

    const cloud0 = hourly.cloudcover[i0];
    const cloud1 = hourly.cloudcover[i1];

    const rainProb0 = hourly.precipitation_probability[i0];
    const rainProb1 = hourly.precipitation_probability[i1];

    const rain0 = hourly.rain[i0];
    const rain1 = hourly.rain[i1];

    const wind0 = hourly.windspeed_10m[i0];
    const wind1 = hourly.windspeed_10m[i1];

    const hum0 = hourly.relativehumidity_2m[i0];
    const hum1 = hourly.relativehumidity_2m[i1];

    const pres0 = hourly.surface_pressure[i0];
    const pres1 = hourly.surface_pressure[i1];

    const windDir0 = hourly.winddirection_10m[i0];
    const windDir1 = hourly.winddirection_10m[i1];

    const windGust0 = hourly.windgusts_10m[i0];
    const windGust1 = hourly.windgusts_10m[i1];

    const rad0 = hourly.shortwave_radiation[i0];
    const rad1 = hourly.shortwave_radiation[i1];

    const vis0 = hourly.visibility[i0];
    const vis1 = hourly.visibility[i1];

    const dew0 = hourly.dewpoint_2m[i0];
    const dew1 = hourly.dewpoint_2m[i1];

    const payload = {
      now: now.toISOString(),
      target_time: target.toISOString(),
      from_time: t0.toISOString(),
      to_time: t1.toISOString(),
      alpha,

      temperature_24h: lerp(temp0, temp1, alpha),
      cloudcover_24h: lerp(cloud0, cloud1, alpha),
      precip_prob_24h: lerp(rainProb0, rainProb1, alpha),
      rain_24h: lerp(rain0, rain1, alpha),
      windspeed_24h: lerp(wind0, wind1, alpha),

      humidity_24h: lerp(hum0, hum1, alpha),
      pressure_24h: lerp(pres0, pres1, alpha),

      shortwave_24h: lerp(rad0, rad1, alpha),
      visibility_24h: lerp(vis0, vis1, alpha),
      dewpoint_24h: lerp(dew0, dew1, alpha),
      winddir_24h: lerp(windDir0, windDir1, alpha),
      windgusts_24h: lerp(windGust0, windGust1, alpha)
    };

    res.json(payload);
  } catch (err) {
    console.error('weather24 error', err);
    res.status(500).json({ error: 'weather24 error' });
  }
});



const server = https.createServer(options, app);
const PORT = 8080;

server.listen(PORT, () => {
  console.log(`[SERVER] HTTPS on https://192.168.4.188:${PORT}`);
});