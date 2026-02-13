import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateIncome,
  calculateExpenses,
  calculateBalance,
  sortTransactionsByDate,
  changeMonth,
  getCurrentMonth,
  formatCurrency,
  formatDate
} from '../../utils/calculations';

describe('Integration Tests - Main Workflows', () => {
  beforeEach(() => {
    // cleanup
  });

  describe('Flow: Adding a Transaction', () => {
    it('po dodaniu wydatku - suma wydatków i bilans się aktualizują', () => {
      const transactionsBeforeAdd = [
        { typ: 'Wydatek', kwota: 100 },
        { typ: 'Przychód', kwota: 500 }
      ];

      const expensesBefore = calculateExpenses(transactionsBeforeAdd);
      const balanceBefore = calculateBalance(transactionsBeforeAdd);

      expect(expensesBefore).toBe(100);
      expect(balanceBefore).toBe(400); // 500 - 100

      // Simulacja dodania nowej transakcji
      const transactionsAfterAdd = [
        ...transactionsBeforeAdd,
        { typ: 'Wydatek', kwota: 50 }
      ];

      const expensesAfter = calculateExpenses(transactionsAfterAdd);
      const balanceAfter = calculateBalance(transactionsAfterAdd);

      expect(expensesAfter).toBe(150);
      expect(balanceAfter).toBe(350); // 500 - 150
      expect(expensesAfter).toBeGreaterThan(expensesBefore);
      expect(balanceAfter).toBeLessThan(balanceBefore);
    });

    it('po dodaniu przychodu - suma przychodów i bilans się aktualizują', () => {
      const transactionsBefore = [
        { typ: 'Wydatek', kwota: 100 },
        { typ: 'Przychód', kwota: 500 }
      ];

      const incomeBefore = calculateIncome(transactionsBefore);
      const balanceBefore = calculateBalance(transactionsBefore);

      expect(incomeBefore).toBe(500);
      expect(balanceBefore).toBe(400);

      const transactionsAfter = [
        ...transactionsBefore,
        { typ: 'Przychód', kwota: 200 }
      ];

      const incomeAfter = calculateIncome(transactionsAfter);
      const balanceAfter = calculateBalance(transactionsAfter);

      expect(incomeAfter).toBe(700);
      expect(balanceAfter).toBe(600);
      expect(incomeAfter).toBeGreaterThan(incomeBefore);
      expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });
  });

  describe('Flow: Deleting a Transaction', () => {
    it('po usunięciu wydatku - suma wydatków i bilans się aktualizują', () => {
      const transactionsBeforeDelete = [
        { id: 'trans-1', typ: 'Wydatek', kwota: 100 },
        { id: 'trans-2', typ: 'Wydatek', kwota: 50 },
        { id: 'trans-3', typ: 'Przychód', kwota: 500 }
      ];

      const expensesBefore = calculateExpenses(transactionsBeforeDelete);
      const balanceBefore = calculateBalance(transactionsBeforeDelete);

      expect(expensesBefore).toBe(150);
      expect(balanceBefore).toBe(350); // 500 - 150

      // Simulacja usunięcia transakcji
      const transactionsAfterDelete = transactionsBeforeDelete.filter(
        t => t.id !== 'trans-1'
      );

      const expensesAfter = calculateExpenses(transactionsAfterDelete);
      const balanceAfter = calculateBalance(transactionsAfterDelete);

      expect(expensesAfter).toBe(50);
      expect(balanceAfter).toBe(450); // 500 - 50
      expect(expensesAfter).toBeLessThan(expensesBefore);
      expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });

    it('po usunięciu przychodu - suma przychodów i bilans się aktualizują', () => {
      const transactionsBefore = [
        { id: 'trans-1', typ: 'Wydatek', kwota: 100 },
        { id: 'trans-2', typ: 'Przychód', kwota: 500 },
        { id: 'trans-3', typ: 'Przychód', kwota: 200 }
      ];

      const incomeBefore = calculateIncome(transactionsBefore);
      const balanceBefore = calculateBalance(transactionsBefore);

      expect(incomeBefore).toBe(700);
      expect(balanceBefore).toBe(600);

      const transactionsAfter = transactionsBefore.filter(t => t.id !== 'trans-2');

      const incomeAfter = calculateIncome(transactionsAfter);
      const balanceAfter = calculateBalance(transactionsAfter);

      expect(incomeAfter).toBe(200);
      expect(balanceAfter).toBe(100);
      expect(incomeAfter).toBeLessThan(incomeBefore);
    });
  });

  describe('Flow: Month Navigation', () => {
    it('użytkownik przechodzi na inny miesiąc', () => {
      const currentMonth = { month: 2, year: 2026 };

      const nextMonth = changeMonth(currentMonth.month, currentMonth.year, 1);
      expect(nextMonth).toEqual({ month: 3, year: 2026 });

      const prevMonth = changeMonth(currentMonth.month, currentMonth.year, -1);
      expect(prevMonth).toEqual({ month: 1, year: 2026 });
    });

    it('zmiana miesiąca obsługuje przejście roku (przed)', () => {
      const february = { month: 2, year: 2026 };
      const previous = changeMonth(february.month, february.year, -2);
      expect(previous).toEqual({ month: 12, year: 2025 });
    });

    it('zmiana miesiąca obsługuje przejście roku (po)', () => {
      const december = { month: 12, year: 2025 };
      const next = changeMonth(december.month, december.year, 1);
      expect(next).toEqual({ month: 1, year: 2026 });
    });

    it('wielokrotne przejścia miesięcy działają prawidłowo', () => {
      let current = { month: 1, year: 2026 };
      
      // +12 miesięcy
      for (let i = 0; i < 12; i++) {
        current = changeMonth(current.month, current.year, 1);
      }
      
      expect(current).toEqual({ month: 1, year: 2027 });
    });
  });

  describe('Flow: Transaction List Updates', () => {
    it('transakcje są sortowane od najnowszych do najstarszych', () => {
      const unsortedTransactions = [
        { id: 1, data: '2026-02-10', kwota: 100 },
        { id: 2, data: '2026-02-15', kwota: 50 },
        { id: 3, data: '2026-02-05', kwota: 200 }
      ];

      const sorted = sortTransactionsByDate(unsortedTransactions);

      expect(sorted[0].data).toBe('2026-02-15');
      expect(sorted[1].data).toBe('2026-02-10');
      expect(sorted[2].data).toBe('2026-02-05');
    });

    it('nie modyfikuje oryginalnej tablicy', () => {
      const original = [
        { data: '2026-02-10' },
        { data: '2026-02-15' }
      ];
      const originalLength = original.length;

      sortTransactionsByDate(original);

      expect(original.length).toBe(originalLength);
    });

    it('suma finansów jest przeliczana prawidłowo dla sortowanej listy', () => {
      const transactions = [
        { typ: 'Wydatek', kwota: 100 },
        { typ: 'Przychód', kwota: 500 },
        { typ: 'Wydatek', kwota: 50 }
      ];

      const sorted = sortTransactionsByDate(transactions);

      const income = calculateIncome(sorted);
      const expenses = calculateExpenses(sorted);
      const balance = calculateBalance(sorted);

      expect(income).toBe(500);
      expect(expenses).toBe(150);
      expect(balance).toBe(350);
    });
  });

  describe('Flow: Data Formatting', () => {
    it('formatCurrency formatuje różne kwoty', () => {
      expect(formatCurrency(0)).toContain('0');
      expect(formatCurrency(0)).toContain('zł');

      expect(formatCurrency(100)).toContain('100');
      expect(formatCurrency(100)).toContain('zł');

      const result1 = formatCurrency(1234.56);
      expect(result1).toContain('1');
      expect(result1).toContain('234');
      expect(result1).toContain('56');

      expect(formatCurrency(-500)).toContain('-');
      expect(formatCurrency(-500)).toContain('500');
    });

    it('formatDate formatuje daty w polskim formacie', () => {
      const result = formatDate('2026-02-13');
      expect(result).toContain('2026');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toBe('13/02/2026');
    });

    it('getCurrentMonth zwraca bieżący miesiąc i rok', () => {
      const result = getCurrentMonth();
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('year');
      expect(result.month).toBeGreaterThanOrEqual(1);
      expect(result.month).toBeLessThanOrEqual(12);
      expect(result.year).toBeGreaterThan(2000);
    });
  });

  describe('Flow: Empty State Handling', () => {
    it('można obliczyć sumy nawet gdy brak danych', () => {
      const emptyTransactions = [];

      const income = calculateIncome(emptyTransactions);
      const expenses = calculateExpenses(emptyTransactions);
      const balance = calculateBalance(emptyTransactions);

      expect(income).toBe(0);
      expect(expenses).toBe(0);
      expect(balance).toBe(0);
    });

    it('sortowanie obsługuje puste listy', () => {
      const sorted = sortTransactionsByDate([]);
      expect(sorted).toEqual([]);
    });

    it('undefined jest obsługiwane jak pusta lista', () => {
      expect(calculateIncome(undefined)).toBe(0);
      expect(calculateExpenses(undefined)).toBe(0);
      expect(calculateBalance(undefined)).toBe(0);
      expect(sortTransactionsByDate(undefined)).toEqual([]);
    });
  });

  describe('Flow: Complex Scenarios', () => {
    it('obliczeń dla realistycznego miesiąca z wieloma transakcjami', () => {
      const transactions = [
        { typ: 'Przychód', kwota: 5000 }, // pensja
        { typ: 'Wydatek', kwota: 1000 },  // czynsz
        { typ: 'Wydatek', kwota: 500 },   // zakupy
        { typ: 'Wydatek', kwota: 200 },   // transport
        { typ: 'Przychód', kwota: 500 },  // bonus
        { typ: 'Wydatek', kwota: 100 },   // rozrywka
      ];

      const income = calculateIncome(transactions);
      const expenses = calculateExpenses(transactions);
      const balance = calculateBalance(transactions);

      expect(income).toBe(5500);
      expect(expenses).toBe(1800);
      expect(balance).toBe(3700);
    });

    it('pełny cykl: filtrowanie → sortowanie → obliczenia', () => {
      const allTransactions = [
        { id: 1, data: '2026-02-10', typ: 'Wydatek', kwota: 100 },
        { id: 2, data: '2026-02-15', typ: 'Przychód', kwota: 500 },
        { id: 3, data: '2026-02-05', typ: 'Wydatek', kwota: 200 },
        { id: 4, data: '2026-02-20', typ: 'Przychód', kwota: 100 }
      ];

      // Sortowanie
      const sorted = sortTransactionsByDate(allTransactions);
      expect(sorted[0].data).toBe('2026-02-20');

      // Obliczenia na posortowanych danych
      const income = calculateIncome(sorted);
      const expenses = calculateExpenses(sorted);
      const balance = calculateBalance(sorted);

      expect(income).toBe(600);
      expect(expenses).toBe(300);
      expect(balance).toBe(300);
    });
  });
});
