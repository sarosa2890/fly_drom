const { statesBbox } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const b = ['lamin', 'lomin', 'lamax', 'lomax'].reduce((o, k) => (o[k] = parseFloat(req.query[k]), o), {});
    if (!Object.values(b).every(Number.isFinite)) return res.status(400).json({ error: 'bbox required' });
    const list = await statesBbox(b);
    res.status(200).json({ count: list.length, states: list });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
