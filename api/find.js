const { statesAll, adsbdb } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const cs = (req.query.flight || '').trim();
    if (!cs) return res.status(400).json({ error: 'flight required' });
    const route = await adsbdb('callsign/' + encodeURIComponent(cs));
    const fr = route && route.response && route.response.flightroute;
    const icao = fr ? fr.callsign_icao : cs.toUpperCase();
    const iata = fr ? fr.callsign_iata : '';
    const list = await statesAll();
    const state = list.find(s => s.callsign === icao || s.callsign === iata || s.callsign === cs.toUpperCase()) || null;
    let aircraft = null;
    if (state) { const a = await adsbdb('aircraft/' + state.icao24); aircraft = a && a.response ? a.response.aircraft : null; }
    res.status(200).json({ flightroute: fr || null, state, aircraft });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
