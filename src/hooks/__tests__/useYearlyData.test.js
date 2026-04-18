import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getTransakcjeForYear: vi.fn(),
  getAvailableYears: vi.fn(),
}));

import * as api from '../../services/api';
import { useYearlyData } from '../useYearlyData';

const mkTx = (id, month, typ, kwota, kategoria = 'Jedzenie', osoba = 'Jan') => ({
  id: String(id),
  data: `2026-${String(month).padStart(2, '0')}-15`,
  typ,
  kwota,
  kategoria,
  osoba,
});

describe('useYearlyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAvailableYears.mockResolvedValue([2026, 2025, 2024]);
  });

  it('ładuje dane bieżącego i poprzedniego roku oraz listę lat', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([mkTx(1, 1, 'Przychód', 1000)]);
      if (year === 2025) return Promise.resolve([mkTx(2, 1, 'Przychód', 500)]);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useYearlyData(2026));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.availableYears).toEqual([2026, 2025, 2024]);
    expect(result.current.totalIncome).toBe(1000);
    expect(result.current.monthlyData).toHaveLength(12);
  });

  it('oblicza YoY na podstawie danych z poprzedniego roku', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([mkTx(1, 1, 'Przychód', 1000)]);
      if (year === 2025) return Promise.resolve([mkTx(2, 1, 'Przychód', 500)]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.yoyIncome.change).toBe(500);
    expect(result.current.yoyIncome.percent).toBe(100);
  });

  it('oblicza totalBalance i avgMonthlyExpense', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([
        mkTx(1, 1, 'Przychód', 1200),
        mkTx(2, 1, 'Wydatek', 600),
      ]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.totalIncome).toBe(1200);
    expect(result.current.totalExpenses).toBe(600);
    expect(result.current.totalBalance).toBe(600);
    expect(result.current.avgMonthlyExpense).toBe(50);
  });

  it('ustawia puste tablice gdy fetch się nie powiedzie', async () => {
    api.getTransakcjeForYear.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.yearData).toEqual([]);
    expect(result.current.prevYearData).toEqual([]);
  });

  it('nie pobiera compareData dopóki compareYear jest null', async () => {
    api.getTransakcjeForYear.mockResolvedValue([]);
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.compareYear).toBeNull();
    expect(result.current.compareChartData).toEqual([]);
    expect(result.current.categoryCompareTable).toEqual([]);
    // Pierwszy fetch: rok bieżący + poprzedni = 2 wywołania
    expect(api.getTransakcjeForYear).toHaveBeenCalledTimes(2);
  });

  it('pobiera compareData po ustawieniu compareYear i buduje compareChartData', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([mkTx(1, 2, 'Wydatek', 300)]);
      if (year === 2024) return Promise.resolve([mkTx(2, 2, 'Wydatek', 200)]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setCompareYear(2024);
    });

    await waitFor(() => {
      expect(result.current.compareTotalExpenses).toBe(200);
    });
    expect(result.current.compareChartData).toHaveLength(12);
    const feb = result.current.compareChartData[1];
    expect(feb['Wydatki 2026']).toBe(300);
    expect(feb['Wydatki 2024']).toBe(200);
  });

  it('buduje categoryCompareTable z odpowiednim sortowaniem i zmianą', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([
        mkTx(1, 1, 'Wydatek', 500, 'Jedzenie'),
        mkTx(2, 1, 'Wydatek', 100, 'Transport'),
      ]);
      if (year === 2024) return Promise.resolve([
        mkTx(3, 1, 'Wydatek', 300, 'Jedzenie'),
        mkTx(4, 1, 'Wydatek', 50, 'Rozrywka'),
      ]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    act(() => {
      result.current.setCompareYear(2024);
    });
    await waitFor(() => {
      expect(result.current.compareTotalExpenses).toBe(350);
    });
    const table = result.current.categoryCompareTable;
    expect(table[0].name).toBe('Jedzenie');
    expect(table[0].base).toBe(500);
    expect(table[0].compare).toBe(300);
    expect(table[0].change).toBe(200);
    const rozrywka = table.find(r => r.name === 'Rozrywka');
    expect(rozrywka).toEqual({ name: 'Rozrywka', base: 0, compare: 50, change: -50 });
  });

  it('cumulativeSavings kumuluje różnicę przychody-wydatki po miesiącach', async () => {
    api.getTransakcjeForYear.mockImplementation(year => {
      if (year === 2026) return Promise.resolve([
        mkTx(1, 1, 'Przychód', 1000),
        mkTx(2, 1, 'Wydatek', 400),
        mkTx(3, 2, 'Przychód', 500),
        mkTx(4, 2, 'Wydatek', 200),
      ]);
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useYearlyData(2026));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.cumulativeSavings[0].savings).toBe(600);
    expect(result.current.cumulativeSavings[1].savings).toBe(900);
    expect(result.current.cumulativeSavings[11].savings).toBe(900);
  });

  it('resetuje compareYear przy zmianie roku bazowego', async () => {
    api.getTransakcjeForYear.mockResolvedValue([]);
    const { result, rerender } = renderHook(({ year }) => useYearlyData(year), {
      initialProps: { year: 2026 },
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    act(() => {
      result.current.setCompareYear(2024);
    });
    rerender({ year: 2025 });
    await waitFor(() => {
      expect(result.current.compareYear).toBeNull();
    });
  });
});
