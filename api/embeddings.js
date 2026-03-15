/**
 * Vercel Serverless Function — /api/embeddings
 *
 * Proxy dla OpenAI Embeddings API. Klucz OPENAI_API_KEY pozostaje
 * wyłącznie po stronie serwera i nigdy nie trafia do bundle'a JS.
 *
 * POST /api/embeddings
 * Body:  { texts: string[] }
 * Response: { embeddings: number[][] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured — set OPENAI_API_KEY in environment' });
  }

  const { texts } = req.body ?? {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: 'Body must contain non-empty "texts" array' });
  }

  const clean = texts.map(t => String(t).trim().slice(0, 512));

  try {
    const upstream = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: clean,
        model: 'text-embedding-3-small',
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message ?? 'OpenAI error' });
    }

    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);

    return res.status(200).json({ embeddings });
  } catch (err) {
    console.error('[/api/embeddings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
