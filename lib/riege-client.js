const { XMLParser } = require('fast-xml-parser');

// removeNSPrefix strip de o:/cdt:/codt: namespace-prefixes, zodat je gewoon
// order.customer.partner.name kan doen ipv o:order['cdt:customer']['cdt:partner']...
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => ['order', 'jobcostingEntry'].includes(name),
});

function authHeader() {
  const user = process.env.RIEGE_SCOPE_USER;
  const pass = process.env.RIEGE_SCOPE_PASS;
  if (!user || !pass) {
    throw new Error('RIEGE_SCOPE_USER / RIEGE_SCOPE_PASS ontbreken in de environment');
  }
  const token = Buffer.from(`${user}:${pass}`).toString('base64');
  return `Basic ${token}`;
}

async function riegeGet(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: 'application/xml',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Riege API ${res.status} bij ${url}: ${body.slice(0, 300)}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);
  return parsed.orders?.order ?? [];
}

/**
 * Haalt één pagina orders op.
 * LET OP: pas offset/limit param-namen aan op je eigen OpenAPI-spec
 * (query-builder tool die je eerder hebt gebouwd) als deze afwijken.
 */
async function fetchOrdersPage({ offset = 0, limit = 100 }) {
  const base = requireEnv('RIEGE_SCOPE_BASE_URL'); // bijv. https://<host>/v3/orders
  const url = `${base}?offset=${offset}&limit=${limit}`;
  return riegeGet(url);
}

/**
 * Haalt gewijzigde/nieuwe orders sinds een timestamp op.
 * LET OP: controleer de exacte query-param naam ('since' hieronder is een
 * aanname) tegen je OpenAPI-spec voor /v3/orders/delta.
 */
async function fetchDelta(sinceIso) {
  const base = requireEnv('RIEGE_SCOPE_BASE_URL');
  const url = `${base}/delta?since=${encodeURIComponent(sinceIso)}`;
  return riegeGet(url);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} ontbreekt`);
  return v;
}

module.exports = { fetchOrdersPage, fetchDelta };
