// Shared data layer: OpenSky (live positions) + adsbdb (routes/aircraft).
// Used by both the local server (server.js) and the Vercel functions (api/*.js).
const OS_ID = process.env.OPENSKY_CLIENT_ID;
const OS_SECRET = process.env.OPENSKY_CLIENT_SECRET;

const cache = new Map();
const getC = (k) => { const e = cache.get(k); return e && e.exp > Date.now() ? e.val : null; };
const setC = (k, v, ttl) => cache.set(k, { val: v, exp: Date.now() + ttl });

let token = { val: null, exp: 0 };
async function opensky(url) {
  const headers = {};
  if (OS_ID && OS_SECRET) {
    if (token.exp < Date.now()) {
      const r = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: OS_ID, client_secret: OS_SECRET })
      });
      const j = await r.json();
      token = { val: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
    }
    headers.Authorization = 'Bearer ' + token.val;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('OpenSky HTTP ' + res.status);
  return res.json();
}

const COLS = ['icao24','callsign','origin_country','time_position','last_contact','longitude','latitude','baro_altitude','on_ground','velocity','true_track','vertical_rate','sensors','geo_altitude','squawk','spi','position_source'];
const toObj = (s) => { const o = {}; COLS.forEach((c, i) => o[c] = s[i]); o.callsign = (o.callsign || '').trim(); return o; };

async function statesAll() {
  const c = getC('states:all');
  if (c) return c;
  const j = await opensky('https://opensky-network.org/api/states/all');
  const list = (j.states || []).map(toObj).filter(s => s.longitude != null && s.latitude != null);
  setC('states:all', list, 12000);
  return list;
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

module.exports = { statesAll, adsbdb };
