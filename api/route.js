const { adsbdb } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const cs = (req.query.flight || '').trim();
    if (!cs) return res.status(400).json({ error: 'flight required' });
    const j = await adsbdb('callsign/' + encodeURIComponent(cs));
    res.status(200).json(j || { response: null });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
