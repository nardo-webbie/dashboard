require('dotenv').config();
const { fetchOrdersPage } = require('../lib/riege-client');
const { normalizeOrder } = require('../lib/normalize');
const { writeGist } = require('../lib/gist-store');

const PAGE_SIZE = 100;

async function run() {
  const gistId = requireEnv('GH_GIST_ID');

  const orders = {};
  let offset = 0;
  let page;

  do {
    console.log(`Ophalen offset=${offset}, limit=${PAGE_SIZE}...`);
    page = await fetchOrdersPage({ offset, limit: PAGE_SIZE });
    for (const raw of page) {
      const n = normalizeOrder(raw);
      orders[n.identifier] = n;
    }
    console.log(`  -> ${page.length} orders ontvangen, totaal nu ${Object.keys(orders).length}`);
    offset += PAGE_SIZE;
  } while (page.length === PAGE_SIZE);

  const lastModifiedSeen = Object.values(orders)
    .map((o) => o.lastModified)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const meta = {
    lastSync: new Date().toISOString(),
    lastModifiedSeen,
    totalOrders: Object.keys(orders).length,
  };

  await writeGist(gistId, orders, meta);
  console.log(`Klaar. ${meta.totalOrders} orders opgeslagen in gist ${gistId}.`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} ontbreekt`);
  return v;
}

run().catch((err) => {
  console.error('Bulk-fetch mislukt:', err.message);
  process.exit(1);
});
