const { findCallsign, adsbdb } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const cs = (req.query.flight || '').trim();
    if (!cs) return res.status(400).json({ error: 'flight required' });
    const route = await adsbdb('callsign/' + encodeURIComponent(cs));
    const fr = route && route.response && route.response.flightroute;
    const icao = fr ? fr.callsign_icao : cs.toUpperCase();
    let state = await findCallsign(icao);
    if (!state && fr && fr.callsign_iata) state = await findCallsign(fr.callsign_iata);
    let aircraft = null;
    if (state) { const a = await adsbdb('aircraft/' + state.icao24); aircraft = a && a.response ? a.response.aircraft : null; }
    res.status(200).json({ flightroute: fr || null, state, aircraft });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
