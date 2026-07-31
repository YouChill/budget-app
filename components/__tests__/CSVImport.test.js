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
  parseKwota,
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

  describe('odrzucanie nieistniejących dat', () => {
    it('zwraca null dla 30 lutego (ISO)', () => {
      expect(normalizeDateToISO('2025-02-30')).toBeNull();
    });

    it('zwraca null dla 31 kwietnia (ISO)', () => {
      expect(normalizeDateToISO('2025-04-31')).toBeNull();
    });

    it('zwraca null dla 30.02 (format polski)', () => {
      expect(normalizeDateToISO('30.02.2025')).toBeNull();
    });

    it('zwraca null dla 31-04 (myślniki)', () => {
      expect(normalizeDateToISO('31-04-2025')).toBeNull();
    });

    it('akceptuje 29 lutego w roku przestępnym', () => {
      expect(normalizeDateToISO('2024-02-29')).toBe('2024-02-29');
    });

    it('odrzuca 29 lutego w roku nieprzestępnym', () => {
      expect(normalizeDateToISO('2025-02-29')).toBeNull();
    });
  });
});

// ─── parseKwota ─────────────────────────────────────────────────────────────

describe('parseKwota', () => {
  it('parsuje liczbę dziesiętną z przecinkiem', () => {
    expect(parseKwota('150,00')).toBe(150);
    expect(parseKwota('-150,50')).toBe(-150.5);
  });

  it('parsuje format z separatorem tysięcy (kropka) i przecinkiem', () => {
    expect(parseKwota('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parseKwota('1.000.000,00')).toBe(1000000);
  });

  it('zwraca liczby bez zmian (nie psuje wartości typu 1.234)', () => {
    // Kluczowa regresja: ponowne parsowanie liczby nie może zamienić 1.234 → 1234
    expect(parseKwota(1.234)).toBe(1.234);
    expect(parseKwota(-150.5)).toBe(-150.5);
    expect(parseKwota(1500)).toBe(1500);
  });

  it('zwraca 0 dla pustych / niepoprawnych wartości', () => {
    expect(parseKwota('')).toBe(0);
    expect(parseKwota(null)).toBe(0);
    expect(parseKwota(undefined)).toBe(0);
    expect(parseKwota('abc')).toBe(0);
    expect(parseKwota(NaN)).toBe(0);
  });

  it('ignoruje spacje i twarde spacje', () => {
    expect(parseKwota('1 234,56')).toBeCloseTo(1234.56, 2);
    expect(parseKwota(' 150,00 ')).toBe(150);
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

  describe('rozróżnianie typu transakcji (Wydatek/Przychód)', () => {
    it('nie stosuje wbudowanego słownika wydatkowego do przychodów', () => {
      // Zwrot za zakupy kartą (uznanie) nie może dostać kategorii wydatkowej
      expect(categorizeDescription('ZWROT ZAKUP BIEDRONKA WARSZAWA', [], 'Przychód')).toBeNull();
      expect(categorizeDescription('Przelew od Jana — za pizzę i kino', [], 'Przychód')).toBeNull();
    });

    it('stosuje wbudowany słownik dla wydatków (domyślny typ)', () => {
      expect(categorizeDescription('Płatność BIEDRONKA', [], 'Wydatek')).toEqual(
        { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' }
      );
      // Brak argumentu typ = zachowanie jak dla wydatku (kompatybilność wstecz)
      expect(categorizeDescription('Płatność BIEDRONKA')).toEqual(
        { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' }
      );
    });

    it('nie stosuje reguły z typem Wydatek do przychodu', () => {
      const userRules = [
        { keyword: 'biedronka', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe', typ: 'Wydatek' },
      ];
      expect(categorizeDescription('ZWROT BIEDRONKA', userRules, 'Przychód')).toBeNull();
    });

    it('stosuje regułę z typem Przychód do przychodu', () => {
      const userRules = [
        { keyword: 'wynagrodzenie', kategoria: 'Pensja', podkategoria: '', typ: 'Przychód' },
      ];
      expect(categorizeDescription('WYNAGRODZENIE ZA LIPIEC', userRules, 'Przychód')).toEqual(
        { kategoria: 'Pensja', podkategoria: '' }
      );
      expect(categorizeDescription('WYNAGRODZENIE ZA LIPIEC', userRules, 'Wydatek')).toBeNull();
    });

    it('reguły bez typu (starsze) stosuje do obu typów', () => {
      const userRules = [
        { keyword: 'allegro', kategoria: 'Dom', podkategoria: 'Wyposażenie' },
      ];
      expect(categorizeDescription('ALLEGRO zamówienie', userRules, 'Wydatek')).toEqual(
        { kategoria: 'Dom', podkategoria: 'Wyposażenie' }
      );
      expect(categorizeDescription('ALLEGRO zwrot', userRules, 'Przychód')).toEqual(
        { kategoria: 'Dom', podkategoria: 'Wyposażenie' }
      );
    });

    it('pomija regułę o niezgodnym typie i sprawdza kolejne', () => {
      const userRules = [
        { keyword: 'biedronka', kategoria: 'Złe', podkategoria: '', typ: 'Przychód' },
        { keyword: 'biedronka', kategoria: 'Moje Zakupy', podkategoria: 'Tygodniowe', typ: 'Wydatek' },
      ];
      expect(categorizeDescription('BIEDRONKA zakupy', userRules, 'Wydatek')).toEqual(
        { kategoria: 'Moje Zakupy', podkategoria: 'Tygodniowe' }
      );
    });
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
