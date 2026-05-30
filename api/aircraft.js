const { adsbdb } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const id = (req.query.icao24 || '').trim();
    if (!id) return res.status(400).json({ error: 'icao24 required' });
    const j = await adsbdb('aircraft/' + encodeURIComponent(id));
    res.status(200).json(j || { response: null });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
