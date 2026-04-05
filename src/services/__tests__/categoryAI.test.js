import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock import.meta.env before importing module
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  getUserProfile: vi.fn(),
}));

describe('categoryAI - isAIEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zwraca false gdy VITE_AI_ENABLED nie jest ustawione', async () => {
    const { isAIEnabled } = await import('../categoryAI');
    // In test env, VITE_AI_ENABLED is undefined → 'true' comparison fails
    expect(isAIEnabled()).toBe(false);
  });
});

describe('categoryAI - saveCategoryRule gdy AI wyłączone', () => {
  it('zwraca null bez wywołań API gdy AI jest wyłączone', async () => {
    const { saveCategoryRule } = await import('../categoryAI');
    const result = await saveCategoryRule('zakupy spożywcze', 'Jedzenie', 'Zakupy');
    expect(result).toBeNull();
  });

  it('zwraca null dla pustego opisu', async () => {
    const { saveCategoryRule } = await import('../categoryAI');
    const result = await saveCategoryRule('', 'Jedzenie', 'Zakupy');
    expect(result).toBeNull();
  });

  it('zwraca null dla brakującej kategorii', async () => {
    const { saveCategoryRule } = await import('../categoryAI');
    const result = await saveCategoryRule('zakupy', '', '');
    expect(result).toBeNull();
  });
});

describe('categoryAI - categorizeWithAI gdy AI wyłączone', () => {
  it('zwraca tablicę nullów tej samej długości gdy AI jest wyłączone', async () => {
    const { categorizeWithAI } = await import('../categoryAI');
    const descriptions = ['Biedronka', 'McDonald\'s', 'PKP'];
    const result = await categorizeWithAI(descriptions);
    expect(result).toHaveLength(3);
    expect(result.every(r => r === null)).toBe(true);
  });

  it('zwraca pustą tablicę dla pustej listy opisów', async () => {
    const { categorizeWithAI } = await import('../categoryAI');
    const result = await categorizeWithAI([]);
    expect(result).toEqual([]);
  });
});

describe('categoryAI - saveCategoryRulesBatch gdy AI wyłączone', () => {
  it('kończy bez błędu gdy AI jest wyłączone', async () => {
    const { saveCategoryRulesBatch } = await import('../categoryAI');
    const transactions = [
      { opis: 'Biedronka', kategoria: 'Jedzenie', podkategoria: 'Zakupy' },
    ];
    await expect(saveCategoryRulesBatch(transactions)).resolves.toBeUndefined();
  });
});
