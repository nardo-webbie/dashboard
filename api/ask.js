// Vercel serverless function.
// Verwacht env vars: GH_PAT, GH_GIST_ID, DASHBOARD_PASSWORD, ANTHROPIC_API_KEY
// Verwacht POST { question: string } en header 'x-dashboard-password'.

const { readGistData } = require('../lib/gist-read');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Alleen POST toegestaan' });
    return;
  }

  const password = req.headers['x-dashboard-password'];
  if (!process.env.DASHBOARD_PASSWORD) {
    res.status(500).json({ error: 'DASHBOARD_PASSWORD is niet ingesteld op de server' });
    return;
  }
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    res.status(401).json({ error: 'Ongeldig wachtwoord' });
    return;
  }

  const question = req.body && req.body.question;
  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'Geen vraag meegegeven' });
    return;
  }

  const gistId = process.env.GH_GIST_ID;
  const pat = process.env.GH_PAT;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!gistId || !pat) {
    res.status(500).json({ error: 'GH_GIST_ID / GH_PAT ontbreken op de server' });
    return;
  }
  if (!anthropicKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY ontbreekt op de server' });
    return;
  }

  try {
    const { orders, meta } = await readGistData(gistId, pat);
    const records = Object.values(orders);

    // v1: hele dataset meesturen als context. Bij ~215 orders is dat een paar
    // tientallen KB, ruim binnen budget. Groeit dit voorbij een paar honderd
    // orders, overweeg dan text-to-SQL i.p.v. de volledige set mee te sturen.
    const datasetJson = JSON.stringify(records);

    const systemPrompt = [
      'Je bent een data-analist voor een expeditiebedrijf (freight forwarding).',
      `Je krijgt een JSON-array van ${records.length} zendingen/orders uit Riege Scope (order-v3 schema).`,
      `De data is voor het laatst gesynchroniseerd op ${meta.lastSync || 'onbekend'}.`,
      'Veldbetekenis: conveyanceType is sea/air/road, revenueEUR/costEUR zijn totalen per order in euro,',
      'grossWeight in kg, dgr/cancelled/consolidated zijn booleans.',
      'Beantwoord vragen kort, feitelijk en in het Nederlands, uitsluitend gebaseerd op de meegegeven data.',
      'Geef bij aggregatievragen (totalen, gemiddelden, top-N) concrete cijfers.',
      'Als iets niet uit de data valt af te leiden, zeg dat expliciet in plaats van te gokken.',
    ].join(' ');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Dataset (JSON-array van orders):\n\n${datasetJson}\n\nVraag: ${question}`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const body = await claudeRes.text().catch(() => '');
      throw new Error(`Claude API gaf status ${claudeRes.status} terug: ${body.slice(0, 300)}`);
    }

    const data = await claudeRes.json();
    const answer = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ answer: answer || '(geen antwoord ontvangen)', ordersAnalyzed: records.length });
  } catch (err) {
    res.status(502).json({ error: 'Kon geen antwoord genereren: ' + err.message });
  }
};
