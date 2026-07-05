require('dotenv').config();
const { fetchDelta } = require('../lib/riege-client');
const { normalizeOrder } = require('../lib/normalize');
const { readGist, writeGist } = require('../lib/gist-store');

async function run() {
  const gistId = requireEnv('GH_GIST_ID');
  const { orders, meta } = await readGist(gistId);

  const since = meta.lastModifiedSeen || meta.lastSync;
  if (!since) {
    console.error('Geen lastSync/lastModifiedSeen gevonden in de gist.');
    console.error('Draai eerst npm run bulk-fetch om de baseline te zetten.');
    process.exit(1);
  }

  console.log(`Delta ophalen sinds ${since}...`);
  const changed = await fetchDelta(since);
  console.log(`${changed.length} gewijzigde/nieuwe orders ontvangen.`);

  let newest = meta.lastModifiedSeen;
  for (const raw of changed) {
    const n = normalizeOrder(raw);
    orders[n.identifier] = n; // upsert op identifier
    if (!newest || (n.lastModified && n.lastModified > newest)) {
      newest = n.lastModified;
    }
  }

  const newMeta = {
    lastSync: new Date().toISOString(),
    lastModifiedSeen: newest,
    totalOrders: Object.keys(orders).length,
    lastDeltaCount: changed.length,
  };

  await writeGist(gistId, orders, newMeta);
  console.log(`Klaar. ${newMeta.totalOrders} orders totaal, ${changed.length} bijgewerkt in deze run.`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} ontbreekt`);
  return v;
}

run().catch((err) => {
  console.error('Delta-fetch mislukt:', err.message);
  process.exit(1);
});
