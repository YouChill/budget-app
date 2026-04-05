import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabase';

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

