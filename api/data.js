// Vercel serverless function.
// Verwacht env vars: GH_PAT, GH_GIST_ID, DASHBOARD_PASSWORD
// Verwacht header 'x-dashboard-password' vanuit de client.

const { readGistData } = require('../lib/gist-read');

module.exports = async (req, res) => {
  const password = req.headers['x-dashboard-password'];

  if (!process.env.DASHBOARD_PASSWORD) {
    res.status(500).json({ error: 'DASHBOARD_PASSWORD is niet ingesteld op de server' });
    return;
  }
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    res.status(401).json({ error: 'Ongeldig wachtwoord' });
    return;
  }

  const gistId = process.env.GH_GIST_ID;
  const pat = process.env.GH_PAT;
  if (!gistId || !pat) {
    res.status(500).json({ error: 'GH_GIST_ID / GH_PAT ontbreken op de server' });
    return;
  }

  try {
    const { orders, meta } = await readGistData(gistId, pat);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ orders, meta });
  } catch (err) {
    res.status(502).json({ error: 'Kon data niet ophalen: ' + err.message });
  }
};
