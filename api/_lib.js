// Data layer. Live positions: adsb.lol (reachable from cloud). Routes/aircraft: adsbdb.
// (OpenSky was dropped: it firewalls datacenter IPs, so Vercel can't reach it.)
const cache = new Map();
const getC = (k) => { const e = cache.get(k); return e && e.exp > Date.now() ? e.val : null; };
const setC = (k, v, ttl) => cache.set(k, { val: v, exp: Date.now() + ttl });

// Map an adsb.lol aircraft to the shape the frontend expects.
const FT_M = 0.3048, KT_MS = 0.514444;
function mapAc(a) {
  const ground = a.alt_baro === 'ground';
  return {
    icao24: a.hex,
    callsign: (a.flight || '').trim(),
    origin_country: '',
    longitude: a.lon, latitude: a.lat,
    baro_altitude: ground ? 0 : (typeof a.alt_baro === 'number' ? a.alt_baro * FT_M : null),
    on_ground: ground,
    velocity: a.gs != null ? a.gs * KT_MS : null,
    true_track: a.track ?? a.true_heading ?? a.mag_heading ?? 0,
    vertical_rate: a.baro_rate != null ? a.baro_rate * FT_M / 60 : null
  };
}

async function adsbGet(p) {
  const r = await fetch('https://api.adsb.lol/v2/' + p, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('adsb.lol HTTP ' + r.status);
  const j = await r.json();
  return (j.ac || []).filter(a => a.lat != null && a.lon != null).map(mapAc);
}

// Live states within a bounding box (queried as a point+radius, then clipped to the box).
async function statesBbox(b) {
  const key = `s:${b.lamin.toFixed(1)},${b.lomin.toFixed(1)},${b.lamax.toFixed(1)},${b.lomax.toFixed(1)}`;
  const c = getC(key);
  if (c) return c;
  const lat = (b.lamin + b.lamax) / 2, lon = (b.lomin + b.lomax) / 2;
  const latNm = (b.lamax - b.lamin) * 60, lonNm = (b.lomax - b.lomin) * 60 * Math.cos(lat * Math.PI / 180);
  const dist = Math.min(Math.max(Math.ceil(Math.sqrt(latNm * latNm + lonNm * lonNm) / 2), 25), 1000);
  let list = await adsbGet(`lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`);
  list = list.filter(s => s.latitude >= b.lamin && s.latitude <= b.lamax && s.longitude >= b.lomin && s.longitude <= b.lomax);
  setC(key, list, 8000);
  return list;
}

// Find a live aircraft by ICAO/IATA callsign.
async function findCallsign(cs) {
  const list = await adsbGet('callsign/' + encodeURIComponent(cs));
  return list[0] || null;
}

async function adsbdb(p) {
  const key = 'adsbdb:' + p;
  const c = getC(key);
  if (c) return c;
  const r = await fetch('https://api.adsbdb.com/v0/' + p);
  const j = r.ok ? await r.json() : null;
  setC(key, j, 6 * 3600 * 1000);
  return j;
}

module.exports = { statesBbox, findCallsign, adsbdb };
