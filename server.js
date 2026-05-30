// Local dev server (Vercel uses the functions in /api instead).
// Serves ./public and proxies the same endpoints via the shared data layer.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { statesBbox, findCallsign, adsbdb } = require('./api/_lib');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const send = (res, code, data, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const q = u.searchParams;
  try {
    if (u.pathname === '/api/states') {
      const b = ['lamin', 'lomin', 'lamax', 'lomax'].reduce((o, k) => (o[k] = parseFloat(q.get(k)), o), {});
      if (!Object.values(b).every(Number.isFinite)) return send(res, 400, { error: 'bbox required' });
      const list = await statesBbox(b);
      return send(res, 200, { count: list.length, states: list });
    }
    if (u.pathname === '/api/route') {
      const cs = (q.get('flight') || '').trim();
      if (!cs) return send(res, 400, { error: 'flight required' });
      return send(res, 200, (await adsbdb('callsign/' + encodeURIComponent(cs))) || { response: null });
    }
    if (u.pathname === '/api/aircraft') {
      const id = (q.get('icao24') || '').trim();
      if (!id) return send(res, 400, { error: 'icao24 required' });
      return send(res, 200, (await adsbdb('aircraft/' + encodeURIComponent(id))) || { response: null });
    }
    if (u.pathname === '/api/find') {
      const cs = (q.get('flight') || '').trim();
      if (!cs) return send(res, 400, { error: 'flight required' });
      const route = await adsbdb('callsign/' + encodeURIComponent(cs));
      const fr = route && route.response && route.response.flightroute;
      const icao = fr ? fr.callsign_icao : cs.toUpperCase();
      let state = await findCallsign(icao);
      if (!state && fr && fr.callsign_iata) state = await findCallsign(fr.callsign_iata);
      let aircraft = null;
      if (state) { const a = await adsbdb('aircraft/' + state.icao24); aircraft = a && a.response ? a.response.aircraft : null; }
      return send(res, 200, { flightroute: fr || null, state, aircraft });
    }
    // static files
    const p = u.pathname === '/' ? '/index.html' : u.pathname;
    const file = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (file.startsWith(PUBLIC) && fs.existsSync(file)) {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      return send(res, 200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log('Flight monitor running: http://localhost:' + PORT));
