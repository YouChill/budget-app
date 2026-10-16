import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionFilters, groupByDay } from '../useTransactionFilters';

const tx = [
  { id: 1, data: '2026-03-01', typ: 'Wydatek', kwota: 20, kategoria: 'Jedzenie', osoba: 'A', komentarz: 'Biedronka' },
  { id: 2, data: '2026-03-03', typ: 'Przychód', kwota: 100, kategoria: 'Wynagrodzenie', osoba: 'B' },
  { id: 3, data: '2026-03-03', typ: 'Wydatek', kwota: 30, kategoria: 'Transport', osoba: 'A' },
  { id: 4, data: '2026-03-02', typ: 'Wydatek', kwota: 5, kategoria: '', osoba: 'B' },
];

describe('groupByDay', () => {
  it('grupuje kolejne dni z saldem dnia', () => {
    const groups = groupByDay([tx[1], tx[2], tx[0]]);
    expect(groups.map(g => [g.key, g.items.length, g.net])).toEqual([
      ['2026-03-03', 2, 70],
      ['2026-03-01', 1, -20],
    ]);
  });
});

describe('useTransactionFilters', () => {
  it('sortuje od najnowszych i grupuje po dniu', () => {
    const { result } = renderHook(() => useTransactionFilters(tx));
    expect(result.current.groupedByDay.map(g => g.key)).toEqual(['2026-03-03', '2026-03-02', '2026-03-01']);
  });

  it('wyszukiwanie po komentarzu, osobie i kwocie (bez wielkości liter)', () => {
    const { result } = renderHook(() => useTransactionFilters(tx));
    act(() => result.current.setSearchQuery('BIEDRONKA'));
    expect(result.current.filteredTransakcje.map(t => t.id)).toEqual([1]);
    act(() => result.current.setSearchQuery('100'));
    expect(result.current.filteredTransakcje.map(t => t.id)).toEqual([2]);
  });

  it('filtr kategorii: toggle i „Inne" dla transakcji bez kategorii', () => {
    const { result } = renderHook(() => useTransactionFilters(tx));
    act(() => result.current.toggleCategory('Inne'));
    expect(result.current.filteredTransakcje.map(t => t.id)).toEqual([4]);
    act(() => result.current.toggleCategory('Inne'));
    expect(result.current.selectedCategory).toBeNull();
    expect(result.current.filteredTransakcje).toHaveLength(4);
  });

  it('clearFilters zdejmuje wyszukiwanie i kategorię', () => {
    const { result } = renderHook(() => useTransactionFilters(tx));
    act(() => {
      result.current.setSearchQuery('x');
      result.current.setSelectedCategory('Jedzenie');
    });
    act(() => result.current.clearFilters());
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedCategory).toBeNull();
  });
});
