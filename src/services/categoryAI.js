import { supabase } from '../lib/supabase';
import { getUserProfile } from './api';

// VITE_AI_ENABLED to tylko flaga (true/false) — klucz OpenAI pozostaje
// wyłącznie po stronie serwera w zmiennej OPENAI_API_KEY (bez prefiksu VITE_).
const SIMILARITY_THRESHOLD = 0.78;

export const isAIEnabled = () => import.meta.env.VITE_AI_ENABLED === 'true';

/**
 * Generuje embeddingi przez serverless proxy /api/embeddings.
 * Klucz OpenAI nigdy nie opuszcza serwera.
 */
async function generateEmbeddingsBatch(texts) {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Embeddings API ${response.status}: ${err.error || 'Unknown error'}`);
  }

  const { embeddings } = await response.json();
  return embeddings;
}

async function generateEmbedding(text) {
  const [embedding] = await generateEmbeddingsBatch([text]);
  return embedding;
}

/**
 * Zapisuje pojedynczą regułę kategorii z embeddingiem do Supabase.
 */
export async function saveCategoryRule(description, kategoria, podkategoria, source = 'manual') {
  if (!isAIEnabled() || !description?.trim() || !kategoria) return null;

  try {
    const profile = await getUserProfile();
    const embedding = await generateEmbedding(description);

    const { error } = await supabase.from('category_rules').insert({
      household_id: profile.household_id,
      description: description.trim(),
      embedding,
      kategoria,
      podkategoria: podkategoria || null,
      source,
    });

    if (error) {
      console.error('saveCategoryRule insert error:', error);
      return null;
    }
    return true;
  } catch (err) {
    console.error('saveCategoryRule failed:', err);
    return null;
  }
}

/**
 * Batch-zapis reguł po imporcie. Pomija nieprzypisane transakcje.
 */
export async function saveCategoryRulesBatch(transactions) {
  if (!isAIEnabled()) return;

  const toSave = transactions.filter(
    tx => tx.opis?.trim() && tx.kategoria && tx.kategoria !== 'Inne'
  );
  if (toSave.length === 0) return;

  try {
    const profile = await getUserProfile();

    const CHUNK = 20;
    for (let i = 0; i < toSave.length; i += CHUNK) {
      const chunk = toSave.slice(i, i + CHUNK);
      const embeddings = await generateEmbeddingsBatch(chunk.map(tx => tx.opis));

      const records = chunk.map((tx, j) => ({
        household_id: profile.household_id,
        description: tx.opis.trim(),
        embedding: embeddings[j],
        kategoria: tx.kategoria,
        podkategoria: tx.podkategoria || null,
        source: 'import',
      }));

      const { error } = await supabase.from('category_rules').insert(records);
      if (error) console.error('saveCategoryRulesBatch chunk error:', error);
    }
  } catch (err) {
    console.error('saveCategoryRulesBatch failed:', err);
  }
}

/**
 * Batch-kategoryzacja opisów przez wyszukiwanie wektorowe w Supabase.
 * Zwraca tablicę tej samej długości — null dla braku dopasowania.
 */
export async function categorizeWithAI(descriptions) {
  if (!isAIEnabled()) return descriptions.map(() => null);

  const indexed = descriptions
    .map((desc, i) => ({ desc, i }))
    .filter(({ desc }) => desc?.trim());

  if (indexed.length === 0) return descriptions.map(() => null);

  try {
    const profile = await getUserProfile();
    const embeddings = await generateEmbeddingsBatch(indexed.map(({ desc }) => desc));

    const matchResults = await Promise.all(
      embeddings.map(async (embedding) => {
        const { data, error } = await supabase.rpc('match_category_rules', {
          query_embedding: embedding,
          match_threshold: SIMILARITY_THRESHOLD,
          match_count: 1,
          p_household_id: profile.household_id,
        });

        if (error || !data?.length) return null;
        return {
          kategoria: data[0].kategoria,
          podkategoria: data[0].podkategoria,
          similarity: data[0].similarity,
        };
      })
    );

    const output = descriptions.map(() => null);
    indexed.forEach(({ i }, j) => { output[i] = matchResults[j]; });
    return output;
  } catch (err) {
    console.error('categorizeWithAI failed:', err);
    return descriptions.map(() => null);
  }
}
