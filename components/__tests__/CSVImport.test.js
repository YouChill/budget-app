import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that need Supabase — pure helper functions don't use them
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('../../src/services/api', () => ({}));
vi.mock('../../src/services/categoryAI', () => ({
  isAIEnabled: vi.fn(() => false),
  categorizeWithAI: vi.fn(async (d) => d.map(() => null)),
  saveCategoryRulesBatch: vi.fn(),
}));

import {
  normalizeDateToISO,
  categorizeDescription,
  validateCategoryExists,
} from '../CSVImport';

// ─── normalizeDateToISO ────────────────────────────────────────────────────────

describe('normalizeDateToISO', () => {
  describe('format YYYY-MM-DD (ISO)', () => {
    it('akceptuje poprawną datę ISO', () => {
      expect(normalizeDateToISO('2026-01-15')).toBe('2026-01-15');
    });

    it('akceptuje różne daty ISO', () => {
      expect(normalizeDateToISO('2024-12-31')).toBe('2024-12-31');
      expect(normalizeDateToISO('2023-02-28')).toBe('2023-02-28');
    });

    it('zwraca null dla nieprawidłowej daty ISO', () => {
      expect(normalizeDateToISO('2026-13-01')).toBeNull(); // miesiąc 13
      expect(normalizeDateToISO('2026-00-01')).toBeNull(); // miesiąc 0
    });
  });

  describe('format DD.MM.YYYY (Polski)', () => {
    it('konwertuje datę w formacie polskim do ISO', () => {
      expect(normalizeDateToISO('15.01.2026')).toBe('2026-01-15');
    });

    it('konwertuje koniec miesiąca', () => {
      expect(normalizeDateToISO('31.12.2025')).toBe('2025-12-31');
    });
  });

  describe('format DD-MM-YYYY', () => {
    it('konwertuje datę z myślnikami', () => {
      expect(normalizeDateToISO('15-01-2026')).toBe('2026-01-15');
    });
  });

  describe('nieprawidłowe dane', () => {
    it('zwraca null dla pustego stringa', () => {
      expect(normalizeDateToISO('')).toBeNull();
    });

    it('zwraca null dla null', () => {
      expect(normalizeDateToISO(null)).toBeNull();
    });

    it('zwraca null dla undefined', () => {
      expect(normalizeDateToISO(undefined)).toBeNull();
    });

    it('zwraca null dla tekstu niebędącego datą', () => {
      expect(normalizeDateToISO('nie-data')).toBeNull();
      expect(normalizeDateToISO('abcd')).toBeNull();
    });

    it('zwraca null dla samej liczby', () => {
      expect(normalizeDateToISO('12345')).toBeNull();
    });
  });

  describe('obsługa obiektów Date-like', () => {
    it('akceptuje liczby jako string (np. z arkuszy kalkulacyjnych)', () => {
      // ISO format jako string
      const result = normalizeDateToISO('2026-03-15');
      expect(result).toBe('2026-03-15');
    });
  });
});

// ─── categorizeDescription ────────────────────────────────────────────────────

describe('categorizeDescription', () => {
  it('zwraca null dla pustego opisu', () => {
    expect(categorizeDescription('')).toBeNull();
    expect(categorizeDescription(null)).toBeNull();
  });

  it('rozpoznaje Biedronkę jako Jedzenie/Zakupy domowe', () => {
    const result = categorizeDescription('Płatność BIEDRONKA');
    expect(result).toEqual({ kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' });
  });

  it('rozpoznaje orlen jako Transport/Paliwo', () => {
    const result = categorizeDescription('ORLEN stacja 123');
    expect(result).toEqual({ kategoria: 'Transport', podkategoria: 'Paliwo' });
  });

  it('rozpoznaje Netflix jako Rozrywka/Subskrypcje', () => {
    const result = categorizeDescription('NETFLIX.COM opłata miesięczna');
    expect(result).toEqual({ kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' });
  });

  it('zwraca null dla nierozpoznanego opisu', () => {
    const result = categorizeDescription('XYZ NIEZNANA FIRMA 123');
    expect(result).toBeNull();
  });

  it('nie uwzględnia wielkości liter', () => {
    expect(categorizeDescription('LIDL SKLEP')).toEqual(
      categorizeDescription('Lidl sklep')
    );
  });

  it('reguły użytkownika mają pierwszeństwo przed domyślnymi', () => {
    const userRules = [
      { keyword: 'biedronka', kategoria: 'Moje Zakupy', podkategoria: 'Tygodniowe' },
    ];
    const result = categorizeDescription('BIEDRONKA zakupy', userRules);
    expect(result).toEqual({ kategoria: 'Moje Zakupy', podkategoria: 'Tygodniowe' });
  });

  it('reguły użytkownika są sprawdzane w kolejności', () => {
    const userRules = [
      { keyword: 'pizza', kategoria: 'Jedzenie', podkategoria: 'Restauracje' },
      { keyword: 'pizza hut', kategoria: 'Jedzenie', podkategoria: 'Fast food' },
    ];
    const result = categorizeDescription('Pizza Hut zamówienie', userRules);
    // First matching rule wins
    expect(result).toEqual({ kategoria: 'Jedzenie', podkategoria: 'Restauracje' });
  });

  it('obsługuje puste reguły użytkownika', () => {
    const result = categorizeDescription('Biedronka zakupy', []);
    expect(result).toEqual({ kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' });
  });
});

// ─── validateCategoryExists ───────────────────────────────────────────────────

describe('validateCategoryExists', () => {
  const mockKategorie = {
    Wydatek: {
      Jedzenie: ['Zakupy domowe', 'Restauracje/miasto'],
      Transport: [],
    },
    Przychód: {
      Pensja: [],
    },
  };

  it('zwraca oryginalną kategorię gdy istnieje i podkategoria pasuje', () => {
    const result = validateCategoryExists('Jedzenie', 'Zakupy domowe', mockKategorie, 'Wydatek');
    expect(result).toEqual({ kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' });
  });

  it('zwraca kategorię z pustą podkategorią gdy podkategoria nie istnieje', () => {
    const result = validateCategoryExists('Jedzenie', 'Nieistniejąca', mockKategorie, 'Wydatek');
    expect(result).toEqual({ kategoria: 'Jedzenie', podkategoria: '' });
  });

  it('zwraca Inne/Nieprzewidziane gdy kategoria nie istnieje', () => {
    const result = validateCategoryExists('Nieistniejąca', 'Sub', mockKategorie, 'Wydatek');
    expect(result).toEqual({ kategoria: 'Inne', podkategoria: 'Nieprzewidziane' });
  });

  it('zwraca Inne/Nieprzewidziane gdy typ jest nieprawidłowy', () => {
    const result = validateCategoryExists('Jedzenie', 'Zakupy domowe', mockKategorie, 'Nieznany');
    expect(result).toEqual({ kategoria: 'Inne', podkategoria: 'Nieprzewidziane' });
  });

  it('akceptuje kategorię bez podkategorii (pusta lista)', () => {
    const result = validateCategoryExists('Transport', '', mockKategorie, 'Wydatek');
    expect(result).toEqual({ kategoria: 'Transport', podkategoria: '' });
  });

  it('obsługuje null kategorie', () => {
    const result = validateCategoryExists('Jedzenie', 'Zakupy domowe', null, 'Wydatek');
    expect(result).toEqual({ kategoria: 'Inne', podkategoria: 'Nieprzewidziane' });
  });

  it('obsługuje Przychód', () => {
    const result = validateCategoryExists('Pensja', '', mockKategorie, 'Przychód');
    expect(result).toEqual({ kategoria: 'Pensja', podkategoria: '' });
  });
});
