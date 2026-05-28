/**
 * Vercel Serverless Function — /api/embeddings
 *
 * Proxy dla OpenAI Embeddings API. Klucz OPENAI_API_KEY pozostaje
 * wyłącznie po stronie serwera i nigdy nie trafia do bundle'a JS.
 *
 * Bezpieczeństwo:
 *   - Wymaga ważnego tokenu sesji Supabase (nagłówek Authorization: Bearer …).
 *     Bez tego endpoint byłby otwarty — każdy mógłby generować embeddingi na
 *     koszt właściciela klucza OpenAI.
 *   - Ogranicza liczbę tekstów na żądanie (MAX_TEXTS) i długość każdego (512).
 *
 * POST /api/embeddings
 * Headers: Authorization: Bearer <supabase access token>
 * Body:    { texts: string[] }
 * Response: { embeddings: number[][] }
 */
const MAX_TEXTS = 100;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Weryfikuje token sesji Supabase. Zwraca true gdy token odpowiada
// istniejącemu użytkownikowi.
async function verifySupabaseToken(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured — set OPENAI_API_KEY in environment' });
  }

  // ── Uwierzytelnienie ──────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const authorized = await verifySupabaseToken(token);
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized — valid Supabase session required' });
  }

  const { texts } = req.body ?? {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: 'Body must contain non-empty "texts" array' });
  }
  if (texts.length > MAX_TEXTS) {
    return res.status(413).json({ error: `Too many texts — maximum is ${MAX_TEXTS} per request` });
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
