async function readGistData(gistId, pat) {
  const gistRes = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!gistRes.ok) {
    throw new Error(`GitHub API gaf status ${gistRes.status} terug`);
  }
  const gist = await gistRes.json();

  const ordersContent = await readGistFile(gist, 'orders.json');
  const metaContent = await readGistFile(gist, 'meta.json');

  return {
    orders: JSON.parse(ordersContent),
    meta: JSON.parse(metaContent),
  };
}

async function readGistFile(gist, filename) {
  const file = gist.files[filename];
  if (!file) throw new Error(`Bestand ${filename} niet gevonden in gist`);
  if (file.truncated) {
    const raw = await fetch(file.raw_url);
    if (!raw.ok) throw new Error(`Kon ${filename} niet ophalen via raw_url`);
    return raw.text();
  }
  return file.content;
}

module.exports = { readGistData };
