const GIST_API = 'https://api.github.com/gists';

async function ghFetch(path, opts = {}) {
  const pat = process.env.GH_PAT;
  if (!pat) throw new Error('GH_PAT ontbreekt in de environment');

  const res = await fetch(`${GIST_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Leest orders.json + meta.json uit de gist.
 * Geeft lege structuren terug als de gist nog geen data bevat (eerste run).
 */
async function readGist(gistId) {
  const gist = await ghFetch(`/${gistId}`);
  const ordersFile = gist.files['orders.json'];
  const metaFile = gist.files['meta.json'];

  const orders = ordersFile ? JSON.parse(ordersFile.content) : {};
  const meta = metaFile
    ? JSON.parse(metaFile.content)
    : { lastSync: null, lastModifiedSeen: null, totalOrders: 0 };

  return { orders, meta };
}

async function writeGist(gistId, orders, meta) {
  await ghFetch(`/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      files: {
        'orders.json': { content: JSON.stringify(orders, null, 1) },
        'meta.json': { content: JSON.stringify(meta, null, 1) },
      },
    }),
  });
}

module.exports = { readGist, writeGist };
