import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  getMonthName,
  calculateIncome,
  calculateExpenses,
  calculateBalance,
  changeMonth,
  getCurrentMonth,
  sortTransactionsByDate,
  MONTH_NAMES
} from '../utils/calculations';

describe('Utility Functions - Formatting', () => {
  describe('formatCurrency', () => {
    it('formatuje kwoty z 2 miejscami po przecinku i separatorem tysięcy', () => {
      const result1 = formatCurrency(1234.56);
      expect(result1).toContain('1');
      expect(result1).toContain('234');
      expect(result1).toContain('56');
      expect(result1).toContain(',');
      expect(result1).toContain('zł');

      const result2 = formatCurrency(1000);
      expect(result2).toContain('1');
      expect(result2).toContain('000');
      expect(result2).toContain(',');

      const result3 = formatCurrency(0);
      expect(result3).toContain('0');
      expect(result3).toContain(',');
      expect(result3).toContain('zł');
    });

    it('obsługuje kwoty ujemne', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('-');
      expect(result).toContain('500');
      expect(result).toContain(',');
      expect(result).toContain('zł');
    });

    it('obsługuje bardzo duże kwoty', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('1');
      expect(result).toContain('000');
      expect(result).toContain('zł');
    });
  });

  describe('formatDate', () => {
    it('formatuje daty w polskim formacie', () => {
      expect(formatDate('2026-02-13')).toBe('13/02/2026');
      expect(formatDate('2026-01-01')).toBe('01/01/2026');
      expect(formatDate('2026-12-31')).toBe('31/12/2026');
    });

    it('obsługuje obiekty Date', () => {
      const date = new Date('2026-02-13');
      expect(formatDate(date)).toBe('13/02/2026');
    });
  });

  describe('getMonthName', () => {
    it('zwraca nazwę miesiąca z rokiem w polskim formacie', () => {
      expect(getMonthName(2, 2026)).toContain('luty');
      expect(getMonthName(2, 2026)).toContain('2026');
    });

    it('obsługuje grudzień', () => {
      expect(getMonthName(12, 2025)).toContain('grudzień');
      expect(getMonthName(12, 2025)).toContain('2025');
    });
  });

  describe('MONTH_NAMES', () => {
    it('zawiera 12 nazw miesięcy', () => {
      expect(MONTH_NAMES.length).toBe(13); // 0 jest puste
      expect(MONTH_NAMES[1]).toBe('Styczeń');
      expect(MONTH_NAMES[2]).toBe('Luty');
      expect(MONTH_NAMES[12]).toBe('Grudzień');
    });
  });
});

describe('Utility Functions - Calculations', () => {
  const testTransactions = [
    { id: 1, typ: 'Wydatek', kwota: 100 },
    { id: 2, typ: 'Wydatek', kwota: 50 },
    { id: 3, typ: 'Przychód', kwota: 500 },
    { id: 4, typ: 'Przychód', kwota: 200 }
  ];

  describe('calculateIncome', () => {
    it('filtruje tylko typ === "Przychód"', () => {
      const income = calculateIncome(testTransactions);
      expect(income).toBe(700);
    });

    it('zwraca 0 dla pustej listy transakcji', () => {
      expect(calculateIncome([])).toBe(0);
      expect(calculateIncome(undefined)).toBe(0);
    });

    it('poprawnie parsuje kwoty (string → number)', () => {
      const transactions = [
        { typ: 'Przychód', kwota: '100.50' },
        { typ: 'Przychód', kwota: '200' }
      ];
      expect(calculateIncome(transactions)).toBe(300.5);
    });

    it('obsługuje NaN wartości', () => {
      const transactions = [
        { typ: 'Przychód', kwota: 100 },
        { typ: 'Przychód', kwota: null }
      ];
      expect(calculateIncome(transactions)).toBe(100);
    });
  });

  describe('calculateExpenses', () => {
    it('filtruje tylko typ === "Wydatek"', () => {
      const expenses = calculateExpenses(testTransactions);
      expect(expenses).toBe(150);
    });

    it('zwraca 0 dla pustej listy transakcji', () => {
      expect(calculateExpenses([])).toBe(0);
      expect(calculateExpenses(undefined)).toBe(0);
    });

    it('poprawnie parsuje kwoty (string → number)', () => {
      const transactions = [
        { typ: 'Wydatek', kwota: '100.50' },
        { typ: 'Wydatek', kwota: '50' }
      ];
      expect(calculateExpenses(transactions)).toBe(150.5);
    });
  });

  describe('calculateBalance', () => {
    it('oblicza bilans = przychody - wydatki', () => {
      const balance = calculateBalance(testTransactions);
      expect(balance).toBe(700 - 150); // 550
    });

    it('zwraca 0 dla pustej listy transakcji', () => {
      expect(calculateBalance([])).toBe(0);
    });

    it('obsługuje ujemny bilans (więcej wydatków niż przychodów)', () => {
      const transactions = [
        { typ: 'Wydatek', kwota: 1000 },
        { typ: 'Przychód', kwota: 200 }
      ];
      expect(calculateBalance(transactions)).toBe(-800);
    });
  });
});

describe('Utility Functions - Date Navigation', () => {
  describe('changeMonth', () => {
    it('+1 z stycznia → luty tego samego roku', () => {
      const result = changeMonth(1, 2026, 1);
      expect(result).toEqual({ month: 2, year: 2026 });
    });

    it('+1 z grudnia → styczeń następnego roku', () => {
      const result = changeMonth(12, 2025, 1);
      expect(result).toEqual({ month: 1, year: 2026 });
    });

    it('-1 ze stycznia → grudzień poprzedniego roku', () => {
      const result = changeMonth(1, 2026, -1);
      expect(result).toEqual({ month: 12, year: 2025 });
    });

    it('-1 z marca → luty tego samego roku', () => {
      const result = changeMonth(3, 2026, -1);
      expect(result).toEqual({ month: 2, year: 2026 });
    });

    it('obsługuje różne delty (np. +3, -2)', () => {
      expect(changeMonth(1, 2026, 3)).toEqual({ month: 4, year: 2026 });
      expect(changeMonth(2, 2026, -2)).toEqual({ month: 12, year: 2025 });
      // 10 + 5 = 15 miesiąc = 15 - 12 = 3 miesiąc + 1 rok
      expect(changeMonth(10, 2026, 5)).toEqual({ month: 3, year: 2027 });
    });
  });

  describe('getCurrentMonth', () => {
    it('zwraca obiekt z month i year', () => {
      const result = getCurrentMonth();
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('year');
    });

    it('month jest w zakresie 1-12', () => {
      const { month } = getCurrentMonth();
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });

    it('year jest liczbą czterocyfrową', () => {
      const { year } = getCurrentMonth();
      expect(year).toBeGreaterThan(2000);
      expect(year).toBeLessThan(3000);
    });
  });
});

describe('Utility Functions - Sorting', () => {
  describe('sortTransactionsByDate', () => {
    it('sortuje transakcje od najnowszych do najstarszych', () => {
      const transactions = [
        { id: 1, data: '2026-02-10', typ: 'Wydatek' },
        { id: 2, data: '2026-02-15', typ: 'Przychód' },
        { id: 3, data: '2026-02-05', typ: 'Wydatek' }
      ];

      const sorted = sortTransactionsByDate(transactions);

      expect(sorted[0].data).toBe('2026-02-15');
      expect(sorted[1].data).toBe('2026-02-10');
      expect(sorted[2].data).toBe('2026-02-05');
    });

    it('nie modyfikuje oryginalnej tablicy', () => {
      const original = [
        { data: '2026-02-10' },
        { data: '2026-02-15' }
      ];
      const originalCopy = [...original];

      sortTransactionsByDate(original);

      expect(original).toEqual(originalCopy);
    });

    it('obsługuje puste tablice', () => {
      expect(sortTransactionsByDate([])).toEqual([]);
      expect(sortTransactionsByDate(undefined)).toEqual([]);
    });

    it('poprawnie sortuje daty w formacie ISO', () => {
      const transactions = [
        { id: 1, data: '2026-01-31' },
        { id: 2, data: '2026-02-01' },
        { id: 3, data: '2026-01-15' }
      ];

      const sorted = sortTransactionsByDate(transactions);

      expect(sorted[0].id).toBe(2); // 2026-02-01
      expect(sorted[1].id).toBe(1); // 2026-01-31
      expect(sorted[2].id).toBe(3); // 2026-01-15
    });
  });
});
