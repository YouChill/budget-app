import { supabase } from '../lib/supabase';
import { getUserProfile } from './api';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.78;

export const isAIEnabled = () => Boolean(OPENAI_API_KEY);

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text.trim().slice(0, 512),
      model: EMBEDDING_MODEL,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI ${response.status}: ${err.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateEmbeddingsBatch(texts) {
  const clean = texts.map(t => t.trim().slice(0, 512));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: clean, model: EMBEDDING_MODEL }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI batch ${response.status}: ${err.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  // API returns results in same order as input
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

/**
 * Save a single category rule with embedding to Supabase.
 * Non-blocking — caller should .catch(console.error) if fire-and-forget.
 */
export async function saveCategoryRule(description, kategoria, podkategoria, source = 'manual') {
  if (!OPENAI_API_KEY || !description?.trim() || !kategoria) return null;

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
 * Batch save category rules from imported transactions.
 * Skips default/uncategorized transactions.
 * Runs after import — non-blocking for UX.
 */
export async function saveCategoryRulesBatch(transactions) {
  if (!OPENAI_API_KEY) return;

  const toSave = transactions.filter(
    tx => tx.opis?.trim() && tx.kategoria && tx.kategoria !== 'Inne'
  );
  if (toSave.length === 0) return;

  try {
    const profile = await getUserProfile();

    // Chunk into batches of 20 to avoid rate limits
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
      if (error) {
        console.error('saveCategoryRulesBatch chunk error:', error);
      }
    }
  } catch (err) {
    console.error('saveCategoryRulesBatch failed:', err);
  }
}

/**
 * Find similar category for a single description using vector similarity search.
 */
export async function findSimilarCategory(description, householdId) {
  if (!OPENAI_API_KEY || !description?.trim()) return null;

  try {
    const embedding = await generateEmbedding(description);

    const { data, error } = await supabase.rpc('match_category_rules', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: 1,
      p_household_id: householdId,
    });

    if (error || !data?.length) return null;

    return {
      kategoria: data[0].kategoria,
      podkategoria: data[0].podkategoria,
      similarity: data[0].similarity,
    };
  } catch (err) {
    console.error('findSimilarCategory failed:', err);
    return null;
  }
}

/**
 * Batch-categorize a list of descriptions using AI vector similarity.
 * Returns array of same length — null for items that had no match.
 */
export async function categorizeWithAI(descriptions) {
  if (!OPENAI_API_KEY) return descriptions.map(() => null);

  const indexed = descriptions
    .map((desc, i) => ({ desc, i }))
    .filter(({ desc }) => desc?.trim());

  if (indexed.length === 0) return descriptions.map(() => null);

  try {
    const profile = await getUserProfile();

    // Single batch embedding call for all descriptions
    const embeddings = await generateEmbeddingsBatch(indexed.map(({ desc }) => desc));

    // Query Supabase for each embedding in parallel
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

    // Map back to original indices
    const output = descriptions.map(() => null);
    indexed.forEach(({ i }, j) => {
      output[i] = matchResults[j];
    });
    return output;
  } catch (err) {
    console.error('categorizeWithAI failed:', err);
    return descriptions.map(() => null);
  }
}
