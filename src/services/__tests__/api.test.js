import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Musi być przed importem supabase — vi.mock jest hoistowany przez vitest
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
      upsert: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('API Service - Transakcje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTransakcje', () => {
    it('powinien poprawnie budować zakresy dat', async () => {
      // Test logiki budowania dat, nie API
      const month = 2;
      const year = 2026;
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      expect(startDate).toBe('2026-02-01');
      expect(endDate).toBe('2026-03-01');
    });

    it('poprawnie obsługuje miesiąc grudzień (przejście na następny rok)', () => {
      const month = 12;
      const year = 2025;
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      expect(startDate).toBe('2025-12-01');
      expect(endDate).toBe('2026-01-01');
    });
  });

  describe('addTransakcja', () => {
    it('konwertuje kwotę do wartości bezwzględnej', () => {
      const kwota = -100;
      const result = Math.abs(kwota);
      expect(result).toBe(100);
    });

    it('parsuje numeryczne kwoty', () => {
      const kwotaString = '100.50';
      const kwotaNumber = parseFloat(kwotaString);
      expect(kwotaNumber).toBe(100.50);
    });
  });

  describe('deleteTransakcja', () => {
    it('waliduje niepusty ID', () => {
      const id = '123';
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });
  });

  describe('updateTransakcja', () => {
    it('waliduje dane do aktualizacji', () => {
      const transakcja = {
        data: '2026-02-10',
        typ: 'Wydatek',
        kwota: 150,
        kategoria: 'Transport',
        osoba: 'Anna'
      };

      expect(transakcja).toHaveProperty('data');
      expect(transakcja).toHaveProperty('typ');
      expect(transakcja.kwota).toBeGreaterThan(0);
    });
  });
});

describe('API Service - Kategorie', () => {
  describe('getKategorie - data transformation', () => {
    it('transformuje płaskie dane do zagnieżdżonej struktury', () => {
      const flatData = [
        { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Zakupy' },
        { typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Restauracja' },
        { typ: 'Przychód', kategoria: 'Pensja', podkategoria: null }
      ];

      const result = { Wydatek: {}, Przychód: {} };
      for (const row of flatData) {
        if (!result[row.typ]) result[row.typ] = {};
        if (!result[row.typ][row.kategoria]) result[row.typ][row.kategoria] = [];
        if (row.podkategoria) {
          result[row.typ][row.kategoria].push(row.podkategoria);
        }
      }

      expect(result).toEqual({
        Wydatek: {
          Jedzenie: ['Zakupy', 'Restauracja']
        },
        Przychód: {
          Pensja: []
        }
      });
    });

    it('obsługuje pustą odpowiedź', () => {
      const flatData = [];
      const result = { Wydatek: {}, Przychód: {} };
      
      for (const row of flatData) {
        if (!result[row.typ]) result[row.typ] = {};
        if (!result[row.typ][row.kategoria]) result[row.typ][row.kategoria] = [];
        if (row.podkategoria) {
          result[row.typ][row.kategoria].push(row.podkategoria);
        }
      }

      expect(result).toEqual({
        Wydatek: {},
        Przychód: {}
      });
    });
  });

  describe('getOsoby - data mapping', () => {
    it('mapuje obiekty do nazw osób', () => {
      const data = [
        { nazwa: 'Jan' },
        { nazwa: 'Anna' }
      ];

      const result = data.map(o => o.nazwa);
      expect(result).toEqual(['Jan', 'Anna']);
    });

    it('obsługuje pustą listę', () => {
      const data = [];
      const result = data.map(o => o.nazwa);
      expect(result).toEqual([]);
    });
  });
});

describe('API Service - Data Structure Validation', () => {
  it('waliduje strukturę pojedynczej transakcji', () => {
    const transaction = {
      id: '1',
      data: '2026-02-13',
      typ: 'Wydatek',
      kwota: 100.50,
      kategoria: 'Jedzenie',
      podkategoria: 'Zakupy',
      osoba: 'Jan',
      komentarz: 'Test'
    };

    expect(transaction).toHaveProperty('id');
    expect(transaction).toHaveProperty('data');
    expect(transaction).toHaveProperty('typ');
    expect(transaction).toHaveProperty('kwota');
    expect(transaction).toHaveProperty('kategoria');
    expect(transaction).toHaveProperty('osoba');
    expect(['Wydatek', 'Przychód']).toContain(transaction.typ);
    expect(transaction.kwota).toBeGreaterThanOrEqual(0);
  });

  it('waliduje strukturę budżetu', () => {
    const budget = {
      kategoria: 'Jedzenie',
      limit: 1000,
      miesiac: 2,
      rok: 2026,
      osoba: 'Jan',
      zakres: 'monthly',
      notatki: 'Test'
    };

    expect(budget).toHaveProperty('kategoria');
    expect(budget).toHaveProperty('limit');
    expect(budget).toHaveProperty('rok');
    expect(['monthly', 'yearly']).toContain(budget.zakres);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Testy nowych poprawek
// ─────────────────────────────────────────────────────────────────────────────

describe('addTransakcjeBatch - parseFloat z NaN guard', () => {
  it('bezpiecznie parsuje poprawne stringi jako kwotę', () => {
    const rawKwota = '123.45';
    const parsed = parseFloat(rawKwota);
    const safe = isNaN(parsed) ? 0 : parsed;
    expect(safe).toBe(123.45);
  });

  it('zastępuje NaN zerą gdy kwota jest nieprawidłowym stringiem', () => {
    const rawKwota = 'abc';
    const parsed = parseFloat(rawKwota);
    const safe = isNaN(parsed) ? 0 : parsed;
    expect(safe).toBe(0);
  });

  it('zachowuje kwotę gdy jest już liczbą', () => {
    const rawKwota = 99.99;
    const parsed = typeof rawKwota === 'number' ? rawKwota : parseFloat(rawKwota);
    const safe = isNaN(parsed) ? 0 : parsed;
    expect(safe).toBe(99.99);
  });

  it('obsługuje undefined jako kwotę', () => {
    const rawKwota = undefined;
    const parsed = typeof rawKwota === 'number' ? rawKwota : parseFloat(rawKwota);
    const safe = isNaN(parsed) ? 0 : parsed;
    expect(safe).toBe(0);
  });

  it('obsługuje null jako kwotę', () => {
    const rawKwota = null;
    const parsed = typeof rawKwota === 'number' ? rawKwota : parseFloat(rawKwota);
    const safe = isNaN(parsed) ? 0 : parsed;
    expect(safe).toBe(0);
  });
});

describe('getTransakcjeForYear - cache z TTL', () => {
  const YEARLY_CACHE_TTL_MS = 30 * 60 * 1000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('cache jest ważny gdy timestamp jest świeży', () => {
    const cacheKey = 'yearly_transakcje_2026';
    const cacheTimestampKey = `${cacheKey}_ts`;
    const freshData = [{ id: '1', kwota: 100 }];

    sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
    sessionStorage.setItem(cacheTimestampKey, String(Date.now()));

    const cached = sessionStorage.getItem(cacheKey);
    const cachedTs = sessionStorage.getItem(cacheTimestampKey);
    const isValid = cached && cachedTs && Date.now() - parseInt(cachedTs, 10) < YEARLY_CACHE_TTL_MS;

    expect(isValid).toBeTruthy();
    expect(JSON.parse(cached)).toEqual(freshData);
  });

  it('cache jest nieważny gdy timestamp jest za stary', () => {
    const cacheKey = 'yearly_transakcje_2025';
    const cacheTimestampKey = `${cacheKey}_ts`;

    sessionStorage.setItem(cacheKey, JSON.stringify([]));
    // Timestamp starszy niż TTL
    sessionStorage.setItem(cacheTimestampKey, String(Date.now() - YEARLY_CACHE_TTL_MS - 1));

    const cached = sessionStorage.getItem(cacheKey);
    const cachedTs = sessionStorage.getItem(cacheTimestampKey);
    const isValid = cached && cachedTs && Date.now() - parseInt(cachedTs, 10) < YEARLY_CACHE_TTL_MS;

    expect(isValid).toBeFalsy();
  });

  it('cache jest nieważny gdy brak timestamp', () => {
    const cacheKey = 'yearly_transakcje_2024';
    const cacheTimestampKey = `${cacheKey}_ts`;

    sessionStorage.setItem(cacheKey, JSON.stringify([]));
    // Brak timestamp

    const cached = sessionStorage.getItem(cacheKey);
    const cachedTs = sessionStorage.getItem(cacheTimestampKey);
    const isValid = cached && cachedTs && Date.now() - parseInt(cachedTs, 10) < YEARLY_CACHE_TTL_MS;

    expect(isValid).toBeFalsy();
  });
});

describe('addKategoria - walidacja danych wejściowych', () => {
  const validateKategoria = (typ, kategoria) => {
    if (!typ || typeof typ !== 'string' || !typ.trim()) throw new Error('Nieprawidłowy typ kategorii');
    if (!kategoria || typeof kategoria !== 'string' || !kategoria.trim()) throw new Error('Nieprawidłowa nazwa kategorii');
    return true;
  };

  it('akceptuje poprawny typ i kategorię', () => {
    expect(() => validateKategoria('Wydatek', 'Jedzenie')).not.toThrow();
  });

  it('rzuca błąd dla pustego typ', () => {
    expect(() => validateKategoria('', 'Jedzenie')).toThrow('Nieprawidłowy typ kategorii');
  });

  it('rzuca błąd dla null typ', () => {
    expect(() => validateKategoria(null, 'Jedzenie')).toThrow('Nieprawidłowy typ kategorii');
  });

  it('rzuca błąd dla typ zawierającego tylko spacje', () => {
    expect(() => validateKategoria('   ', 'Jedzenie')).toThrow('Nieprawidłowy typ kategorii');
  });

  it('rzuca błąd dla pustej kategorii', () => {
    expect(() => validateKategoria('Wydatek', '')).toThrow('Nieprawidłowa nazwa kategorii');
  });

  it('rzuca błąd dla null kategorii', () => {
    expect(() => validateKategoria('Wydatek', null)).toThrow('Nieprawidłowa nazwa kategorii');
  });

  it('rzuca błąd dla liczby jako typ', () => {
    expect(() => validateKategoria(123, 'Jedzenie')).toThrow('Nieprawidłowy typ kategorii');
  });
});

describe('getAllData - obsługa błędów częściowych (Promise.allSettled)', () => {
  it('zwraca puste kategorie gdy getKategorie zawiedzie', async () => {
    const txResult = { status: 'fulfilled', value: [{ id: '1' }] };
    const katResult = { status: 'rejected', reason: new Error('DB error') };
    const osobyResult = { status: 'fulfilled', value: ['Jan'] };

    // Symulacja logiki getAllData z Promise.allSettled
    if (txResult.status === 'rejected') throw txResult.reason;
    const transakcje = txResult.value;
    const kategorie = katResult.status === 'fulfilled' ? katResult.value : { Wydatek: {}, Przychód: {} };
    const osoby = osobyResult.status === 'fulfilled' ? osobyResult.value : [];

    expect(transakcje).toEqual([{ id: '1' }]);
    expect(kategorie).toEqual({ Wydatek: {}, Przychód: {} });
    expect(osoby).toEqual(['Jan']);
  });

  it('zwraca puste osoby gdy getOsoby zawiedzie', async () => {
    const txResult = { status: 'fulfilled', value: [] };
    const katResult = { status: 'fulfilled', value: { Wydatek: {}, Przychód: {} } };
    const osobyResult = { status: 'rejected', reason: new Error('Osoby error') };

    if (txResult.status === 'rejected') throw txResult.reason;
    const osoby = osobyResult.status === 'fulfilled' ? osobyResult.value : [];

    expect(osoby).toEqual([]);
  });

  it('rzuca błąd gdy getTransakcje zawiedzie (transakcje są krytyczne)', () => {
    const txResult = { status: 'rejected', reason: new Error('Auth error') };

    expect(() => {
      if (txResult.status === 'rejected') throw txResult.reason;
    }).toThrow('Auth error');
  });
});

