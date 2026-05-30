const { statesAll } = require('./_lib');
module.exports = async (req, res) => {
  try {
    let list = await statesAll();
    const f = ['lamin', 'lomin', 'lamax', 'lomax'].map(k => parseFloat(req.query[k]));
    if (f.every(Number.isFinite)) {
      const [lamin, lomin, lamax, lomax] = f;
      list = list.filter(s => s.latitude >= lamin && s.latitude <= lamax && s.longitude >= lomin && s.longitude <= lomax);
    }
    res.status(200).json({ count: list.length, states: list });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
