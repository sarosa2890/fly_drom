// Diagnostic: tests each upstream independently so we can see what fails on Vercel.
module.exports = async (req, res) => {
  const out = {
    hasCreds: !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET),
    node: process.version
  };
  const test = async (name, fn) => {
    try { out[name] = await fn(); }
    catch (e) { out[name] = { error: String(e.message || e), cause: String((e.cause && (e.cause.message || e.cause.code)) || e.cause || '') }; }
  };
  await test('adsbdb', async () => ({ status: (await fetch('https://api.adsbdb.com/v0/callsign/SU2173')).status }));
  if (out.hasCreds) await test('opensky_token', async () => {
    const r = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.OPENSKY_CLIENT_ID, client_secret: process.env.OPENSKY_CLIENT_SECRET })
    });
    return { status: r.status };
  });
  await test('opensky_states', async () => ({ status: (await fetch('https://opensky-network.org/api/states/all?lamin=50&lomin=30&lamax=51&lomax=31')).status }));
  res.status(200).json(out);
};
